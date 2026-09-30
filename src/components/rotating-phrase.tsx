"use client";

import { useEffect, useState } from "react";

// Cycles through phrases like Muse's hero. Screen readers get the full list once, and the
// animation stops for people who prefer reduced motion.
export function RotatingPhrase({ phrases, intervalMs = 2400 }: { phrases: string[]; intervalMs?: number }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [phrases.length, intervalMs]);

  return (
    <span className="relative inline-grid overflow-hidden pb-[0.12em] align-bottom">
      <span className="sr-only">{phrases.join(", ")}</span>
      {phrases.map((p, n) => (
        <span
          key={p}
          aria-hidden
          className={`col-start-1 row-start-1 transition-[translate,opacity] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            n === i
              ? "translate-y-0 opacity-100"
              : n === (i - 1 + phrases.length) % phrases.length
                ? "-translate-y-full opacity-0"
                : "translate-y-full opacity-0 duration-0"
          }`}
        >
          {p}
        </span>
      ))}
    </span>
  );
}
