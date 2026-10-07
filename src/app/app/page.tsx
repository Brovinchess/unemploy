import { and, desc, eq, inArray } from "drizzle-orm";
import type { Profile } from "@/db/schema";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { Ninja } from "@/components/brand";
import { CompanyLogo } from "@/components/company-logo";
import { ApplyAllButton, ExtensionPrompt } from "@/components/extension-ui";
import { Pipeline } from "@/components/pipeline";
import { HuntProgress } from "@/components/hunt-progress";
import { PauseToggle } from "@/components/pause-toggle";
import { SearchButton } from "@/components/search-button";
import { SwipeDeck } from "@/components/swipe-deck";
import { appContext, balanceFor } from "@/lib/app-context";
import { toCard } from "@/lib/cards";
import { costModel } from "@/lib/cost";
import { detailsComplete } from "@/lib/extension";
import { isSearching } from "@/lib/search";

function ago(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// New jobs arrive as a deck of cards to reveal and swipe. With nothing new, the page shows
// the last search's decisions, the search in progress, or a ready state.
export default async function Shortlist({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const { user, profiles, unfinished, current } = await appContext(sp.profile);
  const ids = profiles.map((p) => p.id);
  const [balance, cost, fresh, toApply] = await Promise.all([
    balanceFor(user, current),
    costModel(current.id),
    // New jobs from every headhunter, best match first.
    db.query.jobs.findMany({ where: and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "new")), orderBy: [desc(schema.jobs.matchScore)] }),
    db.$count(schema.jobs, and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "saved"))),
  ]);
  const labels = new Map(profiles.map((p: Profile) => [p.id, p.label]));
  // The queue shown beside the cards while swiping.
  const queue = fresh.length
    ? await db.query.jobs.findMany({
        where: and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved")),
        orderBy: [desc(schema.jobs.statusChangedAt)],
        limit: 6,
      })
    : [];
  const applyAll = <ApplyAllButton count={toApply} detailsComplete={detailsComplete(user.applicant)} />;

  const paused = current.status === "paused";
  const everDelivered = !!current.lastDeliveryAt;
  const searching = isSearching(current);
  const perSearch = current.preferences?.jobsPerDay ?? 5;
  const searchButton = (big = false) => (
    <SearchButton
      profileId={current.id}
      searching={searching}
      startedAt={current.searchStartedAt?.toISOString() ?? null}
      defaultJobs={perSearch}
      balance={balance}
      notifyEmail={user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null}
      disabled={paused ? "Resume this headhunter to search" : balance != null && balance <= 0 ? "Top up to search" : undefined}
      big={big}
      perJob={cost.perJob}
      last={cost.last}
    />
  );

  // With nothing new to swipe: every job kept so far, by stage.
  const kept =
    fresh.length === 0 && everDelivered
      ? await db.query.jobs.findMany({
          where: and(
            inArray(schema.jobs.profileId, profiles.map((p) => p.id)),
            inArray(schema.jobs.status, ["saved", "applied", "heard_back", "interview", "offer", "rejected", "skipped"]),
          ),
          orderBy: [desc(schema.jobs.statusChangedAt)],
        })
      : [];

  return (
    <AppShell tab="jobs" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">{profiles.length > 1 ? "All headhunters" : `${current.label} headhunter`}</p>
            <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Jobs</h1>
            {current.lastDeliveryAt && <p className="mt-1 text-sm text-white/40">Last search {ago(current.lastDeliveryAt)}</p>}
          </div>
        </div>

        <ExtensionPrompt show={toApply > 0} />

        {paused && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
            <p className="text-white/80">
              <span className="font-mono text-white">{current.mindName}</span> is paused and isn&rsquo;t using any cognition.
            </p>
            <PauseToggle profileId={current.id} paused />
          </div>
        )}

        {/* While a search runs with nothing to swipe yet: one compact progress bar. */}
        {searching && fresh.length === 0 && (
          <HuntProgress
            profileId={current.id}
            mindName={current.mindName ?? "Your headhunter"}
            jobsPerDay={perSearch}
            startedAt={current.searchStartedAt?.toISOString() ?? null}
            live
          />
        )}

        {/* Cards to swipe, with the search status and the apply queue alongside. */}
        {fresh.length > 0 && (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
            <SwipeDeck jobs={fresh.map((j) => ({ ...toCard(j), headhunter: profiles.length > 1 ? labels.get(j.profileId) : undefined }))} after={<>{applyAll}{searchButton(true)}</>} />
            <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
              {searching && (
                <HuntProgress
                  profileId={current.id}
                  mindName={current.mindName ?? "Your headhunter"}
                  jobsPerDay={perSearch}
                  startedAt={current.searchStartedAt?.toISOString() ?? null}
                  live
                  panel
                />
              )}
              <section className="rounded-3xl bg-surface p-5" aria-label="To apply">
                <h2 className="font-display flex items-baseline justify-between text-sm font-medium text-white/70">
                  To apply <span className="text-white/35">{toApply || ""}</span>
                </h2>
                {queue.length ? (
                  <ul className="mt-3 divide-y divide-white/[0.06]">
                    {queue.map((j) => (
                      <li key={j.id}>
                        <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-3 py-2.5 hover:bg-white/[0.02]">
                          <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">{j.title}</span>
                            <span className="block truncate text-xs text-white/50">{j.company}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-white/40">Swipe right and jobs pile up here.</p>
                )}
                {toApply > queue.length && <p className="mt-2 text-xs text-white/35">and {toApply - queue.length} more</p>}
                <div className="mt-4">{applyAll}</div>
              </section>
            </aside>
          </div>
        )}


        {fresh.length === 0 && searching && (
          <p className="py-10 text-center text-sm text-white/40">New jobs appear here as your headhunter sends them.</p>
        )}

        {fresh.length === 0 && !searching && !everDelivered && (
          <section className="flex flex-col items-center rounded-3xl bg-surface px-8 py-16 text-center">
            <Ninja className="float size-24" />
            <h2 className="font-display mt-6 text-3xl font-medium tracking-tight text-white">
              <span className="font-mono text-[0.85em]">{current.mindName}</span> is ready
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-white/55">
              It has your resume and preferences, and it only searches when you ask. Each job comes back as a card: reveal it,
              then swipe right to apply or left to pass.
            </p>
            <div className="mt-8 w-full max-w-md">{searchButton(true)}</div>
          </section>
        )}

        {fresh.length === 0 && !searching && everDelivered && (
          <section className="mx-auto max-w-[820px]">
            <div className="text-center">
              <Ninja mood={kept.some((j) => j.status === "saved") ? "love" : "happy"} className="mx-auto size-[72px]" />
              <h2 className="font-display mt-3.5 text-[28px] font-medium tracking-tight">You&rsquo;ve seen every new job</h2>
              <p className="mt-1.5 text-white/55">Ask for more whenever you&rsquo;re ready.</p>
            </div>
            <div className="mx-auto mt-6 max-w-md">{searchButton(true)}</div>
            <div className="mt-10">
              <Pipeline jobs={kept} labels={labels} detailsComplete={detailsComplete(user.applicant)} />
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
