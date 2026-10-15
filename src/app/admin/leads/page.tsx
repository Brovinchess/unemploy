import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, tally, when } from "@/lib/admin";
import { Counts, DaysPicker, Stat, Table, daysParam } from "../ui";

// What the headhunters threw out, why, and what the app refused: for reading the market and tuning the brief.
const REASON_LABEL: Record<string, string> = {
  not_eligible: "Not eligible from the country",
  too_old: "Posted too long ago",
  closed: "Closed",
  poor_fit: "Poor fit",
  duplicate: "Duplicate",
  work_setting: "Wrong work setting",
  other: "Other",
  pay: "Other (legacy pay)",
};
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

export default async function Leads({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = daysParam(await searchParams, 3);
  const since = daysAgo(days);
  const [profiles, users, leads, logs, searches] = await Promise.all([
    db.query.profiles.findMany({ columns: { id: true, label: true, userId: true } }),
    db.query.users.findMany({ columns: { id: true, username: true } }),
    db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), orderBy: desc(schema.leads.createdAt) }),
    db.query.ingestLog.findMany({ where: gte(schema.ingestLog.createdAt, since), orderBy: desc(schema.ingestLog.createdAt) }),
    db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), columns: { cognitionUsed: true, jobsAdded: true } }),
  ]);
  const who = new Map(profiles.map((p) => [p.id, `${users.find((u) => u.id === p.userId)?.username ?? "?"} · ${p.label}`]));
  const refused = logs.flatMap((g) =>
    ((g.detail as { url?: string; code?: string; hint?: string }[] | null) ?? [])
      .filter((d) => d.code)
      .map((d) => ({ at: g.createdAt, who: who.get(g.profileId) ?? "?", code: d.code!, url: d.url ?? "", hint: d.hint ?? "" })),
  );
  const delivered = searches.reduce((a, s) => a + Number(s.jobsAdded ?? 0), 0);
  const notEligible = leads.filter((l) => l.reason === "not_eligible");
  const other = leads.filter((l) => l.reason === "other" || l.reason === "pay");

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Dropped leads</p>
      <h1 className="font-display mt-1 text-3xl font-medium">What the headhunters threw out</h1>
      <div className="mt-2"><DaysPicker days={days} base="/admin/leads" /></div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Searches" value={searches.length} />
        <Stat label="Leads opened and dropped" value={leads.length} hint={delivered ? `${Math.round(leads.length / delivered)} per delivered job` : undefined} />
        <Stat label="Jobs delivered" value={delivered} />
        <Stat label="Pushes refused by the app" value={refused.length} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Why the Mind dropped them" total={leads.length} rows={tally(leads, (l) => REASON_LABEL[l.reason] ?? l.reason)} />
        <Counts title="Per headhunter" total={leads.length} rows={tally(leads, (l) => who.get(l.profileId) ?? "?")} />
        <Counts title='"Not eligible": where the posting was really for' total={notEligible.length} rows={tally(notEligible, (l) => bucket(l.note, PLACES))} />
        <Counts title='"Other": what actually happened' total={other.length} rows={tally(other, (l) => bucket(l.note, OTHERS))} />
        <Counts title="What the app refused, by code" total={refused.length} rows={tally(refused, (r) => r.code)} />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Every dropped lead ({leads.length})</h2>
      <div className="mt-3">
        <Table
          head={["When", "Headhunter", "Reason", "Company", "Title", "The Mind's note"]}
          rows={leads.map((l) => [
            when(l.createdAt),
            who.get(l.profileId) ?? "?",
            REASON_LABEL[l.reason] ?? l.reason,
            l.company,
            l.url ? <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2">{l.title}</a> : l.title,
            l.note ?? "",
          ])}
        />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Pushes the app refused or adjusted ({refused.length})</h2>
      <p className="mt-1 text-sm text-white/50">Jobs the Mind sent that failed our checks, with the reason it was told.</p>
      <div className="mt-3">
        <Table head={["When", "Headhunter", "Code", "Link", "What it was told"]} rows={refused.map((r) => [when(r.at), r.who, r.code, r.url.replace(/^https?:\/\//, "").slice(0, 60), r.hint.slice(0, 220)])} />
      </div>
    </main>
  );
}
