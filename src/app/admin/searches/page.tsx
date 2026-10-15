import { and, desc, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, mins, when } from "@/lib/admin";
import { DaysPicker, Stat, Table, daysParam } from "../ui";

export default async function Searches({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = daysParam(await searchParams, 14);
  const since = daysAgo(days);
  const [searches, profiles, users, jobs, leads] = await Promise.all([
    db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), orderBy: desc(schema.searches.startedAt) }),
    db.query.profiles.findMany({ columns: { id: true, userId: true, label: true } }),
    db.query.users.findMany({ columns: { id: true, username: true } }),
    db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), columns: { profileId: true, createdAt: true } }),
    db.query.leads.findMany({ where: and(gte(schema.leads.createdAt, since), lte(schema.leads.createdAt, new Date())), columns: { profileId: true, createdAt: true } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.username ?? "?"]));
  const who = new Map(profiles.map((p) => [p.id, `${name.get(p.userId)} · ${p.label}`]));
  const inWindow = (list: { profileId: string; createdAt: Date }[], s: (typeof searches)[number]) =>
    list.filter((x) => x.profileId === s.profileId && x.createdAt >= s.startedAt && x.createdAt <= (s.endedAt ?? new Date())).length;
  const done = searches.filter((s) => s.endedAt);
  const totalMin = done.reduce((a, s) => a + (mins(s.startedAt, s.endedAt) ?? 0), 0);
  const totalJobs = searches.reduce((a, s) => a + inWindow(jobs, s), 0);
  const totalCog = searches.reduce((a, s) => a + Number(s.cognitionUsed ?? 0), 0);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Searches</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{searches.length} searches</h1>
      <div className="mt-2"><DaysPicker days={days} base="/admin/searches" /></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Average length" value={done.length ? `${Math.round(totalMin / done.length)} min` : "–"} />
        <Stat label="Jobs per search" value={searches.length ? (totalJobs / searches.length).toFixed(1) : "–"} />
        <Stat label="Cognition per search" value={searches.length ? Math.round(totalCog / searches.length) : "–"} />
        <Stat label="Cognition per job" value={totalJobs ? Math.round(totalCog / totalJobs) : "–"} />
      </div>
      <div className="mt-6">
        <Table
          head={["Started", "Who", "Asked", "Delivered", "Leads dropped", "Cognition", "Took", "Ended because", "Focus"]}
          rows={searches.map((s) => {
            const m = mins(s.startedAt, s.endedAt);
            return [when(s.startedAt), who.get(s.profileId) ?? "?", s.jobsWanted, inWindow(jobs, s), inWindow(leads, s), s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "", m ? `${m} min` : "running", s.endReason ?? (s.endedAt ? "" : "open"), s.focus ?? ""];
          })}
        />
      </div>
    </main>
  );
}
