import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKeys, daysAgo, directory, median, perDay, ratio, sortParams, sortRows, sum } from "@/lib/admin";
import { COGNITION_USD } from "@/lib/preferences";
import { BarChart, Card, DaysPicker, PageHead, SortLink, Stat, Table, UserLink, daysParam } from "../ui";

const BASE = "/admin/costs";

// What the headhunters spend. Cognition comes from Hello Minds' ledger, read once when a
// search ends (lib/search recordEnd), so open searches show nothing yet.
export default async function Costs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 30);
  const since = daysAgo(days);
  const { key, dir } = sortParams(q, "cognition");
  const [d, searches] = await Promise.all([directory(), db.query.searches.findMany({ where: gte(schema.searches.startedAt, since), orderBy: desc(schema.searches.startedAt) })]);
  const { userOfProfile, nameOf } = d;

  const costed = searches.filter((s) => s.cognitionUsed != null);
  const cognition = sum(costed, (s) => s.cognitionUsed);
  const jobs = sum(searches, (s) => s.jobsAdded);
  const keys = dayKeys(days);
  const perDayCog = perDay(costed, keys, (s) => s.endedAt ?? s.startedAt, (s) => Number(s.cognitionUsed));

  // Per user.
  const perUser = [...new Set(searches.map((s) => userOfProfile(s.profileId)).filter((x): x is string => !!x))].map((uid) => {
    const mine = searches.filter((s) => userOfProfile(s.profileId) === uid);
    const cog = sum(mine, (s) => s.cognitionUsed);
    const j = sum(mine, (s) => s.jobsAdded);
    return { uid, name: nameOf(uid), searches: mine.length, jobs: j, cognition: Math.round(cog), perJob: j ? cog / j : null, perSearch: mine.length ? cog / mine.length : null };
  });
  const rows = sortRows(perUser, key, dir, {
    name: (r) => r.name,
    searches: (r) => r.searches,
    jobs: (r) => r.jobs,
    cognition: (r) => r.cognition,
    perJob: (r) => r.perJob,
    perSearch: (r) => r.perSearch,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  // Distribution of cost per search.
  const costs = costed.map((s) => Number(s.cognitionUsed)).sort((a, b) => a - b);
  const med = median(costs);
  const usd = (c: number) => `$${(c * COGNITION_USD).toFixed(2)}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Costs" title="Cognition spent by headhunters">
        <div className="mt-2"><DaysPicker days={days} base={BASE} q={q} /></div>
        <p className="mt-2 text-sm text-white/55">
          Cognition is read from the Mind&apos;s ledger on Hello Minds when a search ends, so searches still running show nothing yet. Dollar figures use the current rate of {usd(1)} per unit.
        </p>
      </PageHead>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Cognition" value={Math.round(cognition)} hint={usd(cognition)} />
        <Stat label="Searches" value={searches.length} hint={`${costed.length} with a cost recorded`} />
        <Stat label="Jobs delivered" value={jobs} />
        <Stat label="Per search" value={costed.length ? Math.round(cognition / costed.length) : "–"} hint={costed.length ? usd(cognition / costed.length) : undefined} />
        <Stat label="Per job" value={jobs ? Math.round(cognition / jobs) : "–"} hint={jobs ? usd(cognition / jobs) : undefined} />
        <Stat label="Per day" value={Math.round(cognition / (days + 1))} hint={usd(cognition / (days + 1))} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <BarChart title="Cognition per day (by search end)" keys={keys} series={[{ label: "Cognition", values: perDayCog, color: "text-amber-400" }]} height={170} />
        </Card>
        <Card title="Cost per search" hint={`${costs.length} finished searches with a cost.`}>
          {costs.length ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Min", costs[0]],
                ["Median", med ?? 0],
                ["Max", costs[costs.length - 1]],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/[0.04] p-3">
                  <dt className="text-xs uppercase tracking-wide text-white/45">{k}</dt>
                  <dd className="font-display mt-1 text-xl">{Math.round(Number(v))}</dd>
                  <dd className="text-xs text-white/40">{usd(Number(v))}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-white/40">No finished searches in this window.</p>
          )}
          {costs.length > 0 && (
            <p className="mt-3 text-xs text-white/40">
              {costs.filter((c) => c === 0).length} searches recorded zero cognition (the Mind did nothing, or the ledger was empty).
            </p>
          )}
        </Card>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Per user</h2>
      <div className="mt-3">
        <Table
          head={[col("name", "User"), col("searches", "Searches"), col("jobs", "Jobs"), col("cognition", "Cognition"), col("perJob", "Per job"), col("perSearch", "Per search"), "Cost"]}
          rows={rows.map((r) => [<UserLink key={r.uid} id={r.uid} name={r.name} />, r.searches, r.jobs, r.cognition, r.perJob != null ? Math.round(r.perJob) : "–", r.perSearch != null ? Math.round(r.perSearch) : "–", usd(r.cognition)])}
          empty="No searches in this window."
        />
      </div>
      <p className="mt-2 text-xs text-white/40">Jobs here are the searches&apos; own counts (jobs added by the end of each search); the Jobs page counts by delivery time. Jobs per search overall: {ratio(jobs, searches.length)}.</p>
    </main>
  );
}
