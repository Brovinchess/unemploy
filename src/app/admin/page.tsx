import Link from "next/link";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPLIED_PLUS, KEPT, WAITING_QUESTION, dayKeys, daysAgo, directory, hoursAgo, mins, perDay, pct, stageLabel, sum, tally, when } from "@/lib/admin";
import { DROP_LABELS } from "@/lib/dropped";
import { Alerts, Badge, BarChart, CHART, Card, Counts, DaysPicker, Funnel, GroupLabel, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, daysParam, endTone } from "./ui";

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 7);
  const since = daysAgo(days);
  const now = daysAgo(0);
  const [dir, fullProfiles, allSearches, allJobs, leads, tokens, pushes24h, questions] = await Promise.all([
    directory(),
    db.query.profiles.findMany({ columns: { id: true, userId: true, resumeFileName: true, preferences: true, mindId: true, status: true } }),
    db.query.searches.findMany({ orderBy: desc(schema.searches.startedAt) }),
    db.query.jobs.findMany({ columns: { id: true, status: true, profileId: true, createdAt: true } }),
    db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), columns: { reason: true } }),
    db.query.extensionTokens.findMany({ columns: { userId: true } }),
    db.query.ingestLog.findMany({ where: gte(schema.ingestLog.createdAt, daysAgo(1)), columns: { rejected: true, dryRun: true } }),
    db.query.questions.findMany({ columns: { userId: true, status: true, createdAt: true } }),
  ]);
  const { users, profiles, who, userOfProfile } = dir;

  // Window slices.
  const searches = allSearches.filter((s) => s.startedAt >= since);
  const jobs = allJobs.filter((j) => j.createdAt >= since);
  const newUsers = users.filter((u) => u.createdAt >= since);
  const cognition = sum(searches, (s) => s.cognitionUsed);
  const activeUsers = new Set(searches.map((s) => userOfProfile(s.profileId))).size;

  // All time.
  const deployed = profiles.filter((p) => p.mindId);
  const live = profiles.filter((p) => p.status === "hunting" || p.status === "paused");
  const searchingNow = profiles.filter((p) => p.searchStartedAt && !p.searchEndedAt);

  // Funnel: how many accounts reached each setup step, in order. A step counts any of the
  // person's headhunters; later steps come from their searches and jobs.
  const byUser = <T,>(rows: T[], uid: (r: T) => string | undefined) => new Set(rows.map(uid).filter(Boolean));
  const withResume = byUser(fullProfiles.filter((p) => p.resumeFileName), (p) => p.userId);
  const withPrefs = byUser(fullProfiles.filter((p) => p.preferences), (p) => p.userId);
  const withMind = byUser(fullProfiles.filter((p) => p.mindId), (p) => p.userId);
  const searched = byUser(allSearches, (s) => userOfProfile(s.profileId));
  const gotJob = byUser(allJobs, (j) => userOfProfile(j.profileId));
  const kept = byUser(allJobs.filter((j) => KEPT.has(j.status)), (j) => userOfProfile(j.profileId));
  const applied = byUser(allJobs.filter((j) => APPLIED_PLUS.has(j.status)), (j) => userOfProfile(j.profileId));
  const funnel = [
    { label: "Signed up", count: users.length, href: "/admin/users" },
    { label: "Chose a name", count: users.filter((u) => u.username).length },
    { label: "Uploaded a resume", count: withResume.size },
    { label: "Set preferences", count: withPrefs.size },
    { label: "Deployed a headhunter", count: withMind.size, href: "/admin/users?deployed=1" },
    { label: "Ran a search", count: searched.size, href: "/admin/searches" },
    { label: "Got a job", count: gotJob.size, href: "/admin/jobs" },
    { label: "Kept a job", count: kept.size },
    { label: "Applied", count: applied.size, href: "/admin/applications" },
  ];

  // Per-day trend for the window.
  const keys = dayKeys(days);
  const trend = {
    signups: perDay(newUsers, keys, (u) => u.createdAt),
    searches: perDay(searches, keys, (s) => s.startedAt),
    jobs: perDay(jobs, keys, (j) => j.createdAt),
    cognition: perDay(searches, keys, (s) => s.endedAt ?? s.startedAt, (s) => Number(s.cognitionUsed ?? 0)),
  };

  // Alerts.
  const stuck = allSearches.filter((s) => !s.endedAt && s.startedAt < hoursAgo(2));
  const empty = searches.filter((s) => s.endedAt && (s.jobsAdded ?? 0) === 0);
  const neverSearched = [...withMind].filter((uid) => !searched.has(uid));
  const keptNothing = [...searched].filter((uid) => !kept.has(uid));
  const refused24h = sum(pushes24h.filter((p) => !p.dryRun), (p) => p.rejected);
  const paused = profiles.filter((p) => p.status === "paused");
  const oldQuestions = questions.filter((x) => WAITING_QUESTION.has(x.status) && x.createdAt < daysAgo(7));
  const alerts = [
    { label: "Searches open for more than 2 hours", count: stuck.length, href: "/admin/searches?open=1", hint: stuck.slice(0, 3).map((s) => who(s.profileId)).join(", ") },
    { label: `Searches that ended with no jobs (last ${days} days)`, count: empty.length, href: `/admin/searches?days=${days}&empty=1` },
    { label: "Deployed a headhunter but never searched", count: neverSearched.length, href: "/admin/users?idle=1" },
    { label: "Searched but kept nothing", count: keptNothing.length, href: "/admin/users?nokeep=1" },
    { label: "Jobs refused by the app, last 24 hours", count: refused24h, href: "/admin/quality?days=1" },
    { label: "Headhunters paused", count: paused.length, href: "/admin/headhunters?status=paused" },
    { label: "Questions waiting on people for over a week", count: oldQuestions.length, href: "/admin/applications", hint: `${new Set(oldQuestions.map((x) => x.userId)).size} people` },
  ];

  return (
    <Page>
      <PageHead section="Overview" title="Career Ninja at a glance" description="What happened, what needs a look, and how people move through setup." controls={<DaysPicker days={days} base="/admin" />} />

      <GroupLabel>All time</GroupLabel>
      <Tiles cols={5} className="mt-2">
        <Stat label="Accounts" value={users.length} href="/admin/users" />
        <Stat label="Headhunters deployed" value={deployed.length} hint={`${live.length} live, ${searchingNow.length} searching now`} href="/admin/headhunters" />
        <Stat label="Jobs ever delivered" value={allJobs.length} hint={`${allJobs.filter((j) => APPLIED_PLUS.has(j.status)).length} applied or further`} href="/admin/jobs?days=365" />
        <Stat label="Extension connected" value={new Set(tokens.map((t) => t.userId)).size} hint="accounts" />
        <Stat label="Email verified" value={users.filter((u) => u.emailVerifiedAt).length} hint="accounts" />
      </Tiles>

      <GroupLabel>Last {days} days</GroupLabel>
      <Tiles cols={6} className="mt-2">
        <Stat label="New accounts" value={newUsers.length} hint={`${newUsers.filter((u) => u.referredBy).length} referred`} href={`/admin/growth?days=${days}`} />
        <Stat label="Active users" value={activeUsers} hint="ran a search" href={`/admin/users?active=${days}`} />
        <Stat label="Searches" value={searches.length} hint={`${searches.filter((s) => !s.endedAt).length} still open`} href={`/admin/searches?days=${days}`} />
        <Stat label="Jobs delivered" value={jobs.length} hint={`${jobs.filter((j) => KEPT.has(j.status)).length} kept`} href={`/admin/jobs?days=${days}`} />
        <Stat label="Leads dropped" value={leads.length} hint={jobs.length ? `${Math.round(leads.length / jobs.length)} per job` : undefined} href={`/admin/quality?days=${days}`} />
        <Stat label="Cognition" value={Math.round(cognition)} hint={jobs.length && cognition ? `about ${Math.round(cognition / jobs.length)} per job` : undefined} href={`/admin/costs?days=${days}`} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Onboarding funnel" hint="All accounts. Each step shows the share of the step before." className="rise rise-1">
          <Funnel steps={funnel} />
        </Card>
        <Card title="Needs a look" hint="Live checks; each line opens the page to act on." className="rise rise-2">
          <Alerts items={alerts} />
        </Card>
      </div>

      <SectionTitle title={`Per day, last ${days} days`} />
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Card><BarChart title="Signups" keys={keys} series={[{ label: "Signups", values: trend.signups, color: CHART.coral }]} /></Card>
        <Card><BarChart title="Searches started" keys={keys} series={[{ label: "Searches", values: trend.searches, color: CHART.teal }]} /></Card>
        <Card><BarChart title="Jobs delivered" keys={keys} series={[{ label: "Jobs", values: trend.jobs, color: CHART.slate }]} /></Card>
        <Card><BarChart title="Cognition used (by search end)" keys={keys} series={[{ label: "Cognition", values: trend.cognition, color: CHART.amber }]} /></Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Jobs by what the person did" total={jobs.length} rows={tally(jobs, (j) => stageLabel(j.status))} />
        <Counts title="Why leads were dropped" total={leads.length} rows={tally(leads, (l) => DROP_LABELS[l.reason] ?? l.reason)} />
      </div>

      <SectionTitle
        title="Recent searches"
        hint={
          <>
            <Link href={`/admin/searches?days=${days}`} className="underline underline-offset-2 hover:text-white">All searches</Link> · {pct(searches.filter((s) => (s.jobsAdded ?? 0) > 0).length, searches.filter((s) => s.endedAt).length)} of finished searches delivered at least one job.
          </>
        }
      />
      <div className="mt-3">
        <Table
          head={["Started", "Who", "Asked", "Got", "Cognition", "Took", "Ended"]}
          empty="No searches in this window."
          emptyMood="sleeping"
          rows={searches.slice(0, 15).map((s) => {
            const m = mins(s.startedAt, s.endedAt);
            return [
              <Link key={s.id} href={`/admin/searches/${s.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{when(s.startedAt)}</Link>,
              <UserLink key="u" id={userOfProfile(s.profileId)} name={who(s.profileId)} />,
              s.jobsWanted,
              s.jobsAdded ?? (s.endedAt ? 0 : "…"),
              s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
              m ? `${m} min` : `running, ${mins(s.startedAt, now)} min so far`,
              <Badge key="e" tone={endTone(s.endReason, !s.endedAt)}>{s.endReason ?? (s.endedAt ? "ended" : "open")}</Badge>,
            ];
          })}
        />
      </div>
    </Page>
  );
}
