"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mark, Wordmark } from "./brand";

// Muse-style header: wordmark left, a small product mark in the centre once the hero
// has scrolled away, one pill action on the right.
export function LandingHeader({ action }: { action: { label: string; href: string } }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-night">
      <div className="relative flex h-15 items-center justify-between px-[6%]">
        <Link href="/" aria-label="Career Ninja home">
          <Wordmark />
        </Link>
        <a
          href="#top"
          aria-label="Back to top"
          className={`absolute left-1/2 -translate-x-1/2 transition-opacity duration-300 ${scrolled ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <Mark className="size-8" />
        </a>
        <a href={action.href} className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose">
          {action.label}
        </a>
      </div>
    </header>
  );
}
