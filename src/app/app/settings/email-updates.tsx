"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { confirmEmailCode, removeEmail, sendEmailCode, setSearchEmails } from "@/app/notify-actions";

export function EmailUpdates({ email, on }: { email: string | null; on: boolean }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [devLog, setDevLog] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(!email);

  if (email && !editing) {
    return (
      <div>
        <p className="flex items-center gap-2 text-white">
          <Mail className="size-4 text-coral" aria-hidden /> {email}
        </p>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-night-2 px-4 py-3.5">
          <span>
            <span className="block text-white">Email me when a search finishes</span>
            <span className="block text-sm text-white/50">With the new jobs and their match scores</span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--coral)]"
            checked={on}
            disabled={pending}
            onChange={(e) => start(() => setSearchEmails(e.target.checked))}
          />
        </label>
        <div className="mt-4 flex gap-4 text-sm">
          <button className="text-white/55 hover:text-white" onClick={() => setEditing(true)}>
            Change email
          </button>
          <button className="text-white/55 hover:text-rose" disabled={pending} onClick={() => start(() => removeEmail())}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await confirmEmailCode(sentTo, code);
            if (r && !r.ok) setError(r.error);
            else {
              setSentTo(undefined);
              setEditing(false);
              setError(undefined);
            }
          });
        }}
      >
        <p className="text-white/70">
          Enter the 6-digit code we sent to <span className="text-white">{sentTo}</span>.
        </p>
        {devLog && (
          <p className="mt-2 text-sm text-rose">
            Running locally without an email service, so no email was sent. The code is in the server log.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className="field h-11 max-w-44 text-center tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            autoFocus
            aria-label="Verification code"
          />
          <button className="btn btn-primary h-11" disabled={pending || code.length !== 6}>
            {pending ? "Checking…" : "Verify"}
          </button>
        </div>
        <button type="button" className="mt-3 text-sm text-white/50 hover:text-white" onClick={() => setSentTo(undefined)}>
          Use a different email
        </button>
        {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendEmailCode(draft);
          if (r && !r.ok) setError(r.error);
          else if (r?.ok && r.sentTo) {
            setSentTo(r.sentTo);
            setDevLog(!!r.devLog);
            setError(undefined);
          }
        });
      }}
    >
      <p className="text-white/70">Get an email when a search finishes, with the new jobs. We&rsquo;ll send a code to confirm it&rsquo;s you.</p>
      <div className="mt-3 flex gap-2">
        <input
          className="field h-11"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          required
          aria-label="Email address"
        />
        <button className="btn btn-primary h-11 shrink-0" disabled={pending}>
          {pending ? "Sending…" : "Send code"}
        </button>
      </div>
      {email && (
        <button type="button" className="mt-3 text-sm text-white/50 hover:text-white" onClick={() => setEditing(false)}>
          Cancel
        </button>
      )}
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
    </form>
  );
}
