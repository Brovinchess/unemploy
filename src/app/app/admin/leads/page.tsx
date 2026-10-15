import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

// Owner-only: what the headhunters threw out, why, and what the app refused. For reading the
// market and tuning the brief. /app/admin/leads?days=3
const OWNER = "rovinc";
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
const count = <T,>(rows: T[], key: (r: T) => string) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const t = (d: Date) => d.toISOString().slice(5, 16).replace("T", " ");

export default async function LeadsReport({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  if (user.username !== OWNER) notFound();
  const sp = await searchParams;
  const days = Math.min(30, Math.max(1, Number(sp.days ?? 3) || 3));
  const since = new Date(Date.now() - days * 86_400_000);

  const [profiles, users, leads, logs, jobs, searches] = await Promise.all([
    db.query.profiles.findMany({ columns: { id: true, label: true, userId: true } }),
    db.query.users.findMany({ columns: { id: true, username: true } }),
    db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), orderBy: desc(schema.leads.createdAt) }),
    db.query.ingestLog.findMany({ where: gte(schema.ingestLog.createdAt, since), orderBy: desc(schema.ingestLog.createdAt) }),
    db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), orderBy: desc(schema.jobs.createdAt), columns: { profileId: true, company: true, title: true, createdAt: true, matchScore: true, status: true } }),
    db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), columns: { profileId: true, cognitionUsed: true, startedAt: true, endedAt: true, jobsWanted: true } }),
  ]);
  const who = new Map(profiles.map((p) => [p.id, `${users.find((u) => u.id === p.userId)?.username ?? "?"} · ${p.label}`]));
  const refused = logs.flatMap((g) =>
    ((g.detail as { url?: string; code?: string; hint?: string }[] | null) ?? [])
      .filter((d) => d.code)
      .map((d) => ({ at: g.createdAt, who: who.get(g.profileId) ?? "?", code: d.code!, url: d.url ?? "", hint: d.hint ?? "" })),
  );
  const cognition = searches.reduce((a, s) => a + Number(s.cognitionUsed ?? 0), 0);
  const notEligible = leads.filter((l) => l.reason === "not_eligible");
  const other = leads.filter((l) => l.reason === "other" || l.reason === "pay");

  const Table = ({ rows, head }: { rows: (string | number)[][]; head: string[] }) => (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2 text-white/80">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const Counts = ({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) => (
    <section className="rounded-3xl bg-surface p-5">
      <h2 className="font-display font-medium text-white">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, n]) => (
          <li key={k} className="flex items-center justify-between gap-4">
            <span className="text-white/75">{k}</span>
            <span className="tabular-nums text-white/50">{n} <span className="text-white/30">· {Math.round((n / Math.max(1, total)) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 text-white">
      <p className="text-sm text-white/45">Owner report</p>
      <h1 className="font-display mt-1 text-3xl font-medium">What the headhunters threw out</h1>
      <p className="mt-2 text-white/55">
        Last {days} {days === 1 ? "day" : "days"}.{" "}
        {[1, 3, 7, 14, 30].map((d) => (
          <Link key={d} href={`/app/admin/leads?days=${d}`} className={`mr-2 underline-offset-2 ${d === days ? "text-white underline" : "text-white/50 hover:text-white"}`}>
            {d}d
          </Link>
        ))}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {[
          ["Searches", searches.length],
          ["Leads opened and dropped", leads.length],
          ["Jobs delivered", jobs.length],
          ["Pushes refused by the app", refused.length],
          ["Cognition spent", cognition],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">{k}</p>
            <p className="font-display mt-1 text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Why the Mind dropped them" total={leads.length} rows={count(leads, (l) => REASON_LABEL[l.reason] ?? l.reason)} />
        <Counts title="Per headhunter" total={leads.length} rows={count(leads, (l) => who.get(l.profileId) ?? "?")} />
        <Counts title='"Not eligible": where the posting was really for' total={notEligible.length} rows={count(notEligible, (l) => bucket(l.note, PLACES))} />
        <Counts title='"Other": what actually happened' total={other.length} rows={count(other, (l) => bucket(l.note, OTHERS))} />
        <Counts title="What the app refused, by code" total={refused.length} rows={count(refused, (r) => r.code)} />
        <Counts title="Jobs delivered, by headhunter" total={jobs.length} rows={count(jobs, (j) => who.get(j.profileId) ?? "?")} />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Every dropped lead ({leads.length})</h2>
      <div className="mt-3">
        <Table head={["When", "Headhunter", "Reason", "Company", "Title", "The Mind's note"]} rows={leads.map((l) => [t(l.createdAt), who.get(l.profileId) ?? "?", REASON_LABEL[l.reason] ?? l.reason, l.company, l.url ? <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2">{l.title}</a> as unknown as string : l.title, l.note ?? ""])} />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Pushes the app refused or adjusted ({refused.length})</h2>
      <p className="mt-1 text-sm text-white/50">Jobs the Mind sent that failed our checks, with the reason it was told.</p>
      <div className="mt-3">
        <Table head={["When", "Headhunter", "Code", "Link", "What it was told"]} rows={refused.map((r) => [t(r.at), r.who, r.code, r.url ? r.url.replace(/^https?:\/\//, "").slice(0, 60) : "", r.hint.slice(0, 220)])} />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Jobs delivered ({jobs.length})</h2>
      <div className="mt-3">
        <Table head={["When", "Headhunter", "Match", "Company", "Title", "Status"]} rows={jobs.map((j) => [t(j.createdAt), who.get(j.profileId) ?? "?", `${Math.round(j.matchScore)}%`, j.company, j.title, j.status])} />
      </div>
    </main>
  );
}
