import Link from "next/link";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, directory, mins, ratio, sortParams, sortRows, sum, when } from "@/lib/admin";
import { Cap, Check, DaysPicker, FilterForm, PageHead, SortLink, Stat, Table, TextInput, UserLink, daysParam } from "../ui";

const BASE = "/admin/searches";
const MAX_ROWS = 500;

export default async function Searches({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 14);
  const since = daysAgo(days);
  const now = daysAgo(0);
  const { key, dir } = sortParams(q, "started");
  const [d, searches, jobs, leads] = await Promise.all([
    directory(),
    db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), orderBy: desc(schema.searches.startedAt) }),
    db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), columns: { profileId: true, createdAt: true } }),
    db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), columns: { profileId: true, createdAt: true } }),
  ]);
  // Jobs and leads belong to a search when they arrived between its start and its end.
  const inWindow = (list: { profileId: string; createdAt: Date }[], s: (typeof searches)[number]) =>
    list.filter((x) => x.profileId === s.profileId && x.createdAt >= s.startedAt && x.createdAt <= (s.endedAt ?? now)).length;

  let rows = searches.map((s) => ({
    ...s,
    who: d.who(s.profileId),
    userId: d.userOfProfile(s.profileId),
    delivered: inWindow(jobs, s),
    dropped: inWindow(leads, s),
    minutes: mins(s.startedAt, s.endedAt ?? now),
  }));
  const user = d.userByName(q.user);
  if (q.user) rows = user ? rows.filter((r) => r.userId === user.id) : [];
  if (q.open) rows = rows.filter((r) => !r.endedAt);
  if (q.empty) rows = rows.filter((r) => r.endedAt && (r.jobsAdded ?? 0) === 0);
  rows = sortRows(rows, key, dir, {
    started: (r) => r.startedAt,
    who: (r) => r.who,
    wanted: (r) => r.jobsWanted,
    delivered: (r) => r.delivered,
    dropped: (r) => r.dropped,
    cognition: (r) => r.cognitionUsed,
    minutes: (r) => r.minutes,
    ended: (r) => r.endReason ?? (r.endedAt ? "" : "open"),
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  const done = rows.filter((s) => s.endedAt);
  const totalMin = sum(done, (s) => s.minutes);
  const totalJobs = sum(rows, (s) => s.delivered);
  const totalCog = sum(rows, (s) => s.cognitionUsed);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Searches" title={`${rows.length} searches`}>
        <div className="mt-2"><DaysPicker days={days} base={BASE} q={q} /></div>
      </PageHead>
      <div className="mt-4">
        <FilterForm q={q}>
          <TextInput name="user" value={q.user} placeholder="Username" size={14} />
          <Check name="open" checked={!!q.open} label="Still open" />
          <Check name="empty" checked={!!q.empty} label="Ended with no jobs" />
          {(q.user || q.open || q.empty) && <Link href={`${BASE}?days=${days}`} className="py-1.5 text-white/50 hover:text-white">Clear</Link>}
        </FilterForm>
        {q.user && !user && <p className="mt-2 text-sm text-coral">No user called “{q.user}”.</p>}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Average length" value={done.length ? `${Math.round(totalMin / done.length)} min` : "–"} />
        <Stat label="Jobs per search" value={ratio(totalJobs, rows.length)} />
        <Stat label="Cognition per search" value={rows.length ? Math.round(totalCog / rows.length) : "–"} />
        <Stat label="Cognition per job" value={totalJobs ? Math.round(totalCog / totalJobs) : "–"} />
      </div>
      <div className="mt-6">
        <Table
          head={[col("started", "Started"), col("who", "Who"), col("wanted", "Asked"), col("delivered", "Delivered"), col("dropped", "Leads dropped"), col("cognition", "Cognition"), col("minutes", "Took"), col("ended", "Ended because"), "Focus"]}
          rows={rows.slice(0, MAX_ROWS).map((s) => [
            <Link key={s.id} href={`/admin/searches/${s.id}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">{when(s.startedAt)}</Link>,
            <UserLink key="u" id={s.userId} name={s.who} />,
            s.jobsWanted,
            s.delivered,
            s.dropped,
            s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
            s.endedAt ? `${s.minutes} min` : `running, ${s.minutes} min`,
            s.endReason ?? (s.endedAt ? "" : "open"),
            s.focus ?? "",
          ])}
        />
        <Cap shown={MAX_ROWS} total={rows.length} />
      </div>
    </main>
  );
}
