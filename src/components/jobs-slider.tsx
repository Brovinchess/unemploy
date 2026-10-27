"use client";

import { estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, RECOMMENDED_JOBS_PER_SEARCH } from "@/lib/preferences";

// How many jobs one search brings, with its cost next to the number.
export type LastSearch = { used: number; jobs: number } | null;

export function JobsSlider({
  value,
  onChange,
  balance,
  perJob,
  extraPlaces = 0,
  topUpUrl,
}: {
  value: number;
  onChange: (n: number) => void;
  balance?: number | null;
  perJob?: number; // cognition per job, learnt from past searches
  extraPlaces?: number; // places besides home, each a little more per search
  topUpUrl?: string;
}) {
  const cost = estimateSearchCost(value, perJob, extraPlaces);
  const pct = ((value - MIN_JOBS_PER_SEARCH) / (MAX_JOBS_PER_SEARCH - MIN_JOBS_PER_SEARCH)) * 100;
  const short = balance != null && cost.cognition > balance;
  // The most jobs the balance still covers, so the hint can offer a way to search right now.
  let affordable = 0;
  if (balance != null) for (let n = MIN_JOBS_PER_SEARCH; n < value; n++) if (estimateSearchCost(n, perJob, extraPlaces).cognition <= balance) affordable = n;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-white/60">Jobs this search</p>
        <p className="font-display text-3xl font-medium text-white">
          {value}
          {value === RECOMMENDED_JOBS_PER_SEARCH && <span className="ml-2 align-middle text-xs font-normal text-coral">recommended</span>}
        </p>
      </div>
      <input
        type="range"
        min={MIN_JOBS_PER_SEARCH}
        max={MAX_JOBS_PER_SEARCH}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Jobs per search"
        className="slider mt-3 w-full"
        style={{ ["--fill" as string]: `${pct}%` }}
      />
      <div className="mt-1 flex justify-between text-xs text-white/35">
        <span>{MIN_JOBS_PER_SEARCH}</span>
        <span>{MAX_JOBS_PER_SEARCH}</span>
      </div>
      <p className="mt-2 text-xs text-white/40">Fewer jobs, better checked.</p>
      <p className="mt-3 text-sm text-white/55">
        Uses about <span className="text-white">{cost.cognition} cognition</span>
        {balance != null && !short ? <span className="text-white/40"> · {Math.max(0, Math.round(balance))} available</span> : null}
      </p>
      {short ? (
        <div className="mt-3 rounded-2xl border border-coral/25 bg-coral/[0.08] px-4 py-3 text-sm">
          <p className="text-white">
            Not enough cognition for {value} {value === 1 ? "job" : "jobs"}. You have {Math.max(0, Math.round(balance ?? 0))}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {affordable >= MIN_JOBS_PER_SEARCH && (
              <button type="button" className="text-white/80 underline underline-offset-2 hover:text-white" onClick={() => onChange(affordable)}>
                Search for {affordable} instead
              </button>
            )}
            {topUpUrl && (
              <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="text-rose underline underline-offset-2 hover:text-white">
                Top up on Hello Minds
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
