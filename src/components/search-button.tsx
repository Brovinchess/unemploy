"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Square, X } from "lucide-react";
import { requestSearch, stopSearch } from "@/app/actions";
import { estimateSearchCost } from "@/lib/preferences";
import { LiveDot } from "./activity-feed";
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
}: {
  profileId: string;
  searching: boolean;
  startedAt: string | null;
  defaultJobs: number;
  balance: number | null;
  disabled?: string; // reason the button can't be used
  notifyEmail: string | null; // where the "search finished" email goes, if on
  big?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(big);
  const [jobs, setJobs] = useState(defaultJobs);
  const [focus, setFocus] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  // Live values win over what the page was rendered with.
  const live = useLive();
  const mine = live?.profile.id === profileId ? live.profile : null;
  const searching = mine ? mine.searching : searchingProp;
  const startedAt = mine ? mine.startedAt : startedAtProp;
  const balance = mine?.balance ?? balanceProp;
  const now = useNow();

  // Close the pop-over on Escape or a click outside.
  useEffect(() => {
    if (!open || big) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, big]);

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

  const tooExpensive = balance != null && estimateSearchCost(jobs).cognition > balance;
  const form = (
    <div className={big ? "w-full max-w-md text-left" : ""}>
      <JobsSlider value={jobs} onChange={setJobs} balance={balance} />
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
        onClick={() =>
          start(async () => {
            const r = await requestSearch(profileId, jobs, focus);
            setError(r?.error);
            if (!r?.error) setOpen(big);
          })
        }
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
