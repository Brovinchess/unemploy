import { and, count, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DropReason } from "@/db/schema";
import { ResumeStep } from "@/app/profiles/[id]/setup/resume-step";
import { RemoveHeadhunter } from "@/app/app/settings/remove-headhunter";
import { RenameHeadhunter } from "@/app/app/settings/rename-headhunter";
import { ActivityPanel } from "@/components/activity-feed";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CompanyLogo } from "@/components/company-logo";
import { PauseToggle } from "@/components/pause-toggle";
import { PreferencesChat } from "@/components/preferences-chat";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { SearchButton } from "@/components/search-button";
import { MorningSearch } from "@/components/morning-search";
import { MochiAtWork, SearchingLine } from "@/components/searching-status";
import { appContext, balanceFor } from "@/lib/app-context";
import { coachFor } from "@/lib/coach-ui";
import { searchOutcome } from "@/lib/outcome";
import { SearchOutcome } from "@/components/search-outcome";
import { costModel } from "@/lib/cost";
import { DROP_LABELS, dropAdvice } from "@/lib/dropped";
import { topUpUrlFor } from "@/lib/minds/config";
import { AUTO_SEARCH_DAYS, extraPlacesText, postingAgeDays, workSettingLabel } from "@/lib/preferences";
import { isSearching } from "@/lib/search";

