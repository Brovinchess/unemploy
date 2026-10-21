"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowRight, X } from "lucide-react";
import { Ninja } from "@/components/brand";
import type { Outcome } from "@/lib/outcome";
import { applyOutcomeFix } from "@/app/actions";

// The card that stands where the job cards would be after a search came back short. One next
// move: the button applies a settings change on the spot, or leads to the right place. Closing
// it hides it for this search only; the next search brings its own.
// Closed cards are remembered per search in this browser only; the server renders every card
// visible and the client hides the closed ones once it knows.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
const isClosed = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

export function SearchOutcome({ profileId, outcome, after }: { profileId: string; outcome: Outcome; after?: React.ReactNode }) {
  const key = `outcome:${outcome.searchId}`;
  const hidden = useSyncExternalStore(subscribe, () => isClosed(key), () => false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {}
    for (const fn of listeners) fn();
  };
  const apply = () =>
    start(async () => {
      if (!outcome.button?.fix) return;
      const r = await applyOutcomeFix(profileId, outcome.button.fix);
      if (r?.error) setError(r.error);
      else setDone(true);
    });

  if (hidden) return null;

  if (outcome.kind === "partial") {
    return (
      <p className="rise mb-4 text-sm text-white/55">
        <span className="font-medium text-white/80">{outcome.headline}</span> {outcome.body}
      </p>
    );
  }

  return (
    <section className="rise relative mb-6 rounded-3xl bg-surface p-6 sm:p-8">
      <button type="button" onClick={close} className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08] hover:text-white" aria-label="Close">
        <X className="size-4" aria-hidden />
      </button>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Ninja mood={outcome.mood} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
            Last search: {outcome.found} of {outcome.wanted}
          </p>
          <h2 className="font-display mt-2 text-xl font-medium leading-snug text-white sm:text-2xl">{done ? "Done. Your next search uses this." : outcome.headline}</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/60">{done ? "Press Find new jobs whenever you're ready." : outcome.body}</p>
          {error && <p className="mt-2 text-sm text-rose">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!done && outcome.button?.fix && (
              <button type="button" className="btn btn-accent" disabled={pending} onClick={apply}>
                {pending ? "Saving…" : outcome.button.label}
              </button>
            )}
            {!done && outcome.button?.href && !outcome.button.fix && (
              outcome.button.href.startsWith("http") ? (
                <a href={outcome.button.href} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                  {outcome.button.label} <ArrowRight className="size-4" aria-hidden />
                </a>
              ) : (
                <Link href={outcome.button.href} className="btn btn-accent">
                  {outcome.button.label} <ArrowRight className="size-4" aria-hidden />
                </Link>
              )
            )}
            {after}
          </div>
        </div>
      </div>
    </section>
  );
}
