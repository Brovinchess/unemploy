"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CompanyLogo } from "./company-logo";
import type { Find } from "@/lib/found";

// One slim bar under the hero that shows, one at a time, what headhunters found in the last two
// weeks. Title, company and place only. It changes every few seconds, pauses while hovered, and
// stands still for people who prefer reduced motion.
const EVERY_MS = 3800;
const MQ = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (fn: () => void) => {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
const reducedMotion = () => window.matchMedia(MQ).matches;

export function FoundBar({ items, compact = false }: { items: Find[]; compact?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  useEffect(() => {
    if (paused || still || items.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), EVERY_MS);
    return () => clearInterval(t);
  }, [paused, still, items.length]);
  if (!items.length) return null;
  const f = items[i % items.length];
  // In the app sidebar: a small card above the cognition card, two lines, same rotation.
  if (compact) {
    return (
      <div className="rounded-2xl bg-white/[0.04] p-4" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite">
        <p className="text-xs text-white/40">Found lately</p>
        <div key={i} className="found-swap mt-2 flex items-start gap-2.5">
          <CompanyLogo name={f.company} domain={f.domain} size="sm" />
          <div className="min-w-0 text-sm leading-snug">
            <p className="text-white/45">
              <span className="text-white/70">{f.owner}</span>&rsquo;s headhunter found
            </p>
            <p className="truncate text-white">{f.title}</p>
            <p className="truncate text-white/55">
              {f.company}
              {f.place ? ` · ${f.place}` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <section
      className="border-y border-white/[0.06] bg-night-2 px-[6%] py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center text-sm">
        <span key={i} className="found-swap flex min-w-0 items-center gap-2.5 text-white/85">
          <span className="shrink-0 text-white/45">
            <span className="text-white/70">{f.owner}</span>&rsquo;s headhunter found
          </span>
          <CompanyLogo name={f.company} domain={f.domain} size="sm" />
          <span className="truncate">
            <span className="text-white">{f.title}</span> at {f.company}
            {f.place ? <span className="text-white/45"> · {f.place}</span> : null}
          </span>
        </span>
      </div>
    </section>
  );
}
