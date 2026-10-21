"use client";

import { useState, useTransition } from "react";
import { backfillEmailsFromTokens, tokenFieldCheck, type TokenCheck } from "@/app/admin-actions";

// Two buttons: what the stored sign-in tokens carry (field names only), and fill in emails
// from them for people who have none.
export function TokenCheckPanel() {
  const [check, setCheck] = useState<TokenCheck>();
  const [filled, setFilled] = useState<{ filled: number; checked: number }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-xs text-white/70 ring-1 ring-white/10 hover:text-white disabled:opacity-40" disabled={pending} onClick={() => start(async () => setCheck(await tokenFieldCheck()))}>
          Check what sign-in tokens carry
        </button>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-xs text-white/70 ring-1 ring-white/10 hover:text-white disabled:opacity-40" disabled={pending || !check?.withEmail} onClick={() => start(async () => setFilled(await backfillEmailsFromTokens()))}>
          Fill in emails from tokens
        </button>
      </div>
      {check && (
        <p className="text-white/70">
          Checked {check.checked} tokens. {check.withEmail} carry an email address. Fields: {check.fields.join(", ") || "none readable"}.
          {check.scopesSeen.length ? ` Scopes granted: ${check.scopesSeen.map((s) => (s.includes("email") ? "with email" : "without email")).filter((v, i, a) => a.indexOf(v) === i).join(" and ")}.` : ""}
        </p>
      )}
      {filled && <p className="text-white/70">Filled {filled.filled} of {filled.checked} people who had no email.</p>}
    </div>
  );
}
