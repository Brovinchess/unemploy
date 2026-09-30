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
import { appContext, balanceFor } from "@/lib/app-context";

// Server render happens once per request, so reading the clock here is fine.
function daysSince(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
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
  const lastSeen = current.lastDeliveryAt ?? current.briefedAt;
  const quietDays = lastSeen ? daysSince(lastSeen) : 0;

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
          <span className="font-mono">{current.mindName}</span> has run out of cognition and will stop searching soon. Top it up
          on Hello Minds to keep your shortlist coming.
        </div>
      )}
      {quietDays >= 4 && !paused && everDelivered && (
        <div className="mb-6 rounded-2xl bg-coral-soft px-5 py-4 text-rose">
          <span className="font-mono">{current.mindName}</span> hasn&rsquo;t sent any jobs for {quietDays} days. Check its
          cognition, or update its preferences in Settings to give it a fresh brief.
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
          {jobs.length > 0 && (
            <p className="text-sm text-white/50">
              {fresh.length} new{saved.length > 0 && ` · ${saved.length} saved`}
            </p>
          )}
        </div>

        {alerts}

        {jobs.length === 0 && !everDelivered && (
          <HuntProgress
            profileId={current.id}
            mindName={current.mindName ?? "Your headhunter"}
            jobsPerDay={current.preferences?.jobsPerDay ?? 5}
            live={!paused}
          />
        )}

        {jobs.length === 0 && everDelivered && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section className="flex flex-col items-center justify-center rounded-3xl bg-surface px-8 py-16 text-center">
              <Ninja className="size-20" />
              <h2 className="font-display mt-6 text-2xl font-medium text-white">You&rsquo;re all caught up</h2>
              <p className="mt-2 max-w-sm leading-relaxed text-white/55">
                Your next jobs arrive after your headhunter&rsquo;s next search. Meanwhile, follow up on your applications.
              </p>
              <Link href={`/app/tracker?profile=${current.id}`} className="btn btn-ghost mt-6">
                Open the tracker
              </Link>
            </section>
            <ActivityFeed profileId={current.id} live={!paused} />
          </div>
        )}

        {jobs.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
            {/* List: hidden on small screens while a job is open */}
            <section className={`space-y-6 ${explicit ? "hidden xl:block" : ""}`} aria-label="Shortlist">
              <ActivityFeed profileId={current.id} live={!paused} />

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
