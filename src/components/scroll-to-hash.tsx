"use client";

import { useEffect } from "react";

// Pages stream in, so the browser's own #hash jump often fires before the target exists.
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [id]);
  return null;
}
