import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import type { Job } from "@/db/schema";
import { ActivityFeed } from "@/components/activity-feed";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { HuntProgress } from "@/components/hunt-progress";
import { JobCard } from "@/components/job-card";
import { JobDetail } from "@/components/job-detail";
import { PauseToggle } from "@/components/pause-toggle";
import { SearchButton } from "@/components/search-button";
import { estimateSearchCost } from "@/lib/preferences";
import { isSearching } from "@/lib/search";
import { appContext, balanceFor } from "@/lib/app-context";

function ago(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export default async function Shortlist({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const { user, profiles, unfinished, current } = await appContext(sp.profile);
  const balance = await balanceFor(user, current);

  const jobs = await db.query.jobs.findMany({
    where: and(eq(schema.jobs.profileId, current.id), inArray(schema.jobs.status, ["new", "saved"])),
    orderBy: [desc(schema.jobs.createdAt), desc(schema.jobs.matchScore)],
  });
  // Newest day first, best match first within a day.
  const day = (j: Job) => j.createdAt.toISOString().slice(0, 10);
  jobs.sort((a, b) => day(b).localeCompare(day(a)) || b.matchScore - a.matchScore);
  const fresh = jobs.filter((j) => j.status === "new");
  const saved = jobs.filter((j) => j.status === "saved");

  // The job shown in the detail panel: the one asked for (it may already be applied or
  // skipped, e.g. when opened from the tracker), else the top of the list.
  const wantedId = typeof sp.job === "string" ? sp.job : undefined;
  let selected: Job | undefined = jobs.find((j) => j.id === wantedId);
  if (!selected && wantedId) {
    selected = await db.query.jobs.findFirst({
      where: and(eq(schema.jobs.id, wantedId), eq(schema.jobs.profileId, current.id)),
    });
  }
  const explicit = !!selected;
  selected ??= jobs[0];

  const base = `/app?profile=${current.id}`;
  const paused = current.status === "paused";
  const everDelivered = !!current.lastDeliveryAt;
  const searching = isSearching(current);
  const perSearch = current.preferences?.jobsPerDay ?? 5;
  const searchButton = (big = false) => (
    <SearchButton
      profileId={current.id}
      searching={searching}
      startedAt={current.searchStartedAt?.toISOString() ?? null}
      jobs={perSearch}
      cognition={estimateSearchCost(perSearch).cognition}
      disabled={paused ? "Resume this headhunter to search" : balance != null && balance <= 0 ? "Top up to search" : undefined}
      big={big}
    />
  );

  const alerts = (
    <>
      {paused && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
          <p className="text-white/80">
            <span className="font-mono text-white">{current.mindName}</span> is paused and isn&rsquo;t using any cognition.
          </p>
          <PauseToggle profileId={current.id} paused />
        </div>
      )}
      {balance != null && balance <= 0 && !paused && (
        <div className="mb-6 rounded-2xl bg-coral-soft px-5 py-4 text-rose">
          <span className="font-mono">{current.mindName}</span> is out of cognition. Top it up on Hello Minds before your next
          search.
        </div>
      )}
    </>
  );

  return (
    <AppShell tab="shortlist" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">{current.label} headhunter</p>
            <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Shortlist</h1>
          </div>
          <div className="flex items-start gap-6">
            {jobs.length > 0 && (
              <p className="mt-3 hidden text-sm text-white/50 sm:block">
                {fresh.length} new{saved.length > 0 && ` · ${saved.length} saved`}
                {current.lastDeliveryAt && ` · last search ${ago(current.lastDeliveryAt)}`}
              </p>
            )}
            {(jobs.length > 0 || everDelivered) && searchButton()}
          </div>
        </div>

        {alerts}

        {jobs.length === 0 && !searching && !everDelivered && (
          <section className="flex flex-col items-center rounded-3xl bg-surface px-8 py-16 text-center">
            <Ninja className="float size-24" />
            <h2 className="font-display mt-6 text-3xl font-medium tracking-tight text-white">
              <span className="font-mono text-[0.85em]">{current.mindName}</span> is ready
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-white/55">
              It has your resume and preferences, and it only searches when you ask. Each search finds up to {perSearch} jobs,
              checks every one, and writes your application for each.
            </p>
            <div className="mt-8">{searchButton(true)}</div>
          </section>
        )}

        {jobs.length === 0 && searching && (
          <HuntProgress
            profileId={current.id}
            mindName={current.mindName ?? "Your headhunter"}
            jobsPerDay={current.preferences?.jobsPerDay ?? 5}
            live
          />
        )}

        {jobs.length === 0 && !searching && everDelivered && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section className="flex flex-col items-center justify-center rounded-3xl bg-surface px-8 py-16 text-center">
              <Ninja className="size-20" />
              <h2 className="font-display mt-6 text-2xl font-medium text-white">You&rsquo;re all caught up</h2>
              <p className="mt-2 max-w-sm leading-relaxed text-white/55">
                Ask for a new search whenever you&rsquo;re ready, or follow up on your applications in the tracker.
              </p>
              <div className="mt-6">{searchButton(true)}</div>
              <Link href={`/app/tracker?profile=${current.id}`} className="mt-4 text-sm text-white/50 hover:text-white">
                Open the tracker
              </Link>
            </section>
            <ActivityFeed profileId={current.id} live={searching} />
          </div>
        )}

        {jobs.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
            {/* List: hidden on small screens while a job is open */}
            <section className={`space-y-6 ${explicit ? "hidden xl:block" : ""}`} aria-label="Shortlist">
              <ActivityFeed profileId={current.id} live={searching} />

              {fresh.length > 0 && (
                <div>
                  <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-white/40">New for you</h2>
                  <div className="space-y-2.5">
                    {fresh.map((j) => (
                      <JobCard key={j.id} job={j} href={`${base}&job=${j.id}`} selected={j.id === selected?.id} />
                    ))}
                  </div>
                </div>
              )}

              {saved.length > 0 && (
                <div>
                  <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-white/40">Saved for later</h2>
                  <div className="space-y-2.5">
                    {saved.map((j) => (
                      <JobCard key={j.id} job={j} href={`${base}&job=${j.id}`} selected={j.id === selected?.id} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Detail: always on large screens, only when a job is open on small ones */}
            {selected && (
              <div className={explicit ? "" : "hidden xl:block"}>
                <div className="xl:sticky xl:top-10">
                  <Link href={base} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/55 xl:hidden">
                    <ArrowLeft className="size-4" aria-hidden /> Back to shortlist
                  </Link>
                  <div className="xl:max-h-[calc(100svh-5rem)] xl:overflow-y-auto xl:rounded-3xl">
                    <JobDetail job={selected} doneHref={base} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