const took = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`);
const when = (d: Date, tz?: string | null) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz || "UTC" });
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  saved: "To apply",
  applied: "Applied",
  heard_back: "Heard back",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  skipped: "Dismissed",
  expired: "Closed",
};

// One headhunter: who it is and what it's after, what it has delivered, how the last search
// went in a sentence, then its settings and resume. History and the live log sit behind a link.
export default async function Headhunter({ params }: PageProps<"/app/headhunters/[id]">) {
  const { id } = await params;
  const { user, profiles, unfinished, current } = await appContext(id);
  const [balance, cost, history, byStatus] = await Promise.all([
    balanceFor(user, current),
    costModel(current.id),
    db.query.searches.findMany({ where: eq(schema.searches.profileId, current.id), orderBy: desc(schema.searches.startedAt), limit: 3 }),
    db.select({ status: schema.jobs.status, n: count() }).from(schema.jobs).where(eq(schema.jobs.profileId, current.id)).groupBy(schema.jobs.status),
  ]);
  const searching = isSearching(current);
  const paused = current.status === "paused";
  const coach = user.coachReminders ? await coachFor(current) : null;
  const outcome = await searchOutcome(current, { topUpUrl: topUpUrlFor(current.mindId) });
  const prefs = current.preferences;
  const perSearch = prefs?.jobsPerDay ?? 5;

  // Results over all time.
  const n = (...s: string[]) => byStatus.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const found = byStatus.reduce((a, r) => a + r.n, 0);
  const results = [
    { label: "found", n: found },
    { label: "to apply", n: n("saved") },
    { label: "applied", n: n("applied", "heard_back") },
    { label: "interviews", n: n("interview") },
    { label: "offers", n: n("offer") },
  ];

  // The last finished search, as a sentence: outcome, the main reason leads were dropped, the fix.
  const last = history.find((s) => s.endedAt);
  let lastLine: { why: string | null; fix: string | null } | null = null;
  const lastJobs = last
    ? await db.query.jobs.findMany({
        where: and(eq(schema.jobs.profileId, current.id), gte(schema.jobs.createdAt, last.startedAt)),
        orderBy: desc(schema.jobs.matchScore),
        columns: { id: true, title: true, company: true, companyDomain: true, matchScore: true, status: true, city: true, country: true, workSetting: true },
      })
    : [];
  if (last?.endedAt) {
    const drops = await db.query.leads.findMany({
      where: and(eq(schema.leads.profileId, current.id), gte(schema.leads.createdAt, last.startedAt)),
      columns: { reason: true },
    });
    const counts = new Map<DropReason, number>();
    for (const d of drops) {
      const r: DropReason = d.reason === "pay" ? "other" : d.reason;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const top = [...counts.entries()].filter(([r]) => r !== "other").sort((a, b) => b[1] - a[1])[0];
    const why = top && drops.length >= 5 && top[1] / drops.length >= 0.3 ? `${Math.round((top[1] / drops.length) * 100)}% of what it checked was ${DROP_LABELS[top[0]]}.` : null;
    const remoteOnly = (prefs?.workSettings ?? []).every((w) => w === "remote");
    const fix = coach?.suggestions[0]?.text ?? (prefs ? dropAdvice(counts, drops.length, prefs.city || prefs.country, remoteOnly, postingAgeDays(prefs)) : null);
    lastLine = { why, fix };
  }

  const lookingFor = prefs
    ? [prefs.targetRoles, `${prefs.city || prefs.country}${prefs.extraPlaces?.length ? `, also ${extraPlacesText(prefs)}` : ""}`, prefs.workSettings.map(workSettingLabel).join(", ").toLowerCase(), prefs.jobTypes.join(", ").toLowerCase()].filter(Boolean).join(" · ")
    : null;

  return (
    <AppShell tab="headhunter" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {/* Who it is, what it's after, and the one action. Mochi sits on a radar that sweeps while it searches. */}
        <section className="rise flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-surface p-6 sm:p-8">
          <div className="flex min-w-0 max-w-full items-center gap-5">
            <MochiAtWork live={searching} paused={paused} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/45">Headhunter</p>
              <h1 className="font-display mt-0.5 text-3xl font-medium tracking-tight text-white">
                <RenameHeadhunter profileId={current.id} label={current.label} />
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
                <span className="font-mono">{current.mindName}</span>
                <span className="text-white/25">·</span>
                <span className={searching ? "text-coral" : paused ? "text-white/40" : "text-white/70"}>{searching ? "Searching now" : paused ? "Paused" : "Ready"}</span>
              </p>
              {searching && <SearchingLine profileId={current.id} />}
              {current.autoSearchJobs != null && !searching && (
                <p className="mt-1 text-sm text-white/55">
                  <a href="#morning" className="hover:text-white">
                    Morning searches on · {current.autoSearchJobs} {current.autoSearchJobs === 1 ? "job" : "jobs"} {AUTO_SEARCH_DAYS.find((d) => d.value === current.autoSearchDays)?.short ?? "every day"} at 9am
                  </a>
                </p>
              )}
              {lookingFor && (
                <p className="mt-2 max-w-xl truncate text-sm text-white/55" title={lookingFor}>
                  Looking for <span className="text-white/80">{lookingFor}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <SearchButton
              profileId={current.id}
              searching={searching}
              startedAt={current.searchStartedAt?.toISOString() ?? null}
              defaultJobs={perSearch}
              balance={balance}
              notifyEmail={user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null}
              disabled={paused ? "Resume this headhunter to search" : balance != null && balance <= 0 ? "Top up to search" : undefined}
              perJob={cost.perJob}
      extraPlaces={current.preferences?.extraPlaces?.length ?? 0}
              coach={coach}
              topUpUrl={topUpUrlFor(current.mindId)}
            />
          </div>
        </section>

        {/* What it has delivered, and what that cost. */}
        <section className="rise rise-1 mt-6 rounded-3xl bg-surface p-6 sm:p-8">
          <h2 className="font-display text-lg font-medium text-white">Results</h2>
          {found === 0 ? (
            <p className="mt-3 text-sm text-white/45">Nothing yet. Its first search fills this in.</p>
          ) : (
            <dl className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
              {results.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-white/40">{r.label}</dt>
                  <dd className={`font-display mt-1 text-3xl font-medium tabular-nums ${r.n ? "text-white" : "text-white/30"}`}>{r.n}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* The last search in a sentence or three: outcome, the main reason, the fix. */}
        {last && (
          <section className="rise rise-2 mt-6 rounded-3xl bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-lg font-medium text-white">Last search</h2>
              <Link href="/app" className="btn btn-ghost h-9 text-sm">
                Open the jobs board <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {lastJobs.length === 0 ? (
              <p className="mt-3 text-sm text-white/45">{last.endedAt ? "It didn't find anything that passed every check. Widen a setting below and try again." : "Nothing yet. Jobs appear here as they're found."}</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {lastJobs.map((j) => {
                  const place = [j.city, j.country].filter(Boolean).join(", ");
                  const setting = j.workSetting ? j.workSetting[0].toUpperCase() + j.workSetting.slice(1) : null;
                  const match = Math.round(j.matchScore);
                  return (
                    <li key={j.id}>
                      <Link href={`/app/jobs/${j.id}`} className="group flex items-center gap-4 py-3">
                        <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="font-display block truncate font-medium text-white group-hover:underline group-hover:decoration-mist group-hover:underline-offset-4">{j.title}</span>
                          <span className="block truncate text-sm text-white/50">
                            <span className="text-white/70">{j.company}</span>
                            {[place, setting].filter(Boolean).length > 0 && <> · {[place, setting].filter(Boolean).join(" · ")}</>}
                          </span>
                        </span>
                        <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums sm:inline-flex ${match >= 80 ? "bg-coral/15 text-rose ring-1 ring-coral/30" : "bg-white/[0.06] text-white/55"}`}>
                          {match}%
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-white/45">{STATUS_LABEL[j.status] ?? j.status}</span>
                        <ArrowRight className="size-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {!outcome && lastLine?.why && <p className="mt-4 text-sm text-white/55">{lastLine.why}</p>}
            {!outcome && lastLine?.fix && (
              <p className="mt-1 text-sm text-coral">
                <a href="#looks-for" className="underline underline-offset-4">
                  {lastLine.fix}
                </a>
              </p>
            )}
          </section>
        )}

        {outcome && !searching && (
          <div className="mt-6">
            <SearchOutcome profileId={current.id} outcome={outcome} />
          </div>
        )}

        <MorningSearch
          profileId={current.id}
          jobs={current.autoSearchJobs}
          days={current.autoSearchDays}
          defaultJobs={perSearch}
          perJob={cost.perJob}
          extraPlaces={current.preferences?.extraPlaces?.length ?? 0}
          balance={balance}
          email={user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null}
          disabled={paused ? "Resume this headhunter to turn this on." : balance != null && balance <= 0 ? "Top up to turn this on." : undefined}
        />

        {/* What it works from. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section id="looks-for" className="rise rise-3 scroll-mt-8 rounded-3xl bg-surface p-6">
            <ScrollToHash id="looks-for" />
            <h2 className="font-display text-lg font-medium text-white">Search settings</h2>
            <p className="mt-1 mb-5 text-sm text-white/50">Changes apply to the next search.</p>
            <PreferencesChat
              tips={(coach?.suggestions ?? []).map((s) => ({ target: s.target, text: s.text }))}
              key={current.id + (current.briefedAt?.getTime() ?? 0)}
              profileId={current.id}
              mode="edit"
              initial={current.preferences ?? undefined}
            />
          </section>
          <div className="space-y-6">
            <section id="resume" className="rise rise-4 scroll-mt-8 rounded-3xl bg-surface p-6">
              <ScrollToHash id="resume" />
              <h2 className="font-display text-lg font-medium text-white">Resume</h2>
              <p className="mt-1 mb-5 text-sm text-white/55">
                <span className="text-white">{current.resumeFileName}</span>
              </p>
              <ResumeStep profileId={current.id} submitLabel="Replace resume" />
            </section>

            {/* The detail, for when you want it: recent searches and the live log. Open on its own while a search runs. */}
            <details className="group rounded-3xl bg-surface" open={searching}>
              <summary className="cursor-pointer list-none px-6 py-4 text-sm text-white/55 hover:text-white">
                <span className="group-open:hidden">Show history and activity</span>
                <span className="hidden group-open:inline">Hide history and activity</span>
              </summary>
              <div className="space-y-6 px-6 pb-6">
                {history.length > 0 && (
                  <ul className="divide-y divide-white/[0.06]">
                    {history.map((s) => {
                      const mins = s.endedAt ? Math.max(1, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000)) : null;
                      return (
                        <li key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                          <span className="text-white/70">{when(s.startedAt, user.timezone)}</span>
                          <span className="text-white/45">{s.endedAt ? (mins != null ? took(mins) : "") : "In progress"}</span>
                          <span className="text-white">{s.jobsAdded == null ? "–" : plural(s.jobsAdded, "job")}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <ActivityPanel profileId={current.id} live={searching} />
              </div>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-sm">
              <PauseToggle profileId={current.id} paused={paused} />
              <RemoveHeadhunter profileId={current.id} mindName={current.mindName ?? current.label} />
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
