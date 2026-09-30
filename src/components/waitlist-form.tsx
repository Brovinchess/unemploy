"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { joinWaitlist, saveWaitlistDetails } from "@/app/waitlist-actions";

const ROLE_AREAS = ["Engineering", "Design", "Product", "Marketing", "Sales", "Finance", "Operations", "Other"];

export function WaitlistForm({ referral, source, appUrl }: { referral?: string; source?: string; appUrl: string }) {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);
  const [email, setEmail] = useState("");
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  if (state?.ok) return <Joined state={state} appUrl={appUrl} />;

  return (
    <form action={action} className="mx-auto w-full max-w-[26rem]">
      <label htmlFor="waitlist-email" className="block text-center text-base text-white/50">
        Join the waitlist
      </label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-4 h-14 w-full rounded-2xl bg-white/[0.09] px-5 text-base text-white outline-none ring-1 ring-transparent placeholder:text-white/40 focus:bg-white/[0.12] focus:ring-white/25"
      />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input type="hidden" name="ref" value={referral ?? ""} />
      <input type="hidden" name="source" value={source ?? ""} />
      <button
        className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-medium transition-colors ${
          looksValid ? "bg-coral text-white hover:bg-rose" : "bg-coral/25 text-white/45"
        }`}
        disabled={pending || !looksValid}
      >
        {pending ? "Joining…" : "Continue"} {!pending && looksValid && <ArrowRight className="size-4" aria-hidden />}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-3 text-center text-sm text-coral-soft">
          {state.error}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-white/40">One email when your spot opens. No spam.</p>
    </form>
  );
}

function Joined({ state, appUrl }: { state: Extract<NonNullable<Awaited<ReturnType<typeof joinWaitlist>>>, { ok: true }>; appUrl: string }) {
  const link = `${appUrl}/?ref=${state.code}`;
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const askDetails = !!state.id && !saved;

  return (
    <div className="mx-auto w-full max-w-md text-center" aria-live="polite">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-coral text-white">
        <Check className="size-5" aria-hidden />
      </span>
      <p className="font-display mt-4 text-2xl font-medium text-white">
        {state.alreadyJoined ? "You're already on the list" : "You're on the list"}
      </p>
      <p className="mt-1 text-white/70">
        You&rsquo;re <span className="font-semibold text-white">#{state.position}</span> in line
        {state.referrals > 0 && <> · {state.referrals} friend{state.referrals === 1 ? "" : "s"} joined from your link</>}
      </p>

      {askDetails && (
        <div className="mt-6 rounded-2xl bg-white/5 p-5 text-left">
          <p className="text-sm font-semibold text-white">Two quick questions, so we build for you</p>
          <p className="mt-3 text-sm text-white/70">What kind of job are you looking for?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLE_AREAS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:border-white/40 aria-pressed:border-coral aria-pressed:bg-coral aria-pressed:text-white"
              >
                {r}
              </button>
            ))}
          </div>
          <label htmlFor="waitlist-country" className="mt-4 block text-sm text-white/70">
            Which country do you want to work in?
          </label>
          <input
            id="waitlist-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Malaysia"
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-white/45 focus:border-white/40"
          />
          <button
            type="button"
            className="btn btn-accent btn-sm mt-4 w-full"
            disabled={pending || (!role && !country.trim())}
            onClick={() =>
              start(async () => {
                await saveWaitlistDetails(state.id, role, country);
                setSaved(true);
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {saved && <p className="mt-6 text-sm text-white/70">Thanks, that helps a lot.</p>}

      <div className="mt-6 rounded-2xl border border-white/10 p-4 text-left">
        <p className="text-sm text-white/70">Know someone job hunting? Share your link:</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{link}</code>
          <button
            type="button"
            className="btn btn-sm shrink-0 bg-white text-night hover:bg-white/90"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
