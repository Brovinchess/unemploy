"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ninja } from "./brand";

const KEY = "cn-cognition-intro";

// Shown once, right after setup: dims the page, lights up the cognition card in the sidebar
// and says in two lines what cognition is. On small screens (no sidebar) it's a plain card.
export function CognitionIntro() {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      /* no storage: show it anyway */
    }
    const t = setTimeout(() => {
      const el = document.getElementById("cognition-card");
      setRect(el && el.offsetParent ? el.getBoundingClientRect() : null);
      setShow(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* fine */
    }
    setShow(false);
  };

  if (!show) return null;
  const pad = 8;
  const card = (
    <div role="dialog" aria-labelledby="cog-title" className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-white/[0.08] bg-night-2 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
      <div className="flex items-start gap-3">
        <Ninja mood="thinking" className="size-12 shrink-0" />
        <div>
          <p id="cog-title" className="font-display text-lg font-medium text-white">
            This is cognition
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/65">
            The credit your headhunter runs on, like fuel. Every search uses some, nothing is spent in between, and you can top up on Hello
            Minds any time.
          </p>
        </div>
      </div>
      <button className="btn btn-accent mt-4 w-full justify-center" onClick={dismiss}>
        Got it
      </button>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={dismiss}>
      {rect ? (
        <>
          {/* the hole: a huge shadow around the card's box */}
          <div
            className="absolute rounded-2xl ring-2 ring-coral"
            style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(10, 14, 20, 0.72)" }}
          />
          <div className="absolute" style={{ left: rect.right + 20, bottom: Math.max(16, window.innerHeight - rect.bottom - pad) }} onClick={(e) => e.stopPropagation()}>
            {card}
          </div>
        </>
      ) : (
        <div className="flex h-full items-end justify-center bg-night/80 p-4 sm:items-center">
          <div onClick={(e) => e.stopPropagation()}>{card}</div>
        </div>
      )}
    </div>,
    document.body,
  );
}
