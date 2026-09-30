"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import {
  completeSignup,
  joinWaitlist,
  requestCode,
  saveWaitlistDetails,
  verifyCode,
  type JoinState,
} from "@/app/waitlist-actions";

const ROLE_AREAS = ["Engineering", "Design", "Product", "Marketing", "Sales", "Finance", "Operations", "Other"];

type WaitlistProps = { referral?: string; source?: string; appUrl: string; verify?: boolean };

// With `verify`, joining takes an emailed code, then name and birthdate. Without it (email
// not set up yet in production), it falls back to a single email field.
export function WaitlistForm(props: WaitlistProps) {
  return props.verify ? <VerifiedSignup {...props} /> : <SimpleSignup {...props} />;
}

const fieldCls =
  "h-14 w-full rounded-2xl bg-white/[0.09] px-5 text-base text-white outline-none ring-1 ring-transparent placeholder:text-white/40 focus:bg-white/[0.12] focus:ring-white/25 [color-scheme:dark]";

function PrimaryButton({ ready, pending, label, busy }: { ready: boolean; pending: boolean; label: string; busy: string }) {
  return (
    <button
      className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-medium transition-colors ${
        ready ? "bg-coral text-white hover:bg-[#b5585a]" : "bg-coral/25 text-white/45"
      }`}
      disabled={pending || !ready}
    >
      {pending ? busy : label} {!pending && ready && <ArrowRight className="size-4" aria-hidden />}
    </button>
  );
}

function VerifiedSignup({ referral, source, appUrl }: WaitlistProps) {
  const [codeState, sendAction, sending] = useActionState(requestCode, undefined);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code" | "details">("email");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string>();
  const [joined, setJoined] = useState<Extract<JoinState, { ok: true }>>();
  const [pending, start] = useTransition();

  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const sentTo = codeState?.ok ? codeState.email : undefined;
  const current = step === "email" && sentTo ? "code" : step;
  const [latestAdult] = useState(() => new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10));

  if (joined) return <Joined state={joined} appUrl={appUrl} />;

  if (current === "email") {
    return (
      <form action={sendAction} className="mx-auto w-full max-w-[26rem]">
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
          className={`mt-4 ${fieldCls}`}
        />
        <input name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input type="hidden" name="ref" value={referral ?? ""} />
        <input type="hidden" name="source" value={source ?? ""} />
        <PrimaryButton ready={looksValid} pending={sending} label="Continue" busy="Sending code…" />
        {codeState && !codeState.ok && (
          <p role="alert" className="mt-3 text-center text-sm text-rose">
            {codeState.error}
          </p>
        )}
        <p className="mt-4 text-center text-xs text-white/40">We&rsquo;ll email you a 6-digit code to confirm it&rsquo;s you.</p>
      </form>
    );
  }

  if (current === "code") {
    return (
      <form
        className="mx-auto w-full max-w-[26rem]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await verifyCode(sentTo!, code);
            if (!r.ok) return setError(r.error);
            setError(undefined);
            setTicket(r.ticket);
            if (r.joined) setJoined(r.joined);
            else setStep("details");
          });
        }}
      >
        <p className="text-center text-base text-white/50">
          Enter the code we sent to <span className="text-white">{sentTo}</span>
        </p>
        <input
          aria-label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`mt-4 text-center font-mono text-2xl tracking-[0.5em] ${fieldCls}`}
        />
        <PrimaryButton ready={code.length === 6} pending={pending} label="Verify" busy="Checking…" />
        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-rose">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-center gap-5 text-sm text-white/50">
          <button
            type="button"
            className="hover:text-white"
            onClick={() => {
              const fd = new FormData();
              fd.set("email", sentTo!);
              fd.set("ref", referral ?? "");
              fd.set("source", source ?? "");
              setCode("");
              setError(undefined);
              start(() => sendAction(fd));
            }}
          >
            Send a new code
          </button>
          <button type="button" className="hover:text-white" onClick={() => window.location.reload()}>
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="mx-auto w-full max-w-[26rem] text-left"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await completeSignup(ticket, name, birthdate);
          if (r?.ok) setJoined(r);
          else setError(r?.error);
        });
      }}
    >
      <p className="text-center text-base text-white/50">Email confirmed. Just two more things.</p>
      <label htmlFor="signup-name" className="mt-5 block text-sm text-white/60">
        Your name
      </label>
      <input
        id="signup-name"
        autoComplete="name"
        autoFocus
        placeholder="e.g. Sarah Lim"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`mt-2 ${fieldCls}`}
      />
      <label htmlFor="signup-birthdate" className="mt-4 block text-sm text-white/60">
        Date of birth
      </label>
      <input
        id="signup-birthdate"
        type="date"
        autoComplete="bday"
        max={latestAdult}
        value={birthdate}
        onChange={(e) => setBirthdate(e.target.value)}
        className={`mt-2 ${fieldCls}`}
      />
      <PrimaryButton ready={!!name.trim() && !!birthdate} pending={pending} label="Join the waitlist" busy="Joining…" />
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-rose">
          {error}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-white/40">You must be 18 or older. See our privacy policy for how we use this.</p>
    </form>
  );
}

function SimpleSignup({ referral, source, appUrl }: WaitlistProps) {
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
