"use client";

import Link from "next/link";
import { useTransition } from "react";
import { stopSearch } from "@/app/actions";
import { Ninja } from "./brand";
import { minutesSince, useLive, useNow } from "./live";

// A running search, as a small card in the sidebar: time so far, jobs found, Stop.
// Only renders while the current headhunter is searching; the page itself stays quiet.
export function SidebarSearch({ profileId, label, jobsPerDay, compact = false }: { profileId: string; label: string; jobsPerDay: number; compact?: boolean }) {
  const live = useLive();
  const now = useNow();
  const [stopping, start] = useTransition();
  const p = live?.profile.id === profileId ? live.profile : null;
  if (!p?.searching) return null;
  const mins = p.startedAt ? minutesSince(p.startedAt, now) : 0;
  const pct = Math.max(4, Math.min(100, (p.jobsFound / jobsPerDay) * 100));

  if (compact) {
    return (
      <Link href={`/app/headhunters/${profileId}`} className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2 text-xs text-white/60">
        <span className="size-1.5 animate-pulse rounded-full bg-coral" aria-hidden />
        Searching · {mins} min · {p.jobsFound} of {jobsPerDay}
      </Link>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-white/[0.04] p-3" aria-label={`${label} is searching`}>
      <div className="flex items-center gap-2.5">
        <Ninja mood="searching" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white">
            Searching <span className="text-white/45">· {mins} min</span>
          </p>
          <p className="text-xs text-white/45">
            {p.jobsFound} of {jobsPerDay} found
          </p>
        </div>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={jobsPerDay} aria-valuenow={p.jobsFound}>
        <div className={`h-full rounded-full bg-coral transition-[width] duration-700 ${p.jobsFound === 0 ? "w-[8%] animate-pulse" : ""}`} style={p.jobsFound ? { width: `${pct}%` } : undefined} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <Link href={`/app/headhunters/${profileId}`} className="text-white/45 hover:text-white">
          Details
        </Link>
        <button onClick={() => start(() => stopSearch(profileId))} disabled={stopping} className="text-white/45 hover:text-white disabled:opacity-50">
          {stopping ? "Stopping…" : "Stop"}
        </button>
      </div>
    </div>
  );
}
