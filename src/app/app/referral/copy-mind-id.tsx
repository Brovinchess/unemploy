"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyMindId({ id, name }: { id: string; name: string }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <p className="text-sm text-white/45">Finish setting up a headhunter first.</p>;
  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded-xl bg-night-2 px-3 py-2 font-mono text-xs text-white/80" title={name}>
        {id}
      </code>
      <button
        type="button"
        className="btn btn-ghost btn-sm shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* selectable */
          }
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
