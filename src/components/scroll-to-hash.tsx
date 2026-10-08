"use client";

import { useEffect } from "react";

// Pages stream in, so the browser's own #hash jump often fires before the target exists.
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    const el = () => document.getElementById(id);
    const t = setTimeout(() => {
      el()?.scrollIntoView({ behavior: "smooth", block: "start" });
      el()?.classList.add("spotlight");
    }, 50);
    const off = setTimeout(() => el()?.classList.remove("spotlight"), 3500);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [id]);
  return null;
}
