import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import type { Job } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { Ninja } from "@/components/brand";
import { AutoRefresh } from "@/components/auto-refresh";
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
  const { user, profiles, current } = await appContext(sp.profile);
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
  const searching = !current.lastDeliveryAt && !paused;
  const lastSeen = current.lastDeliveryAt ?? current.briefedAt;
  const quietDays = lastSeen ? daysSince(lastSeen) : 0;
  const welcome = sp.welcome === "1";

  return (
    <>
      <AppHeader tab="shortlist" profiles={profiles} current={current} balance={balance} />
      <main className="w-full flex-1 px-[6%] py-8">
        {welcome && (
          <div className="mb-6 flex items-center gap-4 rounded-3xl bg-night-2 px-5 py-4">
            <Ninja className="size-12 shrink-0" />
            <div className="flex-1">
              <p className="font-display text-lg font-medium text-white">{current.mindName} is on the hunt</p>
              <p className="text-sm text-white/55">
                It&rsquo;s reading your resume now. New jobs land here, and each one comes with an application ready to
                paste.
              </p>
            </div>
            <Link href={base} className="text-sm text-white/55 hover:text-white">
              Got it
            </Link>
          </div>
        )}

        {paused && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-mist-soft px-5 py-4">
            <p>
              <strong className="text-ink">{current.mindName}</strong> is paused and isn&rsquo;t using any credit.
            </p>
            <PauseToggle profileId={current.id} paused />
          </div>
        )}
        {balance != null && balance <= 0 && !paused && (
          <div className="mb-6 rounded-2xl bg-coral-soft px-5 py-4 text-rose">
            <strong>{current.mindName}</strong> has run out of cognition and will stop searching soon. Top it up on
            Hello Minds to keep your shortlist coming.
          </div>
        )}

        {quietDays >= 4 && !paused && (
          <div className="mb-6 rounded-2xl bg-coral-soft px-5 py-4 text-rose">
            <strong>{current.mindName}</strong> hasn&rsquo;t sent any jobs for {quietDays} days. Check its credit, or
            update its preferences in Settings to give it a fresh brief.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* List: hidden on small screens while a job is open */}
          <section className={explicit ? "hidden lg:block" : ""} aria-label="Shortlist">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-medium tracking-tight text-white">Your shortlist</h1>
                <p className="mt-1 text-sm text-white/50">
                  Found by <span className="font-mono text-white/70">{current.mindName}</span>
                </p>
              </div>
              {fresh.length > 0 && <span className="tag">{fresh.length} new</span>}
            </div>

            {jobs.length === 0 && searching && (
              <div className="card mt-5 px-6 py-12 text-center">
                <AutoRefresh />
                <Ninja className="float mx-auto size-20" />
                <h2 className="font-display mt-5 text-lg font-medium text-white">Searching for your first jobs</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                  It&rsquo;s reading your resume and looking for jobs that fit. The first ones usually arrive within 10
                  to 30 minutes. This page updates by itself.
                </p>
              </div>
            )}

            {jobs.length === 0 && !searching && (
              <div className="card mt-5 px-6 py-12 text-center">
                <Ninja className="mx-auto size-16" />
                <h2 className="font-display mt-4 text-lg font-medium text-white">You&rsquo;re all caught up</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
                  Your next shortlist arrives tomorrow morning. Check the tracker to follow up on applications.
                </p>
              </div>
            )}

            {fresh.length > 0 && (
              <div className="mt-5 space-y-2.5">
                {fresh.map((j) => (
                  <JobCard key={j.id} job={j} href={`${base}&job=${j.id}`} selected={j.id === selected?.id} />
                ))}
              </div>
            )}

            {saved.length > 0 && (
              <div className="mt-8">
                <h2 className="font-display text-sm font-medium text-muted">Saved for later</h2>
                <div className="mt-3 space-y-2.5">
                  {saved.map((j) => (
                    <JobCard key={j.id} job={j} href={`${base}&job=${j.id}`} selected={j.id === selected?.id} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Detail: always on large screens, only when a job is open on small ones */}
          {selected && (
            <div className={explicit ? "" : "hidden lg:block"}>
              <div className="lg:sticky lg:top-32">
                <Link href={base} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted lg:hidden">
                  <ArrowLeft className="size-4" aria-hidden /> Back to shortlist
                </Link>
                <div className="lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:rounded-2xl">
                  <JobDetail job={selected} doneHref={base} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
