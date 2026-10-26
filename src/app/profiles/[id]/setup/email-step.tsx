"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmEmailCode, sendEmailCode } from "@/app/notify-actions";
import { FormError } from "@/components/onboarding-shell";

// Second thing we ask: where the jobs should go. A 6-digit code checks the address before anything
// is sent to it. Setup carries on only once it is confirmed; updates are on from then, and the
// switch to turn them off lives in Settings.
export function EmailStep() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [devLog, setDevLog] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (sentTo) {
    return (
      <form
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await confirmEmailCode(sentTo, code);
            if (r && !r.ok) return setError(r.error);
            router.refresh();
          });
        }}
      >
        <p className="text-white/70">
          Enter the 6-digit code we sent to <span className="text-white">{sentTo}</span>.
        </p>
        {devLog && <p className="mt-2 text-sm text-rose">Running locally without an email service, so no email was sent. The code is in the server log.</p>}
        <input
          className="field mt-4 h-14 text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          autoFocus
          aria-label="Verification code"
        />
        <FormError message={error} />
        <button className="btn btn-primary mt-6 h-12 w-full" disabled={pending || code.length !== 6}>
          {pending ? "Checking…" : "Continue"}
        </button>
        <div className="mt-4 flex justify-center gap-5 text-sm text-white/50">
          <button
            type="button"
            className="hover:text-white"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendEmailCode(sentTo);
                if (r && !r.ok) setError(r.error);
                else setError(undefined);
              })
            }
          >
            Send the code again
          </button>
          <button type="button" className="hover:text-white" onClick={() => { setSentTo(undefined); setCode(""); setError(undefined); }}>
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendEmailCode(email);
          if (r && !r.ok) return setError(r.error);
          if (r?.ok && r.sentTo) {
            setSentTo(r.sentTo);
            setDevLog(!!r.devLog);
            setError(undefined);
          }
        });
      }}
    >
      <label className="block">
        <span className="sr-only">Your email</span>
        <input
          className="field h-14 text-lg"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          autoComplete="email"
          required
        />
      </label>
      <p className="mt-3 text-sm text-muted">We send a 6-digit code to check it is right. Nothing else goes to it until your headhunter finds jobs.</p>
      <FormError message={error} />
      <button className="btn btn-primary mt-8 h-12 w-full" disabled={pending || !email.includes("@")}>
        {pending ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}
