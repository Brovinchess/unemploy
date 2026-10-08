import { desc, eq } from "drizzle-orm";
import { ExternalLink, Lightbulb } from "lucide-react";
import { db, schema } from "@/db";
import { ResumeStep } from "@/app/profiles/[id]/setup/resume-step";
import { RemoveHeadhunter } from "@/app/app/settings/remove-headhunter";
import { RenameHeadhunter } from "@/app/app/settings/rename-headhunter";
import { ActivityPanel } from "@/components/activity-feed";
import { AppShell } from "@/components/app-shell";
import { Considered } from "@/components/considered";
import { Ninja } from "@/components/brand";
import { PauseToggle } from "@/components/pause-toggle";
import { PreferencesChat } from "@/components/preferences-chat";
import { SearchButton } from "@/components/search-button";
import { appContext, balanceFor } from "@/lib/app-context";
import { mindsConfig } from "@/lib/minds/config";
import { coachFor } from "@/lib/coach-ui";
import { searchPace } from "@/lib/coach";
import { Coach } from "@/components/coach";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { costModel } from "@/lib/cost";
import { estimateSearchCost } from "@/lib/preferences";
import { isSearching } from "@/lib/search";

function when(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const ENDED: Record<string, string> = { finished: "Finished", stopped: "Stopped by you", timeout: "Timed out" };

// One headhunter: its status and search button, live activity, past searches, cognition,
// and what it looks for.
export default async function Headhunter({ params }: PageProps<"/app/headhunters/[id]">) {
  const { id } = await params;
  const { user, profiles, unfinished, current } = await appContext(id);
  const [balance, cost, history] = await Promise.all([
    balanceFor(user, current),
    costModel(current.id),
    db.query.searches.findMany({ where: eq(schema.searches.profileId, current.id), orderBy: desc(schema.searches.startedAt), limit: 12 }),
  ]);
  const searching = isSearching(current);
  const paused = current.status === "paused";
  const coach = user.coachReminders ? await coachFor(current) : null;
  const pace = await searchPace(current.id);
  const perSearch = current.preferences?.jobsPerDay ?? 5;
  const perSearchCost = estimateSearchCost(perSearch, cost.perJob).cognition;
  const searchesLeft = balance != null ? Math.max(0, Math.floor(balance / perSearchCost)) : null;

  return (
    <AppShell tab="headhunter" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {/* Who it is and what it's doing */}
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <Ninja mood={searching ? "searching" : current.status === "paused" ? "sleeping" : "happy"} className={`size-20 shrink-0 ${searching ? "float" : ""}`} />
            <div>
              <p className="text-sm text-white/45">Headhunter</p>
              <h1 className="font-display mt-0.5 text-3xl font-medium tracking-tight text-white">
                <RenameHeadhunter profileId={current.id} label={current.label} />
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
                <span className="font-mono">{current.mindName}</span>
                <span className="text-white/25">·</span>
                <span className={searching ? "text-coral" : paused ? "text-white/40" : "text-white/70"}>
                  {searching ? "Searching now" : paused ? "Paused" : "Ready, switched off until you search"}
                </span>
              </p>
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
              last={cost.last}
              coach={coach}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <ActivityPanel profileId={current.id} live={searching} />

          <div className="space-y-6">
            {/* Cognition */}
            <section className="rounded-3xl bg-surface p-6">
              <h2 className="font-display text-lg font-medium text-white">Cognition</h2>
              <p className="font-display mt-4 text-4xl font-medium text-white">{balance == null ? "–" : Math.round(balance)}</p>
              <p className="mt-1 text-sm text-white/55">
                {searchesLeft == null
                  ? "Balance unavailable right now"
                  : `Enough for about ${searchesLeft} ${searchesLeft === 1 ? "search" : "searches"} of ${perSearch} jobs (~${perSearchCost} each)`}
              </p>
              <a href={mindsConfig.topUpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-5">
                Top up <ExternalLink className="size-4" aria-hidden />
              </a>
            </section>

            <Considered
              profileId={current.id}
              country={current.preferences?.country ?? "your country"}
              remoteOnly={(current.preferences?.workSettings ?? []).every((w) => w === "remote")}
            />

            {/* Past searches */}
            <section className="rounded-3xl bg-surface p-6">
              <h2 className="font-display text-lg font-medium text-white">Past searches</h2>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-white/45">No searches yet. They&rsquo;ll show here with jobs found and cognition used.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {history.map((s) => {
                    const used = s.cognitionUsed ?? (s.balanceStart != null && s.balanceEnd != null ? Math.max(0, Math.round(s.balanceStart - s.balanceEnd)) : null);
                    return (
                      <li key={s.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-white">{when(s.startedAt)}</p>
                          <p className="mt-0.5 truncate text-white/45">
                            {s.endedAt ? ENDED[s.endReason ?? "finished"] : "In progress"} · asked for {s.jobsWanted}
                            {s.focus ? ` · “${s.focus}”` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-white">{s.jobsAdded ?? "–"} jobs</p>
                          <p className="mt-0.5 text-white/45">{used != null ? `${used} cognition` : ""}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* What it looks for */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section id="looks-for" className="scroll-mt-8 rounded-3xl bg-surface p-6">
            <ScrollToHash id="looks-for" />
            <Coach pace={pace} suggestions={(coach?.suggestions ?? []).filter((s) => s.target === "focus")} />
            <h2 className="font-display text-lg font-medium text-white">What it looks for</h2>
            <p className="mt-1 mb-5 text-sm text-white/50">Changes apply from your next search.</p>
            <PreferencesChat
              tips={(coach?.suggestions ?? []).filter((s) => s.target !== "resume" && s.target !== "focus").map((s) => ({ target: s.target, text: s.text }))}
              key={current.id + (current.briefedAt?.getTime() ?? 0)}
              profileId={current.id}
              mode="edit"
              initial={current.preferences ?? undefined}
            />
          </section>
          <div className="space-y-6">
            <section id="resume" className="scroll-mt-8 rounded-3xl bg-surface p-6">
              <ScrollToHash id="resume" />
              <h2 className="font-display text-lg font-medium text-white">Resume</h2>
              {coach?.suggestions.some((s) => s.target === "resume") && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-coral">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {coach.suggestions.find((s) => s.target === "resume")!.text}
                </p>
              )}
              <p className="mt-1 mb-5 text-sm text-white/55">
                Current: <span className="text-white">{current.resumeFileName}</span>
              </p>
              <ResumeStep profileId={current.id} submitLabel="Replace resume" />
            </section>
            <section className="rounded-3xl bg-surface p-6">
              <h2 className="font-display text-lg font-medium text-white">Pause or remove</h2>
              <p className="mt-1 mb-4 text-sm text-white/50">Paused, it keeps its memory and uses no cognition.</p>
              <div className="mb-5"><PauseToggle profileId={current.id} paused={paused} /></div>
              <div className="mt-4">
                <RemoveHeadhunter profileId={current.id} label={current.label} mindName={current.mindName ?? current.label} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
