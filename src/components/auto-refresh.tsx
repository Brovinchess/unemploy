"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the page on an interval while we wait for the headhunter's first delivery.
export function AutoRefresh({ everyMs = 8000, forMs = 10 * 60 * 1000 }: { everyMs?: number; forMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > forMs) clearInterval(id);
      else router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, forMs]);
  return null;
}
