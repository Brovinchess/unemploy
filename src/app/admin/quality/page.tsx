import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DropReason } from "@/db/schema";
import { MIND_MISTAKES, dayKeys, daysAgo, directory, perDay, pushDetails, sortParams, sortRows, sum, tally, when, queue } from "@/lib/admin";
import { BarChart, CHART, Cap, Card, Clamp, Counts, DaysPicker, Ext, Page, PageHead, SectionTitle, SortLink, Stat, Table, Tiles, UserLink, daysParam } from "../ui";

const BASE = "/admin/quality";
const MAX_ROWS = 500;

// What the headhunters threw out, why, and what the app refused: for reading the market and tuning the brief.
const REASON_LABEL: Record<DropReason, string> = {
  not_eligible: "Not eligible from the country",
  too_old: "Posted too long ago",
  closed: "Closed",
  poor_fit: "Poor fit",
  duplicate: "Duplicate",
  work_setting: "Wrong work setting",
  other: "Other",
  pay: "Other (legacy pay)",
};
const REASON_COLOR: Record<DropReason, string> = {
  not_eligible: CHART.coral,
  too_old: CHART.amber,
  closed: CHART.mist,
  poor_fit: CHART.blue,
  duplicate: CHART.plum,
  work_setting: CHART.teal,
  other: CHART.slate,
  pay: CHART.slate,
};
const REASONS = Object.keys(REASON_LABEL) as DropReason[];
// Sub-buckets read from the Mind's note, so the two vague reasons say something.
const PLACES: [string, RegExp][] = [
  ["United States", /\bus\b|u\.s\.|usa|united states|americas|north america|california|new york|pacific time|eastern time/i],
  ["Singapore", /singapore/i],
  ["UK or Europe", /\buk\b|united kingdom|europe|emea|london|berlin|vienna|malta|stockholm/i],
  ["UAE", /abu dhabi|dubai|uae/i],
  ["India", /india/i],
  ["Thailand", /bangkok|thailand/i],
  ["Vietnam", /vietnam|ho chi minh/i],
  ["Philippines", /philippines|manila|quezon/i],
  ["Indonesia", /indonesia|jakarta/i],
  ["Hong Kong or China", /hong kong|shanghai|china/i],
  ["Qualification bar, not place", /requires?|qualification|credential|degree|years|experience|certif/i],
];
const OTHERS: [string, RegExp][] = [
  ["Employer page would not load or blocked", /not load|blocked|403|unreachable|would not render|unverifiable|could not open|returned no job|no longer exists/i],
  ["Recruiter or staffing agency, employer unnamed", /recruit|staffing|agency|client (not |un)named|michael page|robert walters/i],
  ["Only job-board mirrors found", /aggregator|mirror|job board|linkedin only|no employer/i],
  ["Not a real opening (pool, programme, window)", /resume pool|accelerator|application window|one-liner|not an active/i],
  ["Level or title outside target", /associate|principal|level/i],
];
const bucket = (note: string | null, table: [string, RegExp][]) => table.find(([, re]) => re.test(note ?? ""))?.[0] ?? "Unspecified";

