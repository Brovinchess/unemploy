import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, tally, when } from "@/lib/admin";
import { Counts, DaysPicker, Table, daysParam } from "../ui";

export default async function Jobs({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = daysParam(await searchParams, 14);
  const since = daysAgo(days);
  const [jobs, profiles, users] = await Promise.all([
    db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), orderBy: desc(schema.jobs.createdAt) }),
    db.query.profiles.findMany({ columns: { id: true, userId: true, label: true } }),
    db.query.users.findMany({ columns: { id: true, username: true } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.username ?? "?"]));
  const who = new Map(profiles.map((p) => [p.id, `${name.get(p.userId)} · ${p.label}`]));
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Jobs</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{jobs.length} jobs delivered</h1>
      <div className="mt-2"><DaysPicker days={days} base="/admin/jobs" /></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Counts title="Stage" total={jobs.length} rows={tally(jobs, (j) => j.status)} />
        <Counts title="Work setting" total={jobs.length} rows={tally(jobs, (j) => j.workSetting ?? "unknown")} />
        <Counts title="Where the link lives" total={jobs.length} rows={tally(jobs, (j) => host(j.url)).slice(0, 10)} />
      </div>
      <div className="mt-6">
        <Table
          head={["When", "Who", "Match", "Company", "Title", "Place", "Stage", "Link"]}
          rows={jobs.map((j) => [when(j.createdAt), who.get(j.profileId) ?? "?", `${Math.round(j.matchScore)}%`, j.company, j.title, [j.city, j.country].filter(Boolean).join(", "), j.status, <a key={j.id} href={j.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2">{host(j.url)}</a>])}
        />
      </div>
    </main>
  );
}
