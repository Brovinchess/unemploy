"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, X } from "lucide-react";
import { confirmEmailCode, sendEmailCode } from "@/app/notify-actions";

// Email verification on the You page. Verified: the address with a green tick. Not yet: a red
// cross and a Verify email button that opens into an address field, then six boxes for the code.
// A wrong code blinks the boxes red and clears them; a new code can be sent 30 seconds after the last.
const RESEND_AFTER = 30;

export function EmailVerify({ email, verified }: { email: string | null; verified: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "address" | "code" | "done">(verified ? "done" : "idle");
  const [draft, setDraft] = useState(email ?? "");
  const [sentTo, setSentTo] = useState<string>();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState<string>();
  const [devLog, setDevLog] = useState(false);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.trim());

  // The resend timer.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = (to: string) =>
    start(async () => {
      const r = await sendEmailCode(to);
      if (r && !r.ok) return setError(r.error);
      if (r?.ok && r.sentTo) {
        setSentTo(r.sentTo);
        setDevLog(!!r.devLog);
        setDigits(Array(6).fill(""));
        setError(undefined);
        setStage("code");
        setWait(RESEND_AFTER);
        setTimeout(() => boxes.current[0]?.focus(), 50);
      }
    });

  const check = (code: string) =>
    start(async () => {
      const r = await confirmEmailCode(sentTo!, code);
      if (r && !r.ok) {
        // Blink red, then clear and start again.
        setWrong(true);
        setError(r.error);
        setTimeout(() => {
          setWrong(false);
          setDigits(Array(6).fill(""));
          boxes.current[0]?.focus();
        }, 900);
        return;
      }
      setStage("done");
      router.refresh();
    });

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, k) => (k === i ? "" : x)));
      return;
    }
    // Pasting the whole code fills every box.
    const next = [...digits];
    const chars = clean.slice(0, 6 - i).split("");
    chars.forEach((c, k) => (next[i + k] = c));
    setDigits(next);
    const last = Math.min(5, i + chars.length);
    boxes.current[last]?.focus();
    if (next.every((c) => c)) check(next.join(""));
  };

  if (stage === "done") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
          <Mail className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-white">{sentTo ?? email}</p>
          <p className="text-sm text-white/45">Email</p>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400" aria-label="Verified">
          <Check className="size-4" aria-hidden />
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
          <Mail className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-white">No email verified yet</p>
          <p className="text-sm text-white/45">Needed before your headhunter can search.</p>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose/15 text-rose" aria-label="Not verified">
          <X className="size-4" aria-hidden />
        </span>
      </div>

      {stage === "idle" && (
        <button type="button" className="btn btn-primary mt-4 h-10 w-full" onClick={() => setStage("address")}>
          Verify email
        </button>
      )}

      {stage === "address" && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) send(draft.trim());
          }}
        >
          <input
            className="field h-11 min-w-0 flex-1"
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            aria-label="Email address"
          />
          <button className="btn btn-primary h-11 shrink-0" disabled={pending || !valid}>
            {pending ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {stage === "code" && (
        <div className="mt-4">
          <p className="text-sm text-white/60">
            Enter the 6-digit code sent to <span className="text-white">{sentTo}</span>.
          </p>
          {devLog && <p className="mt-1 text-xs text-rose">Running locally without an email service. The code is in the server log.</p>}
          <div className={`mt-3 flex gap-2 ${wrong ? "code-wrong" : ""}`} role="group" aria-label="Verification code">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="code-box"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                value={d}
                disabled={pending && !wrong}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                }}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-rose">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <button type="button" className="text-white/60 hover:text-white disabled:opacity-40" disabled={wait > 0 || pending} onClick={() => sentTo && send(sentTo)}>
              {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
            <button
              type="button"
              className="text-white/60 hover:text-white"
              onClick={() => {
                setStage("address");
                setError(undefined);
              }}
            >
              Use a different email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
