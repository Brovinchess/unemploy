import { desc, eq } from "drizzle-orm";
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
import { coachFor } from "@/lib/coach-ui";
import { searchPace } from "@/lib/coach";
import { Coach } from "@/components/coach";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { costModel } from "@/lib/cost";
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
    db.query.searches.findMany({ where: eq(schema.searches.profileId, current.id), orderBy: desc(schema.searches.startedAt), limit: 6 }),
  ]);
  const searching = isSearching(current);
  const paused = current.status === "paused";
  const coach = user.coachReminders ? await coachFor(current) : null;
  const pace = await searchPace(current.id);
  const perSearch = current.preferences?.jobsPerDay ?? 5;

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

        {/* What it has been doing: live activity on the left; searches and what it looked at on the right. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ActivityPanel profileId={current.id} live={searching} />
          <div className="space-y-6">
            <section className="rounded-3xl bg-surface p-6">
              <h2 className="font-display text-lg font-medium text-white">Searches</h2>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-white/45">None yet. Each one shows here with jobs found and cognition used.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {history.map((s) => {
                    const used = s.cognitionUsed ?? (s.balanceStart != null && s.balanceEnd != null ? Math.max(0, Math.round(s.balanceStart - s.balanceEnd)) : null);
                    const mins = s.endedAt ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000) : null;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="text-white">{when(s.startedAt)}</p>
                          <p className="mt-0.5 truncate text-xs text-white/45">
                            {s.endedAt ? ENDED[s.endReason ?? "finished"] : "In progress"}
                            {mins != null ? ` · ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}` : ""}
                            {` · asked for ${s.jobsWanted}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-white">{s.jobsAdded ?? "–"} jobs</p>
                          {used != null && <p className="mt-0.5 text-xs text-white/45">{used} cognition</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <Considered
              profileId={current.id}
              country={current.preferences?.country ?? "your country"}
              remoteOnly={(current.preferences?.workSettings ?? []).every((w) => w === "remote")}
            />
          </div>
        </div>

        {/* What it works from: the brief on the left, the resume on the right. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section id="looks-for" className="scroll-mt-8 rounded-3xl bg-surface p-6">
            <ScrollToHash id="looks-for" />
            <Coach pace={pace} />
            <h2 className="font-display text-lg font-medium text-white">What it looks for</h2>
            <p className="mt-1 mb-5 text-sm text-white/50">Changes apply from your next search.</p>
            <PreferencesChat
              tips={(coach?.suggestions ?? []).map((s) => ({ target: s.target, text: s.text }))}
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
              <p className="mt-1 mb-5 text-sm text-white/55">
                Current: <span className="text-white">{current.resumeFileName}</span>
              </p>
              <ResumeStep profileId={current.id} submitLabel="Replace resume" />
            </section>
            {/* Rarely needed, so small: pause keeps its memory and costs nothing; remove is final. */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-sm">
              <PauseToggle profileId={current.id} paused={paused} />
              <RemoveHeadhunter profileId={current.id} label={current.label} mindName={current.mindName ?? current.label} />
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
