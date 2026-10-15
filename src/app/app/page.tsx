import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { SearchingScene } from "@/components/searching-scene";
import { ApplyAllButton } from "@/components/extension-ui";
import { JobsBoard, type BoardJob } from "@/components/jobs-board";
import { PauseToggle } from "@/components/pause-toggle";
import { SearchButton } from "@/components/search-button";
import { SearchingChip } from "@/components/sidebar-search";
import { CognitionIntro } from "@/components/cognition-intro";
import { NewJobs } from "@/components/new-jobs";
import { appContext, balanceFor } from "@/lib/app-context";
import { toCard } from "@/lib/cards";
import { coachFor } from "@/lib/coach-ui";
import { costModel } from "@/lib/cost";
import { detailsComplete } from "@/lib/extension";
import { isSearching } from "@/lib/search";
import { topUpUrlFor } from "@/lib/minds/config";

// Backend-only columns stay on the server: the board never receives them.
const HIDDEN = new Set(["postingKey", "countryCode", "jobTypeKey", "levelKey", "postedOn"]);
const forBoard = (j: Record<string, unknown>) => Object.fromEntries(Object.entries(j).filter(([k]) => !HIDDEN.has(k))) as BoardJob;

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
    db.query.jobs.findMany({
      where: and(
        inArray(schema.jobs.profileId, ids),
        eq(schema.jobs.status, "new"),
      ),
      orderBy: [desc(schema.jobs.matchScore)],
    }),
    db.$count(
      schema.jobs,
      and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "saved")),
    ),
  ]);
  const coach = user.coachReminders ? await coachFor(current) : null;
  const applyAll = (
    <ApplyAllButton
      count={toApply}
      detailsComplete={detailsComplete(user.applicant)}
    />
  );

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
      notifyEmail={
        user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null
      }
      disabled={
        paused
          ? "Resume this headhunter to search"
          : balance != null && balance <= 0
            ? "Top up to search"
            : undefined
      }
      big={big}
      perJob={cost.perJob}
      coach={coach}
      topUpUrl={topUpUrlFor(current.mindId)}
    />
  );

  // Everything the headhunters have found, newest change first: the board under the cards.
  const kept = await db.query.jobs.findMany({
    where: and(
      inArray(schema.jobs.profileId, ids),
      inArray(schema.jobs.status, [
        "saved",
        "applied",
        "heard_back",
        "interview",
        "offer",
        "rejected",
        "skipped",
      ]),
    ),
    orderBy: [desc(sql`coalesce(${schema.jobs.statusChangedAt}, ${schema.jobs.createdAt})`)],
  });
  const applied = kept.filter((j) =>
    ["applied", "heard_back", "interview", "offer"].includes(j.status),
  ).length;
  const summary = [
    fresh.length && `${fresh.length} new`,
    toApply && `${toApply} to apply`,
    applied && `${applied} in progress`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      tab="jobs"
      user={user}
      profiles={profiles}
      unfinished={unfinished}
      current={current}
      balance={balance}
    >
      <main className="mx-auto w-full max-w-[920px] flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/45">{`${current.label} headhunter`}</p>
            <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">
              Jobs
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {summary ||
                (current.lastDeliveryAt
                  ? `Last search ${ago(current.lastDeliveryAt)}`
                  : "Nothing yet")}
            </p>
          </div>
          {/* One way to ask for more; while a search runs, say so where people look first. */}
          {searching ? (
            <SearchingChip profileId={current.id} jobsPerDay={perSearch} />
          ) : (
            everDelivered && searchButton()
          )}
        </div>

        {sp.welcome === "1" && <CognitionIntro />}

        {paused && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
            <p className="text-white/80">
              <span className="font-mono text-white">{current.mindName}</span>{" "}
              is paused and isn&rsquo;t using any cognition.
            </p>
            <PauseToggle profileId={current.id} paused />
          </div>
        )}

        {/* New jobs: the whole page the first time, a strip with an overlay once there's a list.
            Always mounted so the deck survives the re-render each swipe causes. */}
        <NewJobs
          jobs={fresh.map(toCard)}
          after={applyAll}
          inline={kept.length === 0}
        />

        {/* The very first search is running: show it clearly busy and say what happens next. */}
        {fresh.length === 0 && searching && !everDelivered && (
          <SearchingScene
            mindName={current.mindName ?? "Your headhunter"}
            notifyEmail={
              user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null
            }
          />
        )}

        {/* First time: nothing found yet, so the search form is the whole page. */}
        {fresh.length === 0 && !searching && !everDelivered && (
          <section className="rise rise-1 flex flex-col items-center rounded-3xl bg-surface px-8 py-16 text-center">
            <Ninja className="float size-24" />
            <h2 className="font-display mt-6 text-3xl font-medium tracking-tight text-white">
              <span className="font-mono text-[0.85em]">
                {current.mindName}
              </span>{" "}
              is ready
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-white/55">
              It has your resume and knows what you want. Ask for jobs and they
              come back as cards: reveal one, swipe right to apply, left to
              pass.
            </p>
            <div className="mt-8 w-full max-w-md">{searchButton(true)}</div>
          </section>
        )}

        {/* Everything found so far, in one list. */}
        <JobsBoard
          jobs={kept.map(forBoard)}
          detailsComplete={detailsComplete(user.applicant)}
        />

        {fresh.length === 0 &&
          everDelivered &&
          kept.length === 0 &&
          !searching && (
            <p className="py-16 text-center text-sm text-white/40">
              Nothing kept yet. Ask for jobs and swipe right on the ones you
              like.
            </p>
          )}
      </main>
    </AppShell>
  );
}
