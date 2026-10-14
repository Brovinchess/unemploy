"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the field is selectable */
    }
  };
  return (
    <div className="flex gap-2">
      <input className="field h-11 font-mono text-sm" value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Your referral link" />
      <button type="button" className="btn btn-accent h-11 shrink-0" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
