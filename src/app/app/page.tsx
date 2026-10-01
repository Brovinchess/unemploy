import Link from "next/link";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Profile } from "@/db/schema";
import { ArrowUpRight } from "lucide-react";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { CompanyLogo } from "@/components/company-logo";
import { ApplyAllButton, ExtensionPrompt } from "@/components/extension-ui";
import { HuntProgress } from "@/components/hunt-progress";
import { PauseToggle } from "@/components/pause-toggle";
import { SearchButton } from "@/components/search-button";
import { SwipeDeck } from "@/components/swipe-deck";
import { appContext, balanceFor } from "@/lib/app-context";
import { toCard } from "@/lib/cards";
import { detailsComplete } from "@/lib/extension";
import { isSearching } from "@/lib/search";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

function ago(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// New jobs arrive as a deck of cards to reveal and swipe. With nothing new, the page shows
// the last search's decisions, the search in progress, or a ready state.
export default async function Shortlist({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const { user, profiles, unfinished, current } = await appContext(sp.profile);
  const balance = await balanceFor(user, current);

  // New jobs from every headhunter, best match first.
  const fresh = await db.query.jobs.findMany({
    where: and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "new")),
    orderBy: [desc(schema.jobs.matchScore)],
  });
  const labels = new Map(profiles.map((p: Profile) => [p.id, p.label]));
  const toApply = await db.$count(schema.jobs, and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved")));
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
    />
  );

  // With nothing new to swipe: what was decided in the latest search.
  const recent =
    fresh.length === 0 && everDelivered
      ? await db.query.jobs.findMany({
          where: and(
            inArray(schema.jobs.profileId, profiles.map((p) => p.id)),
            inArray(schema.jobs.status, ["saved", "applied", "skipped"]),
            gte(schema.jobs.createdAt, current.searchStartedAt ?? daysAgo(14)),
          ),
          orderBy: [desc(schema.jobs.matchScore)],
        })
      : [];

  return (
    <AppShell tab="shortlist" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">{profiles.length > 1 ? "All headhunters" : `${current.label} headhunter`}</p>
            <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">
              {fresh.length ? `${fresh.length} new ${fresh.length === 1 ? "job" : "jobs"}` : "Shortlist"}
            </h1>
            {current.lastDeliveryAt && <p className="mt-1 text-sm text-white/40">Last search {ago(current.lastDeliveryAt)}</p>}
          </div>
          {(fresh.length > 0 || everDelivered) && (
            <div className="flex flex-col items-end gap-2">
              {searchButton()}
              {profiles.length > 1 && (
                <p className="text-xs text-white/40">
                  Searching with{" "}
                  {profiles.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " · "}
                      <Link href={`/app?profile=${p.id}`} className={p.id === current.id ? "text-white" : "hover:text-white"}>
                        {p.label}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>

        <ExtensionPrompt />

        {paused && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
            <p className="text-white/80">
              <span className="font-mono text-white">{current.mindName}</span> is paused and isn&rsquo;t using any cognition.
            </p>
            <PauseToggle profileId={current.id} paused />
          </div>
        )}

        {fresh.length > 0 && <SwipeDeck jobs={fresh.map((j) => ({ ...toCard(j), headhunter: profiles.length > 1 ? labels.get(j.profileId) : undefined }))} after={<>{applyAll}{searchButton(true)}</>} />}

        {fresh.length === 0 && searching && (
          <HuntProgress profileId={current.id} mindName={current.mindName ?? "Your headhunter"} jobsPerDay={perSearch} live />
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
              <Ninja className="mx-auto size-[72px]" />
              <h2 className="font-display mt-3.5 text-[28px] font-medium tracking-tight">You&rsquo;ve seen every new job</h2>
              <p className="mt-1.5 text-white/55">Here&rsquo;s where your latest search stands. Ask for more whenever you&rsquo;re ready.</p>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <RecentList
                title="To apply"
                empty="Nothing waiting. Jobs you swipe right on land here."
                jobs={recent.filter((j) => j.status === "saved" || j.status === "applied")}
              />
              <RecentList title="Dismissed" empty="Nothing dismissed." jobs={recent.filter((j) => j.status === "skipped")} />
            </div>
            <div className="mt-8 flex justify-center">{applyAll}</div>
            <div className="mx-auto mt-6 max-w-md">{searchButton(true)}</div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function RecentList({ title, empty, jobs }: { title: string; empty: string; jobs: { id: string; title: string; company: string; companyDomain: string | null; matchScore: number; status: string }[] }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-surface p-[18px]">
      <h3 className="font-display mb-1.5 text-[15px] font-medium text-white/55">
        {title} <span className="text-white/35">{jobs.length || ""}</span>
      </h3>
      {jobs.length ? (
        <div className="divide-y divide-white/[0.07]">
          {jobs.map((j) => (
            <Link key={j.id} href={`/app/jobs/${j.id}`} className="flex items-center gap-3 px-1.5 py-3 hover:bg-white/[0.02]">
              <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{j.title}</p>
                <p className="text-xs text-white/55">
                  {j.company} · {Math.round(j.matchScore)}% match
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-rose">
                {j.status === "applied" ? "Applied" : j.status === "saved" ? "Apply" : "View"}
                {j.status === "saved" && <ArrowUpRight className="size-3.5" />}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-1.5 py-2.5 text-[13px] text-white/35">{empty}</p>
      )}
    </div>
  );
}
