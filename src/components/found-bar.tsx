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

export function FoundBar({ items }: { items: Find[] }) {
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
          </span>
        </span>
      </div>
    </section>
  );
}
