"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Lightbulb, Search, Square, X } from "lucide-react";
import { requestSearch, stopSearch } from "@/app/actions";
import { setCoachReminders } from "@/app/notify-actions";
import Link from "next/link";
import { estimateSearchCost } from "@/lib/preferences";
import { LiveDot } from "./activity-feed";
import { Ninja } from "./brand";
import { JobsSlider, type LastSearch } from "./jobs-slider";
import { minutesSince, useLive, useNow } from "./live";

// The only way a search starts: the user asks, choosing how many jobs (and optionally a
// one-off focus). Shows the running search and a way to stop it.
export function SearchButton({
  profileId,
  searching: searchingProp,
  startedAt: startedAtProp,
  defaultJobs,
  balance: balanceProp,
  disabled,
  notifyEmail,
  big = false,
  perJob,
  last = null,
  coach = null,
}: {
  profileId: string;
  searching: boolean;
  startedAt: string | null;
  defaultJobs: number;
  balance: number | null;
  disabled?: string; // reason the button can't be used
  notifyEmail: string | null; // where the "search finished" email goes, if on
  big?: boolean;
  perJob?: number;
  last?: LastSearch;
  // Shown once before the next search when the last one was slow: what to change, with a way to keep going.
  coach?: { summary: string; stats: { label: string; value: string; target?: string }[]; suggestions: { kind: string; text: string; evidence: string }[]; modifyHref: string } | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(big);
  const [jobs, setJobs] = useState(defaultJobs);
  const [focus, setFocus] = useState("");
  const [coachOpen, setCoachOpen] = useState(false);
  const [mute, setMute] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // "Ask for fewer" is moot once the slider is already at 5 or under.
  const tips = coach?.suggestions.filter((s) => s.kind !== "fewer" || jobs > 5) ?? [];
  const begin = () =>
    start(async () => {
      const r = await requestSearch(profileId, jobs, focus);
      setError(r?.error);
      if (!r?.error) setOpen(big);
    });
  // Live values win over what the page was rendered with.
  const live = useLive();
  const mine = live?.profile.id === profileId ? live.profile : null;
  const searching = mine ? mine.searching : searchingProp;
  const startedAt = mine ? mine.startedAt : startedAtProp;
  const balance = mine?.balance ?? balanceProp;
  const now = useNow();

  // Close the pop-over on Escape or a click outside.
  useEffect(() => {
    if (!open || big || coachOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, big, coachOpen]);

  // Escape closes the coach pop-up.
  useEffect(() => {
    if (!coachOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCoachOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [coachOpen]);

  if (searching) {
    const mins = startedAt ? minutesSince(startedAt, now) : 0;
    return (
      <div className={`flex flex-col gap-2 ${big ? "items-center" : "items-end"}`}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm text-white">
            <LiveDot /> Searching{mins > 0 ? ` · ${mins} min` : ""}
          </span>
          <button
            className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm text-white/50 hover:bg-white/[0.06] hover:text-white"
            disabled={pending}
            onClick={() => start(() => stopSearch(profileId))}
          >
            <Square className="size-3.5" aria-hidden /> Stop
          </button>
        </div>
        <p className="text-xs text-white/40">New jobs appear here as they&rsquo;re found.</p>
      </div>
    );
  }

  const tooExpensive = balance != null && estimateSearchCost(jobs, perJob).cognition > balance;

  // A real pop-up over the page: whichever button starts a search opens it when the last one was slow.
  const coachModal =
    coachOpen && coach
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 backdrop-blur-sm sm:items-center" onClick={() => setCoachOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="coach-title"
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-night-2 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-6 pt-8 text-center">
                <button className="absolute right-5 top-5 text-white/40 hover:text-white" onClick={() => setCoachOpen(false)} aria-label="Close">
                  <X className="size-4" />
                </button>
                {/* Mochi reacts to how the last search went: sad when it came back empty, thinking when it was just slow. */}
                <Ninja mood={coach.stats[0]?.value === "0" ? "sad" : "thinking"} className="float mx-auto size-24" />
                <h2 id="coach-title" className="font-display mt-4 text-xl font-medium text-white">
                  {coach.stats[0]?.value === "0" ? "That one came back empty" : "Quick tip before you search"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {coach.stats[0]?.value === "0" ? "Let's change something so the next one lands." : "Last time was slow. A small change could speed things up."}
                </p>
              </div>

              <div className="mx-6 mt-4 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl bg-white/[0.04]">
                {coach.stats.map((st) => (
                  <div key={st.label} className="px-3 py-3 text-center">
                    <p className="font-display text-lg font-medium text-white">{st.value}</p>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">{st.label}</p>
                    {st.target && <p className="text-[11px] text-coral/80">{st.target}</p>}
                  </div>
                ))}
              </div>

              <ul className="mt-4 space-y-2 px-6">
                {tips.map((s) => (
                  <li key={s.text} className="flex gap-3 rounded-2xl border border-coral/20 bg-coral/[0.08] px-4 py-3">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-medium text-white">{s.text}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{s.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 px-6 pb-6">
                <div className="grid grid-cols-2 gap-3">
                  <Link href={coach.modifyHref} className="btn btn-accent justify-center" onClick={() => setCoachOpen(false)}>
                    Change settings
                  </Link>
                  <button
                    className="btn btn-ghost justify-center"
                    disabled={pending}
                    onClick={async () => {
                      if (mute) await setCoachReminders(false);
                      setCoachOpen(false);
                      begin();
                    }}
                  >
                    Search anyway
                  </button>
                </div>
                <label className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45">
                  <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} /> Don&rsquo;t show tips again
                </label>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const form = (
    <div className={big ? "w-full max-w-md text-left" : ""}>
      <JobsSlider value={jobs} onChange={setJobs} balance={balance} perJob={perJob} last={last} />
      <label className="mt-5 block text-sm text-white/60" htmlFor={`focus-${profileId}`}>
        Focus for this search <span className="text-white/35">(optional)</span>
      </label>
      <input
        id={`focus-${profileId}`}
        className="field mt-2 h-11"
        placeholder="e.g. fintech only, or companies in Singapore"
        maxLength={200}
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
      />
      <button
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose disabled:opacity-50"
        disabled={pending || tooExpensive}
        onClick={() => (tips.length ? setCoachOpen(true) : begin())}
      >
        <Search className="size-4" aria-hidden /> {pending ? "Starting…" : `Find ${jobs} ${jobs === 1 ? "job" : "jobs"}`}
      </button>
      <p className="mt-3 text-center text-xs text-white/45">
        {notifyEmail ? (
          <>We&rsquo;ll email {notifyEmail} when it&rsquo;s done.</>
        ) : (
          <>
            Want an email when it&rsquo;s done?{" "}
            <a href="/app/settings#email" className="text-white/70 underline underline-offset-2 hover:text-white">
              Add your email
            </a>
          </>
        )}
      </p>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      {coachModal}
    </div>
  );

  if (disabled) {
    return (
      <div className={`flex flex-col gap-2 ${big ? "items-center" : "items-end"}`}>
        <button className="flex h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-medium text-white opacity-50" disabled>
          <Search className="size-4" aria-hidden /> Find new jobs
        </button>
        <p className="text-xs text-white/40">{disabled}</p>
      </div>
    );
  }

  if (big) return form;

  return (
    <div className="relative" ref={panel}>
      <button
        className="flex h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-rose"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Search className="size-4" aria-hidden /> Find new jobs
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-30 w-[22rem] rounded-3xl border border-white/[0.08] bg-night-2 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <button className="absolute right-4 top-4 text-white/40 hover:text-white" onClick={() => setOpen(false)} aria-label="Close">
            <X className="size-4" />
          </button>
          {form}
        </div>
      )}
    </div>
  );
}
