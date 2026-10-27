"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Lightbulb, Search, Square, X } from "lucide-react";
import { noteKept, requestSearch, stopSearch } from "@/app/actions";
import { setCoachReminders } from "@/app/notify-actions";
import Link from "next/link";
import { DEFAULT_COGNITION_PER_JOB, estimateSearchCost } from "@/lib/preferences";
import { LiveDot } from "./activity-feed";
import { Ninja } from "./brand";
import { JobsSlider } from "./jobs-slider";
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
  extraPlaces = 0,
  coach = null,
  topUpUrl,
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
  extraPlaces?: number; // places besides home: each adds a little to the estimate
  // Shown once before the next search when the last one was slow: what to change, with a way to keep going.
  coach?: { summary: string; empty: boolean; suggestions: { kind: string; text: string; evidence: string; href: string }[] } | null;
  topUpUrl?: string; // where to buy cognition, for the "not enough" hints
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(big);
  const [jobs, setJobs] = useState(defaultJobs);
  const [coachOpen, setCoachOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [mute, setMute] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Keyboard users land inside the pop-over when it opens and back on the button when it closes.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("input, button:not([aria-label='Close']), [tabindex]")?.focus(), 30);
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
      document.addEventListener("keydown", onKey);
      return () => {
        clearTimeout(t);
        document.removeEventListener("keydown", onKey);
      };
    }
    trigger.current?.focus({ preventScroll: true });
  }, [open]);
  // Where the pop-over sits: under the button, flush with its right edge (phones: 1rem from the right).
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!open || big) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const narrow = window.innerWidth < 640;
      setAnchor({ top: r.bottom + 10, right: narrow ? 16 : Math.max(16, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, big]);
  // "Ask for fewer" is moot once the slider is already at 5 or under.
  const tips = coach?.suggestions.filter((s) => s.kind !== "fewer" || jobs > 5) ?? [];
  const begin = () =>
    start(async () => {
      const r = await requestSearch(profileId, jobs);
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
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current && !panel.current.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, big, coachOpen]);

  // Escape closes the stop dialog and keeps the search going.
  useEffect(() => {
    if (!stopOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStopOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stopOpen]);

  // Escape closes the coach pop-up.
  useEffect(() => {
    if (!coachOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCoachOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [coachOpen]);

  if (searching) {
    const mins = startedAt ? minutesSince(startedAt, now) : 0;
    // Say so while it happens, not after: under about two jobs' worth left, the search may end early.
    const runningLow = balance != null && balance < (perJob ?? DEFAULT_COGNITION_PER_JOB) * 2;
    const keepSearching = () => {
      setStopOpen(false);
      noteKept("stop").catch(() => {});
    };
    // Stopping ends the search for good, so ask once, with what has happened so far.
    const stopModal =
      stopOpen &&
      createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 backdrop-blur-sm sm:items-center" onClick={keepSearching}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-title"
            className="relative w-full max-w-md rounded-3xl border border-white/[0.08] bg-night-2 p-6 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="absolute right-5 top-5 text-white/40 hover:text-white" onClick={keepSearching} aria-label="Close">
              <X className="size-4" />
            </button>
            <Ninja mood="thinking" className="mx-auto size-20" />
            <h2 id="stop-title" className="font-display mt-3 text-center text-xl font-medium text-white">
              Stop this search?
            </h2>
            <p className="mt-2 text-center text-sm text-white/60">Your headhunter is still looking for jobs that fit you. Good matches can take a little while.</p>
            <p className="mt-5 rounded-2xl border border-rose/40 bg-rose/10 px-5 py-3.5 text-center text-sm text-white/85"><span className="font-medium text-rose">Stopping ends this search.</span> Any jobs already found stay on your list.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button
                className="btn btn-ghost text-rose"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await stopSearch(profileId);
                    setStopOpen(false);
                  })
                }
              >
                {pending ? "Stopping…" : "Stop search"}
              </button>
              <button className="btn btn-accent" onClick={keepSearching} autoFocus>
                Keep searching
              </button>
            </div>
          </div>
        </div>,
        document.body,
      );
    return (
      <div className={`flex flex-col gap-2 ${big ? "items-center" : "items-end"}`}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm text-white">
            <LiveDot /> Searching{mins > 0 ? ` · ${mins} min` : ""}
          </span>
          <button
            className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm text-white/50 hover:bg-white/[0.06] hover:text-white"
            disabled={pending}
            onClick={() => {
              setStopOpen(true);
              noteKept("stop_asked").catch(() => {});
            }}
          >
            <Square className="size-3.5" aria-hidden /> Stop
          </button>
        </div>
        {runningLow && (
          <p role="status" className={`max-w-sm rounded-2xl border border-rose/40 bg-rose/10 px-4 py-2.5 text-sm text-white/85 ${big ? "text-center" : "text-right"}`}>
            {balance! <= 0 ? "Your headhunter is out of cognition, so this search will stop soon." : "Cognition is running low, so this search may stop early."} Jobs it finds stay on your list.
            {topUpUrl && (
              <>
                {" "}
                <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="text-rose underline underline-offset-2 hover:text-white">
                  Top up on Hello Minds
                </a>
              </>
            )}
          </p>
        )}
        {stopModal}
      </div>
    );
  }

  const tooExpensive = balance != null && estimateSearchCost(jobs, perJob, extraPlaces).cognition > balance;

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
                <Ninja mood={coach.empty ? "sad" : "thinking"} className="float mx-auto size-24" />
                <h2 id="coach-title" className="font-display mt-4 text-xl font-medium text-white">
                  {coach.empty ? "That one came back empty" : "Quick tip before you search"}
                </h2>
                <p className="mt-1 text-sm text-white/60">{coach.summary}</p>
              </div>

              <ul className="mt-5 space-y-2 px-6">
                {tips.map((s) => {
                  const body = (
                    <>
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-white">{s.text}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{s.evidence}</span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-white/30" aria-hidden />
                    </>
                  );
                  const cls = "flex w-full gap-3 rounded-2xl border border-coral/20 bg-coral/[0.08] px-4 py-3 text-left transition-colors hover:bg-coral/[0.14]";
                  return (
                    <li key={s.text}>
                      <Link href={s.href} className={cls} onClick={() => setCoachOpen(false)}>
                        {body}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 px-6 pb-6">
                <div className="grid grid-cols-2 gap-3">
                  {tips[0] && (
                    <Link href={tips[0].href} className="btn btn-accent justify-center" onClick={() => setCoachOpen(false)}>
                      Change settings
                    </Link>
                  )}
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
      <JobsSlider value={jobs} onChange={setJobs} balance={balance} perJob={perJob} extraPlaces={extraPlaces} topUpUrl={topUpUrl} />
      <button
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose disabled:opacity-50"
        disabled={pending || tooExpensive}
        onClick={() => (tips.length ? setCoachOpen(true) : begin())}
      >
        <Search className="size-4" aria-hidden /> {pending ? "Starting…" : `Find ${jobs} ${jobs === 1 ? "job" : "jobs"}`}
      </button>
      <p className="mt-3 text-center text-xs text-white/45">
        {notifyEmail ? <>You&rsquo;ll get an email at {notifyEmail} when it&rsquo;s done.</> : <>Come back in about an hour, or leave this tab open.</>}
      </p>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      {coachModal}
    </div>
  );

  if (disabled) {
    const outOfCognition = balance != null && balance <= 0;
    return (
      <div className={`flex flex-col gap-2 ${big ? "items-center" : "items-end"}`}>
        <button className="flex h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-medium text-white opacity-50" disabled>
          <Search className="size-4" aria-hidden /> Find new jobs
        </button>
        {outOfCognition && topUpUrl ? (
          <p className={`text-sm text-white/60 ${big ? "text-center" : "text-right"}`}>
            Your headhunter has no cognition left.{" "}
            <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="text-rose underline underline-offset-2 hover:text-white">
              Top up on Hello Minds
            </a>{" "}
            and it can search again.
          </p>
        ) : (
          <p className="text-xs text-white/40">{disabled}</p>
        )}
      </div>
    );
  }

  if (big) return form;

  // The pop-over lives at the end of the document, positioned from the button, so nothing on
  // the page can paint over it whatever the sections around it are doing.
  const popover =
    open && anchor
      ? createPortal(
          <div
            ref={panel}
            className="fixed z-50 w-[calc(100vw-2rem)] rounded-3xl border border-white/[0.08] bg-night-2 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:w-[22rem]"
            style={{ top: anchor.top, right: anchor.right }}
          >
            <button className="absolute right-4 top-4 text-white/40 hover:text-white" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-4" />
            </button>
            {form}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={trigger}
        className="flex h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-medium text-white transition-colors hover:bg-rose"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Search className="size-4" aria-hidden /> Find new jobs
      </button>
      {popover}
    </div>
  );
}
