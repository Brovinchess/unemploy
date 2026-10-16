"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useActivity } from "./activity-feed";
import { Ninja } from "./brand";
import { useLive } from "./live";
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

// A clock that ticks every second, for the running timer. Renders 0 on the server.
function useSeconds() {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 1000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );
}

const two = (n: number) => String(n).padStart(2, "0");
export function elapsed(startIso: string, nowSec: number) {
  const s = Math.max(0, nowSec - Math.floor(new Date(startIso).getTime() / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

// Under the "out searching" heading: a running timer and one line on what the headhunter is
// doing right now. The line is its latest step from the activity feed (what it said, what it
// sent, what it worked on) and falls back to a phase read from the numbers.
export function SearchingPulse({ profileId, startedAt }: { profileId: string; startedAt: string | null }) {
  const live = useLive();
  const now = useSeconds();
  const data = useActivity(profileId, true);
  const start = (live?.profile.id === profileId ? live.profile.startedAt : null) ?? startedAt;
  const s = data?.stats;
  const latest = start ? data?.items.find((i) => i.kind !== "brief" && i.at >= start) : undefined;
  const phase = !s ? "Starting up" : s.deliveries > 0 ? PHASES[3] : s.webSearches > 0 ? PHASES[(Math.floor(s.webSearches / 5) % 3) as 0 | 1 | 2] : "Reading your brief";
  const status = latest?.title ?? phase;
  const bits = [
    s?.webSearches ? `${s.webSearches} ${s.webSearches === 1 ? "search" : "searches"}` : null,
    s?.filesRead ? `${s.filesRead} ${s.filesRead === 1 ? "file" : "files"} read` : null,
    s?.jobsAdded ? `${s.jobsAdded} ${s.jobsAdded === 1 ? "job" : "jobs"} sent` : null,
  ].filter(Boolean);
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-3 flex flex-col items-center">
      <p className="font-mono text-2xl tabular-nums text-white/85" aria-label="Time searching">
        {start && now ? elapsed(start, now) : "0:00"}
      </p>
      <p className="mt-2 text-sm text-coral">
        {status}
        <span className="inline-block w-5 text-left">{".".repeat(dots)}</span>
        {bits.length > 0 && <span className="ml-2 text-white/45">{bits.join(" · ")}</span>}
      </p>
    </div>
  );
}
