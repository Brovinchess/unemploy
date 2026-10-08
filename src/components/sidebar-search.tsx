"use client";

import Link from "next/link";
import { minutesSince, useLive, useNow } from "./live";

// The second line of a headhunter's sidebar row: its Mind name normally, and while it
// searches, "Searching · 12 min · 0 of 5" with a thin progress line. Live for the current
// headhunter; a plain "Searching" for the others.
export function RowStatus({ profileId, mindName, jobsPerDay, searching }: { profileId: string; mindName: string; jobsPerDay: number; searching: boolean }) {
  const live = useLive();
  const now = useNow();
  const p = live?.profile.id === profileId ? live.profile : null;
  const on = p ? p.searching : searching;
  if (!on) return <span className="block truncate font-mono text-[11px] text-white/35">{mindName}</span>;
  const found = p?.jobsFound ?? 0;
  const mins = p?.startedAt ? minutesSince(p.startedAt, now) : null;
  const pct = Math.max(4, Math.min(100, (found / jobsPerDay) * 100));
  return (
    <>
      <span className="block truncate text-[11px] text-coral">
        Searching{mins != null ? ` · ${mins} min` : ""}
        {p ? <span className="text-white/45"> · {found} of {jobsPerDay}</span> : null}
      </span>
      <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={jobsPerDay} aria-valuenow={found}>
        <span className={`block h-full rounded-full bg-coral transition-[width] duration-700 ${found === 0 ? "w-[8%] animate-pulse" : ""}`} style={found ? { width: `${pct}%` } : undefined} />
      </span>
    </>
  );
}

// A running search on small screens: one thin line under the top bar.
export function SidebarSearch({ profileId, jobsPerDay }: { profileId: string; jobsPerDay: number }) {
  const live = useLive();
  const now = useNow();
  const p = live?.profile.id === profileId ? live.profile : null;
  if (!p?.searching) return null;
  const mins = p.startedAt ? minutesSince(p.startedAt, now) : 0;

  return (
    <Link href={`/app/headhunters/${profileId}`} className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2 text-xs text-white/60">
      <span className="size-1.5 animate-pulse rounded-full bg-coral" aria-hidden />
      Searching · {mins} min · {p.jobsFound} of {jobsPerDay}
    </Link>
  );
}
