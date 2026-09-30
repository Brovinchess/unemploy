"use client";

import { useState, useTransition } from "react";
import { Search, Square } from "lucide-react";
import { requestSearch, stopSearch } from "@/app/actions";
import { LiveDot } from "./activity-feed";

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

// The only way a search starts: the user asks. Shows the running search and a way to stop it.
export function SearchButton({
  profileId,
  searching,
  startedAt,
  jobs,
  cognition,
  disabled,
  big = false,
}: {
  profileId: string;
  searching: boolean;
  startedAt: string | null;
  jobs: number;
  cognition: number;
  disabled?: string; // reason the button can't be used
  big?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  if (searching) {
    const mins = startedAt ? minutesSince(startedAt) : 0;
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

  return (
    <div className={`flex flex-col gap-2 ${big ? "items-center" : "items-end"}`}>
      <button
        className={`flex items-center justify-center gap-2 rounded-full bg-coral font-medium text-white transition-colors hover:bg-rose disabled:opacity-50 ${
          big ? "h-12 px-7 text-base" : "h-11 px-5 text-sm"
        }`}
        disabled={pending || !!disabled}
        title={disabled}
        onClick={() =>
          start(async () => {
            const r = await requestSearch(profileId);
            setError(r?.error);
          })
        }
      >
        <Search className="size-4" aria-hidden /> {pending ? "Starting…" : "Find new jobs"}
      </button>
      <p className="text-xs text-white/40">
        {disabled ?? `Up to ${jobs} jobs · about ${cognition} cognition`}
      </p>
      {error && <p className="max-w-xs text-right text-sm text-rose">{error}</p>}
    </div>
  );
}
