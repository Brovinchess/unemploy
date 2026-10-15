import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, mins, tally, when } from "@/lib/admin";
import { Counts, DaysPicker, Stat, Table, daysParam } from "./ui";

export default async function Overview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = daysParam(await searchParams, 7);
  const since = daysAgo(days);
  const [users, profiles, searches, jobs, leads, tokens, allJobs] = await Promise.all([
    db.query.users.findMany({ columns: { id: true, username: true, createdAt: true, emailVerifiedAt: true, referredBy: true } }),
    db.query.profiles.findMany({ columns: { id: true, userId: true, label: true, status: true, mindId: true, createdAt: true, searchStartedAt: true, searchEndedAt: true } }),
    db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), orderBy: desc(schema.searches.startedAt) }),
    db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), columns: { id: true, status: true, profileId: true } }),
    db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), columns: { reason: true } }),
    db.query.extensionTokens.findMany({ columns: { userId: true, lastUsedAt: true } }),
    db.query.jobs.findMany({ columns: { status: true } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.username ?? "?"]));
  const who = new Map(profiles.map((p) => [p.id, `${name.get(p.userId)} · ${p.label}`]));
  const newUsers = users.filter((u) => u.createdAt >= since);
  const deployed = profiles.filter((p) => p.mindId);
  const live = profiles.filter((p) => p.status === "hunting" || p.status === "paused");
  const searchingNow = profiles.filter((p) => p.searchStartedAt && !p.searchEndedAt);
  const cognition = searches.reduce((a, s) => a + Number(s.cognitionUsed ?? 0), 0);
  const perJob = jobs.length ? Math.round(cognition / jobs.length) : 0;
  const activeUsers = new Set(searches.map((s) => profiles.find((p) => p.id === s.profileId)?.userId)).size;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Overview</p>
      <h1 className="font-display mt-1 text-3xl font-medium">Career Ninja at a glance</h1>
      <div className="mt-2"><DaysPicker days={days} base="/admin" /></div>

      <h2 className="mt-8 text-xs uppercase tracking-wide text-white/45">All time</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Accounts" value={users.length} />
        <Stat label="Headhunters deployed" value={deployed.length} hint={`${live.length} live, ${searchingNow.length} searching now`} />
        <Stat label="Jobs ever delivered" value={allJobs.length} hint={`${allJobs.filter((j) => ["applied", "heard_back", "interview", "offer"].includes(j.status)).length} applied or further`} />
        <Stat label="Extension connected" value={new Set(tokens.map((t) => t.userId)).size} hint="accounts" />
        <Stat label="Email verified" value={users.filter((u) => u.emailVerifiedAt).length} hint="accounts" />
      </div>

      <h2 className="mt-8 text-xs uppercase tracking-wide text-white/45">Last {days} days</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="New accounts" value={newUsers.length} hint={`${newUsers.filter((u) => u.referredBy).length} referred`} />
        <Stat label="Active users" value={activeUsers} hint="ran a search" />
        <Stat label="Searches" value={searches.length} hint={`${searches.filter((s) => !s.endedAt).length} still open`} />
        <Stat label="Jobs delivered" value={jobs.length} hint={`${jobs.filter((j) => j.status === "saved" || ["applied", "heard_back", "interview", "offer"].includes(j.status)).length} kept`} />
        <Stat label="Leads dropped" value={leads.length} hint={jobs.length ? `${Math.round(leads.length / jobs.length)} per job` : undefined} />
        <Stat label="Cognition" value={Math.round(cognition)} hint={perJob ? `about ${perJob} per job` : undefined} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Jobs by what the person did" total={jobs.length} rows={tally(jobs, (j) => j.status)} />
        <Counts title="Why leads were dropped" total={leads.length} rows={tally(leads, (l) => l.reason)} />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Recent searches</h2>
      <div className="mt-3">
        <Table
          head={["Started", "Who", "Asked", "Got", "Cognition", "Took", "Ended"]}
          rows={searches.slice(0, 25).map((s) => {
            const m = mins(s.startedAt, s.endedAt);
            return [when(s.startedAt), who.get(s.profileId) ?? "?", s.jobsWanted, s.jobsAdded ?? (s.endedAt ? 0 : "…"), s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "", m ? `${m} min` : "running", s.endReason ?? (s.endedAt ? "" : "open")];
          })}
        />
      </div>
    </main>
  );
}
