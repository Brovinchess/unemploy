"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <button
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4 text-coral" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-line px-4 py-3 text-[0.9375rem] leading-relaxed">{text}</p>
    </div>
  );
}
