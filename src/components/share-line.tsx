"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Offered once the first jobs are in: the person's referral link, one tap to copy. Says only
// what is true today: the friend's first searches are free.
export function ShareLine({ url, className = "" }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your link", url);
    }
  };
  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/50 ${className}`}>
      <span>Know someone job hunting? Their first searches are free with your link.</span>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white/80 ring-1 ring-white/15 hover:bg-white/[0.06] hover:text-white">
        {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy link"}
      </button>
    </p>
  );
}
