"use client";

import { useEffect, useState } from "react";
import { useActivity } from "./activity-feed";
import { Ninja } from "./brand";
import { Radar } from "./searching-scene";

// Mochi at work: the radar sweeps behind, three sparks orbit, and the line under it says what
// the headhunter is actually doing right now, from its live activity. Idle, it's a still radar.
export function MochiAtWork({ live, paused, className = "size-16" }: { live: boolean; paused?: boolean; className?: string }) {
  return (
    <div className="relative flex size-28 shrink-0 items-center justify-center">
      <Radar live={live} />
      {live && (
        <span className="orbit absolute inset-3" aria-hidden>
          <i className="spark" style={{ ["--a" as string]: "0deg" }} />
          <i className="spark" style={{ ["--a" as string]: "120deg" }} />
          <i className="spark" style={{ ["--a" as string]: "240deg" }} />
        </span>
      )}
      <Ninja mood={live ? "searching" : paused ? "sleeping" : "happy"} className={`relative ${className} ${live ? "bob" : ""}`} />
    </div>
  );
}

const PHASES = ["Scanning careers pages", "Reading postings", "Checking who can apply", "Writing applications"];

export function SearchingLine({ profileId }: { profileId: string }) {
  const data = useActivity(profileId, true);
  const s = data?.stats;
  // What it's up to, from the numbers: sent something → writing; searched → scanning; else reading the brief.
  const phase = !s ? "Starting up" : s.deliveries > 0 ? PHASES[3] : s.webSearches > 0 ? PHASES[(Math.floor(s.webSearches / 5) % 3) as 0 | 1 | 2] : "Reading your brief";
  const bits = [
    s?.webSearches ? `${s.webSearches} ${s.webSearches === 1 ? "search" : "searches"}` : null,
    s?.filesRead ? `${s.filesRead} ${s.filesRead === 1 ? "file" : "files"} read` : null,
    s?.jobsAdded ? `${s.jobsAdded} ${s.jobsAdded === 1 ? "job" : "jobs"} sent` : null,
  ].filter(Boolean);
  // Three dots that walk, so the line reads as live even between updates.
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="mt-2 text-sm text-coral">
      {phase}
      <span className="inline-block w-5 text-left">{".".repeat(dots)}</span>
      {bits.length > 0 && <span className="ml-2 text-white/45">{bits.join(" · ")}</span>}
    </p>
  );
}
