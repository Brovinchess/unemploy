"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { estimateSearchCost } from "@/lib/preferences";

// The app's live numbers, polled from /api/live: every 15 s while something is happening
// (a search, or the personal Mind answering), every 60 s otherwise, and not at all while
// the tab is hidden. When a server-rendered part changes (a search ends, jobs or answers
// arrive) the page is refreshed so lists and cards catch up without a reload.
export type Live = {
  at: string;
  profile: {
    id: string;
    searching: boolean;
    startedAt: string | null;
    lastDeliveryAt: string | null;
    jobsFound: number; // delivered in the current search
    balance: number | null; // the headhunter's cognition
  };
  newJobs: number; // across every headhunter
  toApply: number;
  answers: { forYou: number; asked: number; waiting: number; balance: number | null };
};

const ACTIVE_MS = 15_000;
const IDLE_MS = 60_000;

const Ctx = createContext<Live | null>(null);
export const useLive = () => useContext(Ctx);

const active = (l: Live) => l.profile.searching || l.answers.asked > 0;
// Changes that only a server render can show (cards, lists, badges in server JSX).
const needsRefresh = (a: Live, b: Live) =>
  a.profile.searching !== b.profile.searching ||
  a.profile.lastDeliveryAt !== b.profile.lastDeliveryAt ||
  b.newJobs > a.newJobs || // fewer new jobs means the user swiped, which already re-rendered
  a.answers.forYou !== b.answers.forYou ||
  a.answers.asked !== b.answers.asked;

export function LiveProvider({ initial, children }: { initial: Live; children: React.ReactNode }) {
  const router = useRouter();
  const [fetched, setFetched] = useState<Live | null>(null);
  const latest = useRef(initial);
  // After a refresh the server's snapshot is newer than the last poll; otherwise keep polling's.
  const live = fetched && fetched.at > initial.at ? fetched : initial;

  useEffect(() => {
    // A fresh server render (after an action or a refresh) is the new baseline to compare
    // polls against; otherwise a change the server already showed would never trigger a refresh.
    if (initial.at > latest.current.at) latest.current = initial;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetch(`/api/live?profile=${initial.profile.id}`, { cache: "no-store" });
        if (r.ok && !stop) {
          const d = (await r.json()) as Live;
          if (needsRefresh(latest.current, d)) router.refresh();
          latest.current = d;
          setFetched(d);
        }
      } catch {
        // Offline for a moment; the next tick retries.
      }
      if (!stop) timer = setTimeout(tick, active(latest.current) ? ACTIVE_MS : IDLE_MS);
    };
    const tick = () => (document.visibilityState === "visible" ? load() : (timer = setTimeout(tick, ACTIVE_MS)));
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      load();
    };
    timer = setTimeout(tick, active(initial) ? ACTIVE_MS : IDLE_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial, router]);

  return <Ctx.Provider value={live}>{children}</Ctx.Provider>;
}

// A clock that ticks every 30 s without reading the time during render (keeps renders pure).
export function useNow() {
  const tick = useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 30_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );
  return tick ? tick * 30_000 : null;
}

export function minutesSince(iso: string, now: number | null) {
  if (now == null) return 0;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}

// ---------- Sidebar pieces ----------

export function LiveCognition({ perSearchJobs }: { perSearchJobs: number }) {
  const live = useLive();
  const balance = live?.profile.balance ?? null;
  const perSearch = estimateSearchCost(perSearchJobs).cognition;
  const searchesLeft = balance != null ? Math.max(0, Math.floor(balance / perSearch)) : null;
  const low = balance != null && (balance <= 0 || searchesLeft === 0);
  const fill = searchesLeft == null ? 0 : Math.min(100, (searchesLeft / 10) * 100);
  return (
    <>
      <p className="flex items-baseline justify-between text-sm">
        <span className="text-white/60">Cognition</span>
        <span className={low ? "text-rose" : "text-white"}>{balance == null ? "–" : Math.round(balance)}</span>
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full transition-[width] duration-700 ${low ? "bg-rose" : "bg-coral"}`} style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-2 text-xs text-white/45">
        {balance == null
          ? "Balance unavailable"
          : `Enough for about ${searchesLeft} ${searchesLeft === 1 ? "search" : "searches"} of ${perSearchJobs} jobs`}
      </p>
    </>
  );
}

export function LiveCognitionShort() {
  const live = useLive();
  const balance = live?.profile.balance ?? null;
  return <>{balance == null ? "" : `${Math.round(balance)} cog`}</>;
}

export function LiveBadge({ kind }: { kind: "new" | "answers" }) {
  const live = useLive();
  const n = kind === "new" ? live?.newJobs : live?.answers.forYou;
  if (!n) return null;
  return <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-medium text-white">{n}</span>;
}