export default async function Quality({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 3);
  const since = daysAgo(days);
  const { key, dir } = sortParams(q, "when");
  const [d, leads, logs, searches] = await queue([
    () => directory(),
    () => db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), orderBy: desc(schema.leads.createdAt) }),
    () => db.query.ingestLog.findMany({ where: gte(schema.ingestLog.createdAt, since), orderBy: desc(schema.ingestLog.createdAt) }),
    () => db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), columns: { cognitionUsed: true, jobsAdded: true } }),
  ]);
  const { who, userOfProfile } = d;
  const refused = logs.flatMap((g) => pushDetails(g.detail).filter((x) => x.code).map((x) => ({ at: g.createdAt, profileId: g.profileId, who: who(g.profileId), code: x.code!, url: x.url ?? "", hint: x.hint ?? "" })));
  const delivered = sum(searches, (s) => s.jobsAdded);
  const notEligible = leads.filter((l) => l.reason === "not_eligible");
  const other = leads.filter((l) => l.reason === "other" || l.reason === "pay");

  // Leads per day, one series per reason (only reasons that occurred).
  const keys = dayKeys(days);
  const series = REASONS.filter((r) => leads.some((l) => l.reason === r)).map((r) => ({
    label: REASON_LABEL[r],
    color: REASON_COLOR[r],
    values: perDay(leads.filter((l) => l.reason === r), keys, (l) => l.createdAt),
  }));

  // The Mind's mistakes: refusals whose code means it ignored its brief, counted per headhunter.
  const mistakes = refused.filter((r) => (MIND_MISTAKES as readonly string[]).includes(r.code));
  const mistakeRows = [...new Set(mistakes.map((m) => m.profileId))]
    .map((pid) => {
      const mine = mistakes.filter((m) => m.profileId === pid);
      return { pid, who: who(pid), userId: userOfProfile(pid), total: mine.length, counts: MIND_MISTAKES.map((c) => mine.filter((m) => m.code === c).length) };
    })
    .sort((a, b) => b.total - a.total);

  const rows = sortRows(
    leads.map((l) => ({ ...l, who: who(l.profileId), userId: userOfProfile(l.profileId) })),
    key,
    dir,
    { when: (l) => l.createdAt, who: (l) => l.who, reason: (l) => l.reason, company: (l) => l.company },
  );
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  return (
    <Page>
      <PageHead section="Quality" title="What the headhunters threw out, and what we refused" description="For reading the market and tuning the brief." controls={<DaysPicker days={days} base={BASE} q={q} />} />

      <Tiles cols={5} className="mt-6">
        <Stat label="Searches" value={searches.length} />
        <Stat label="Leads opened and dropped" value={leads.length} hint={delivered ? `${Math.round(leads.length / delivered)} per delivered job` : undefined} />
        <Stat label="Jobs delivered" value={delivered} />
        <Stat label="Refused by the app" value={refused.length} hint="jobs in pushes that failed a check" />
        <Stat label="Mind mistakes" value={mistakes.length} hint="refusals the brief should have prevented" />
      </Tiles>

      <div className="mt-6">
        <Card>
          <BarChart title="Leads dropped per day, by reason" keys={keys} series={series} height={180} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Why the Mind dropped them" total={leads.length} rows={tally(leads, (l) => REASON_LABEL[l.reason] ?? l.reason)} />
        <Counts title="Per headhunter" total={leads.length} rows={tally(leads, (l) => who(l.profileId))} />
        <Counts title='"Not eligible": where the posting was really for' total={notEligible.length} rows={tally(notEligible, (l) => bucket(l.note, PLACES))} />
        <Counts title='"Other": what actually happened' total={other.length} rows={tally(other, (l) => bucket(l.note, OTHERS))} />
        <Counts title="Refused by the app, by code" total={refused.length} rows={tally(refused, (r) => r.code)} />
      </div>

      <SectionTitle title="The Mind's mistakes, per headhunter" hint="Jobs the app refused for reasons the brief already covers: bad data, a non-employer link, a closed or stale posting, a repeat, or sending when no search was asked for." />
      <div className="mt-3">
        <Table
          head={["Headhunter", "Total", ...MIND_MISTAKES.map((c) => c.replace(/_/g, " "))]}
          rows={mistakeRows.map((r) => [<UserLink key={r.pid} id={r.userId} name={r.who} />, r.total, ...r.counts.map((n) => (n ? n : <span key="z" className="text-white/25">0</span>))])}
          empty="No mistakes of these kinds in this window."
          emptyMood="happy"
        />
      </div>

      <SectionTitle title={`Every dropped lead (${leads.length})`} />
      <div className="mt-3">
        <Table
          head={[col("when", "When"), col("who", "Headhunter"), col("reason", "Reason"), col("company", "Company"), "Title", "The Mind's note"]}
          empty="No leads were dropped in this window."
          rows={rows.slice(0, MAX_ROWS).map((l) => [
            when(l.createdAt),
            <UserLink key="u" id={l.userId} name={l.who} />,
            REASON_LABEL[l.reason] ?? l.reason,
            l.company,
            l.url ? <Ext key={l.id} href={l.url}>{l.title}</Ext> : l.title,
            <Clamp key="n" text={l.note} />,
          ])}
        />
        <Cap shown={MAX_ROWS} total={rows.length} />
      </div>

      <SectionTitle title={`Pushes the app refused or adjusted (${refused.length})`} hint="Jobs the Mind sent that failed our checks, with the reason it was told." />
      <div className="mt-3">
        <Table
          head={["When", "Headhunter", "Code", "Link", "What it was told"]}
          empty="Nothing was refused in this window."
          emptyMood="happy"
          rows={refused.slice(0, MAX_ROWS).map((r) => [when(r.at), r.who, r.code, r.url.replace(/^https?:\/\//, "").slice(0, 60), <Clamp key="h" text={r.hint.slice(0, 220)} />])}
        />
        <Cap shown={MAX_ROWS} total={refused.length} />
      </div>
    </Page>
  );
}
