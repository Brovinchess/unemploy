"use client";

import { useEffect } from "react";
import { useLive } from "./live";

// "(3) Career Ninja" in the browser tab while there are new jobs, so they're noticed from
// another tab. Follows the live count.
export function TitleBadge({ count: initial }: { count: number }) {
  const live = useLive();
  const count = live?.newJobs ?? initial;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, initial]);
  return null;
}
