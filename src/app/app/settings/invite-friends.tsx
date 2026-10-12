"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// The person's referral link with a copy button, and how their invites are doing.
export function InviteFriends({ link, reward, stats }: { link: string; reward: number; stats: { joined: number; qualified: number; owed: number; paid: number } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the field is selectable as a fallback */
    }
  };
  return (
    <div>
      <p className="text-white/70">
        Know someone job hunting? Share your link. When their first headhunter is running, you get <span className="text-white">{reward} cognition</span>, added to your headhunter within a week.
      </p>
      <div className="mt-4 flex gap-2">
        <input className="field h-11 font-mono text-sm" value={link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Your invite link" />
        <button type="button" className="btn btn-primary h-11 shrink-0" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-4 text-sm text-white/50">
        {stats.joined === 0
          ? "No one has used your link yet."
          : `${stats.joined} ${stats.joined === 1 ? "friend" : "friends"} joined · ${stats.qualified} started searching` +
            (stats.owed ? ` · ${stats.owed} cognition on its way` : "") +
            (stats.paid ? ` · ${stats.paid} received` : "")}
      </p>
    </div>
  );
}
