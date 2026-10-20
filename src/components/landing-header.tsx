"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ninja, Wordmark } from "./brand";

// The public pages, in the order they read. Search engines take site links from these too.
const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/extension", label: "Chrome extension" },
  { href: "/#faq", label: "Questions" },
];

// Muse-style header: wordmark left, a small product mark in the centre once the hero
// has scrolled away, the page links and one pill action on the right.
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
          <Ninja className="size-8" />
        </a>
        <div className="flex items-center gap-6">
          <nav aria-label="Pages" className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-white/60 transition-colors hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <a href={action.href} className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose">
            {action.label}
          </a>
        </div>
      </div>
    </header>
  );
}
