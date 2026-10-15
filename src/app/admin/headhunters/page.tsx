import Link from "next/link";
import { db } from "@/db";
import { directory, mins, ratio, sortParams, sortRows, sum, when } from "@/lib/admin";
import { postingAgeDays, workSettingLabel } from "@/lib/preferences";
import { FilterForm, PageHead, Select, SortLink, Table, TextInput, UserLink } from "../ui";

const BASE = "/admin/headhunters";
const STATUSES = ["draft", "needs_resume", "needs_preferences", "needs_topup", "hunting", "paused"];

export default async function Headhunters({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "lastSearch");
  const [d, profiles, searches, jobs] = await Promise.all([
    directory(),
    db.query.profiles.findMany({ columns: { id: true, userId: true, label: true, mindName: true, status: true, mindId: true, preferences: true, lastDeliveryAt: true, createdAt: true } }),
    db.query.searches.findMany({ columns: { profileId: true, startedAt: true, endedAt: true, cognitionUsed: true, jobsAdded: true } }),
    db.query.jobs.findMany({ columns: { profileId: true } }),
  ]);

  // One row per headhunter, with its search and job totals folded in.
  let rows = profiles.map((p) => {
    const s = searches.filter((x) => x.profileId === p.id);
    const done = s.filter((x) => x.endedAt);
    const jobsN = jobs.filter((x) => x.profileId === p.id).length;
    const cognition = sum(s, (x) => x.cognitionUsed);
    const pr = p.preferences;
    return {
      ...p,
      user: d.nameOf(p.userId),
      roles: pr?.targetRoles ?? "",
      place: pr ? [pr.city, pr.country].filter(Boolean).join(", ") : "",
      settings: pr ? pr.workSettings.map(workSettingLabel).join(", ") : "",
      perSearch: pr?.jobsPerDay ?? null,
      age: pr ? postingAgeDays(pr) : null,
      searches: s.length,
      jobs: jobsN,
      jobsPerSearch: s.length ? jobsN / s.length : null,
      avgMinutes: done.length ? Math.round(sum(done, (x) => mins(x.startedAt, x.endedAt)) / done.length) : null,
      cognition,
      // Cognition per job from the searches table (jobs_added), as the ledger records it.
      perJob: sum(s, (x) => x.jobsAdded) ? cognition / sum(s, (x) => x.jobsAdded) : null,
      lastSearch: s.map((x) => x.startedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    };
  });
  if (q.status) rows = rows.filter((r) => r.status === q.status);
  if (q.user) rows = rows.filter((r) => r.user.toLowerCase().includes(q.user!.toLowerCase()));
  rows = sortRows(rows, key, dir, {
    user: (r) => r.user,
    label: (r) => r.label,
    mind: (r) => r.mindName,
    status: (r) => r.status,
    roles: (r) => r.roles,
    place: (r) => r.place,
    settings: (r) => r.settings,
    perSearch: (r) => r.perSearch,
    age: (r) => r.age,
    searches: (r) => r.searches,
    jobs: (r) => r.jobs,
    jobsPerSearch: (r) => r.jobsPerSearch,
    avgMinutes: (r) => r.avgMinutes,
    perJob: (r) => r.perJob,
    lastSearch: (r) => r.lastSearch,
    lastDelivery: (r) => r.lastDeliveryAt,
    created: (r) => r.createdAt,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Headhunters" title={`${rows.length} headhunters`}>
        <p className="mt-2 text-sm text-white/55">
          {profiles.filter((p) => p.mindId).length} deployed, {profiles.filter((p) => p.status === "hunting").length} hunting, {profiles.filter((p) => p.status === "paused").length} paused.
        </p>
      </PageHead>
      <div className="mt-4">
        <FilterForm q={q}>
          <TextInput name="user" value={q.user} placeholder="User" size={14} />
          <Select name="status" value={q.status} blank="Any status" options={STATUSES.map((s) => [s, s.replace(/_/g, " ")])} />
          {(q.status || q.user) && <Link href={BASE} className="py-1.5 text-white/50 hover:text-white">Clear</Link>}
        </FilterForm>
      </div>
      <div className="mt-4">
        <Table
          head={[
            col("user", "User"), col("label", "Label"), col("mind", "Mind name"), col("status", "Status"), col("roles", "Roles"), col("place", "Place"), col("settings", "Work settings"),
            col("perSearch", "Jobs / search"), col("age", "Posting age"), col("searches", "Searches"), col("jobs", "Jobs"), col("jobsPerSearch", "Jobs per search"),
            col("avgMinutes", "Avg min / search"), col("perJob", "Cognition / job"), col("lastSearch", "Last search"), col("lastDelivery", "Last delivery"),
          ]}
          rows={rows.map((r) => [
            <UserLink key={r.id} id={r.userId} name={r.user} />,
            r.label,
            r.mindName ?? "",
            r.status.replace(/_/g, " "),
            <span key="r" className="block max-w-56 truncate" title={r.roles}>{r.roles}</span>,
            r.place,
            r.settings,
            r.perSearch ?? "",
            r.age ? `${r.age}d` : "",
            r.searches ? <Link key="s" href={`/admin/searches?days=365&user=${encodeURIComponent(r.user)}`} className="underline decoration-white/20 underline-offset-2">{r.searches}</Link> : 0,
            r.jobs ? <Link key="j" href={`/admin/jobs?days=365&user=${encodeURIComponent(r.user)}`} className="underline decoration-white/20 underline-offset-2">{r.jobs}</Link> : 0,
            r.jobsPerSearch != null ? ratio(r.jobs, r.searches) : "",
            r.avgMinutes ?? "",
            r.perJob != null ? Math.round(r.perJob) : "",
            when(r.lastSearch),
            when(r.lastDeliveryAt),
          ])}
        />
      </div>
    </main>
  );
}
