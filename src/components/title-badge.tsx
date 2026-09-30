"use client";

import { useEffect } from "react";

// "(3) Career Ninja" in the browser tab while there are new jobs, so they're noticed from
// another tab. The page refreshes itself when jobs land, which updates the count.
export function TitleBadge({ count }: { count: number }) {
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count]);
  return null;
}
