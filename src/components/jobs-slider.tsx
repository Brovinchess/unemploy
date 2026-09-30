"use client";

import { estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, RECOMMENDED_JOBS_PER_SEARCH } from "@/lib/preferences";

// How many jobs one search brings, with its cost next to the number.
export function JobsSlider({ value, onChange, balance }: { value: number; onChange: (n: number) => void; balance?: number | null }) {
  const cost = estimateSearchCost(value);
  const pct = ((value - MIN_JOBS_PER_SEARCH) / (MAX_JOBS_PER_SEARCH - MIN_JOBS_PER_SEARCH)) * 100;
  const short = balance != null && cost.cognition > balance;
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
      <p className="mt-2 text-xs text-white/40">Fewer jobs means each one is checked more carefully.</p>
      <p className={`mt-4 text-sm ${short ? "text-rose" : "text-white/60"}`}>
        About <span className={short ? "" : "text-white"}>{cost.cognition} cognition</span> (~${cost.usd.toFixed(2)})
        {balance != null &&
          (short
            ? ` · only ${Math.round(balance)} left, pick fewer or top up`
            : ` · ${Math.round(balance - cost.cognition)} left after`)}
      </p>
    </div>
  );
}
