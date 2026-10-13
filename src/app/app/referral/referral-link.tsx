"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { saveHmReferral, type LinkState } from "./actions";

// Step 3 of the Referral page: paste the Hello Minds link once, then copy it whenever you like.
export function ReferralLink({ saved }: { saved: string | null }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(saveHmReferral, undefined);
  const [editing, setEditing] = useState(!saved);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the field is selectable */
    }
  };

  if (saved && !editing) {
    return (
      <div>
        <div className="flex gap-2">
          <input className="field h-11 font-mono text-sm" value={saved} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Your Hello Minds referral link" />
          <button type="button" className="btn btn-primary h-11 shrink-0" onClick={copy}>
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button type="button" className="mt-3 text-sm text-white/50 hover:text-white" onClick={() => setEditing(true)}>
          Change link
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input name="link" className="field h-11 font-mono text-sm" placeholder="hellominds.ai/join?platform=hellominds&tag=yourtag" defaultValue={saved ?? ""} aria-label="Hello Minds referral link" />
      <button className="btn btn-primary h-11 shrink-0" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <p className="text-sm text-rose sm:basis-full">{state.error}</p>}
    </form>
  );
}
