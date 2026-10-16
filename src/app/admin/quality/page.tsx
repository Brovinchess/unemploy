import type { DropReason } from "@/db/schema";
import { MIND_MISTAKES, sortParams, when } from "@/lib/admin";
import { quality } from "@/lib/admin-data";
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
  unreachable: "Page would not open",
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
  unreachable: CHART.mist,
  other: CHART.slate,
  pay: CHART.slate,
};
const REASONS = Object.keys(REASON_LABEL) as DropReason[];
const reasonLabel = (r: string) => REASON_LABEL[r as DropReason] ?? r;

export default async function Quality({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 3);
  const { key, dir } = sortParams(q, "when");
  const d = await quality({ days, sort: key, dir });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  // Leads per day, one series per reason (only reasons that occurred), in the fixed reason order.
  const series = REASONS.filter((r) => d.perDayByReason.some((s) => s.reason === r)).map((r) => ({
    label: REASON_LABEL[r],
    color: REASON_COLOR[r],
    values: d.perDayByReason.find((s) => s.reason === r)!.values,
  }));
  const byReason = d.byReason.map(([r, n]) => [reasonLabel(r), n] as [string, number]);

  return (
    <Page>
      <PageHead section="Quality" title="What the headhunters threw out, and what we refused" description="For reading the market and tuning the brief." controls={<DaysPicker days={days} base={BASE} q={q} />} />

      <Tiles cols={5} className="mt-6">
        <Stat label="Searches" value={d.searches} />
        <Stat label="Leads opened and dropped" value={d.leadTotal} hint={d.delivered ? `${Math.round(d.leadTotal / d.delivered)} per delivered job` : undefined} />
        <Stat label="Jobs delivered" value={d.delivered} />
        <Stat label="Refused by the app" value={d.refusedTotal} hint="jobs in pushes that failed a check" />
        <Stat label="Mind mistakes" value={d.mistakeTotal} hint="refusals the brief should have prevented" />
      </Tiles>

      <div className="mt-6">
        <Card>
          <BarChart title="Leads dropped per day, by reason" keys={d.keys} series={series} height={180} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Why the Mind dropped them" total={d.leadTotal} rows={byReason} />
        <Counts title="Per headhunter" total={d.leadTotal} rows={d.byWho} />
        <Counts title='"Not eligible": where the posting was really for' total={d.byPlace.reduce((a, [, n]) => a + n, 0)} rows={d.byPlace} />
        <Counts title='"Other": what actually happened' total={d.byOther.reduce((a, [, n]) => a + n, 0)} rows={d.byOther} />
        <Counts title="Refused by the app, by code" total={d.refusedTotal} rows={d.byCode} />
        <Counts title="Blocked hosts, last 7 days" total={d.blockedHosts.reduce((a, [, n]) => a + n, 0)} rows={d.blockedHosts} />
      </div>

      <SectionTitle title="The Mind's mistakes, per headhunter" hint="Jobs the app refused for reasons the brief already covers: bad data, a non-employer link, a closed or stale posting, a repeat, or sending when no search was asked for." />
      <div className="mt-3">
        <Table
          head={["Headhunter", "Total", ...MIND_MISTAKES.map((c) => c.replace(/_/g, " "))]}
          rows={d.mistakeRows.map((r) => [<UserLink key={r.pid} id={r.userId} name={r.who} />, r.total, ...r.counts.map((n) => (n ? n : <span key="z" className="text-white/25">0</span>))])}
          empty="No mistakes of these kinds in this window."
          emptyMood="happy"
        />
      </div>

      <SectionTitle title={`Every dropped lead (${d.leadTotal})`} />
      <div className="mt-3">
        <Table
          head={[col("when", "When"), col("who", "Headhunter"), col("reason", "Reason"), col("company", "Company"), "Title", "The Mind's note"]}
          empty="No leads were dropped in this window."
          rows={d.leads.map((l) => [
            when(l.createdAt),
            <UserLink key="u" id={l.userId} name={l.who} />,
            reasonLabel(l.reason),
            l.company,
            l.url ? <Ext key={l.id} href={l.url}>{l.title}</Ext> : l.title,
            <Clamp key="n" text={l.note} />,
          ])}
        />
        <Cap shown={MAX_ROWS} total={d.leadTotal} />
      </div>

      <SectionTitle title={`Pushes the app refused or adjusted (${d.refusedTotal})`} hint="Jobs the Mind sent that failed our checks, with the reason it was told." />
      <div className="mt-3">
        <Table
          head={["When", "Headhunter", "Code", "Link", "What it was told"]}
          empty="Nothing was refused in this window."
          emptyMood="happy"
          rows={d.refused.map((r) => [when(r.at), r.who, r.code, r.url.replace(/^https?:\/\//, "").slice(0, 60), <Clamp key="h" text={r.hint.slice(0, 220)} />])}
        />
        <Cap shown={MAX_ROWS} total={d.refusedTotal} />
      </div>
    </Page>
  );
}
