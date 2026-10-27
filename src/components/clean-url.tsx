"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Removes one-off query parameters from the address bar once the page has used them, so the URL
// reads /app rather than /app?profile=…&welcome=1. Done through the router, so Next.js keeps the
// new address (a raw history.replaceState was put back by the router).
export function useDropParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (names: string[]) => {
    const next = new URLSearchParams(params.toString());
    let changed = false;
    for (const n of names) {
      if (next.has(n)) {
        next.delete(n);
        changed = true;
      }
    }
    if (changed) router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
}

export function CleanUrl({ drop }: { drop: string[] }) {
  const dropParams = useDropParams();
  const params = useSearchParams();
  const key = drop.join(",");
  const present = key && key.split(",").some((n) => params.has(n));
  useEffect(() => {
    if (present) dropParams(key.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, key]);
  return null;
}
