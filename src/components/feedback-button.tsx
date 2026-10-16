"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus, X } from "lucide-react";
import { sendFeedback } from "@/app/feedback-actions";

const KINDS = [
  ["bug", "Something's broken"],
  ["idea", "An idea"],
  ["other", "Something else"],
] as const;

// A small button beside Settings. Opens a short form: what kind, what happened, send. The page
// the person was on goes along, so a bug report says where it happened.
export function FeedbackButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setMessage("");
      setError(undefined);
    }, 200);
  };
  const submit = () =>
    start(async () => {
      const r = await sendFeedback({ kind, message, page: typeof location !== "undefined" ? location.pathname : "" });
      if (r?.error) setError(r.error);
      else setSent(true);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "flex size-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white" : "flex size-7 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white"}
        title="Send feedback"
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        <span className="sr-only">Send feedback</span>
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0a0e14]/70 p-4 sm:items-center" onClick={close}>
            <div role="dialog" aria-labelledby="fb-title" className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-night-2 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p id="fb-title" className="font-display text-lg font-medium text-white">
                    {sent ? "Thanks, got it." : "Tell us what happened"}
                  </p>
                  <p className="mt-1 text-sm text-white/55">{sent ? "We read every one. If it's a bug, we'll fix it." : "A bug, an idea, or anything that bothered you. Short is fine."}</p>
                </div>
                <button type="button" onClick={close} className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white" aria-label="Close">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {!sent && (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {KINDS.map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`h-9 rounded-full px-3.5 text-sm font-medium transition-colors ${kind === k ? "bg-coral text-white" : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:text-white"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="field mt-3 min-h-28 w-full resize-y p-3"
                    placeholder={kind === "bug" ? "What did you do, and what went wrong?" : kind === "idea" ? "What would make this better for you?" : "Anything at all."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    autoFocus
                  />
                  {error && <p className="mt-2 text-sm text-rose">{error}</p>}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-white/40">Your username and this page come with it.</span>
                    <button type="button" className="btn btn-accent" disabled={pending || message.trim().length < 3} onClick={submit}>
                      {pending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </>
              )}
              {sent && (
                <button type="button" className="btn btn-accent mt-5 w-full justify-center" onClick={close}>
                  Close
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
