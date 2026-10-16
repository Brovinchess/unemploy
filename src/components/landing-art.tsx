
// Illustrations for the landing page: a job card, its face-down front, and the extension
// filling a form. Purely decorative (aria-hidden at the call site).

// 16:9: a resume goes in, the headhunter works, matched jobs come out.
// Square: a few strong matches, ranked.
// Square: a line in the cover letter, traced to the same line in the resume.
// Square: you decide. Approve or skip.
// Square: one headhunter per kind of job, each with its own resume.
// ---------- Muse-style panels: real product UI, dark, floating on the band, no frame ----------

// ---------- Product mock-ups: the real screens, drawn with the real components ----------

import { CompanyLogo } from "./company-logo";
import { Banknote, BadgeCheck, Check as CheckIcon, Clock, MapPin, Sparkles, X as XIcon } from "lucide-react";
import { Ninja as Mochi } from "./brand";

// A revealed job card, exactly as the app draws it, with sample data.
export function CardMock() {
  // A real posting (Stripe, Greenhouse job 7994443, October 2026), with an example person's fit.
  const must = [
    ["7+ years in product", true],
    ["Owned a product end to end", true],
    ["Shipped across regulated complexity", true],
    ["Enterprise and GTM experience", false],
  ] as const;
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[32px] border border-white/[0.07] bg-surface p-6 shadow-[0_40px_100px_-30px_rgba(201,101,103,0.45)]">
      <div className="flex items-center gap-3.5">
        <CompanyLogo name="Stripe" domain="stripe.com" size="lg" />
        <div className="min-w-0">
          <p className="font-display text-[20px] font-semibold leading-tight">Product Manager, Global Payouts</p>
          <p className="mt-1 text-[13px] text-white/55">Stripe</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium text-white/85 ring-1 ring-white/10">
          <MapPin className="size-4 text-coral" /> New York · Remote, US Eastern time
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium text-white/85 ring-1 ring-white/10">
          <Banknote className="size-4 text-coral" /> Full-time
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-white/85">
            You meet <b className="font-semibold text-white">3 of 4</b> requirements
          </span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {must.map(([r, ok]) => (
            <span key={r} className={`h-1.5 flex-1 rounded-full ${ok ? "bg-coral" : "bg-white/10"}`} />
          ))}
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/50">
        <span>Senior · stripe.com/jobs</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> Posted this month
        </span>
        <span className="inline-flex items-center gap-1 text-white/70">
          <BadgeCheck className="size-3.5 text-coral" /> Open today
        </span>
      </div>
      <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">The role</h4>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/80">Lead cross-border payouts at Stripe: rate locking, local bank coverage and card rails for businesses paying people worldwide.</p>
      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">Why it fits you</h4>
      <ul className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-white/80">
        <li className="flex gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.8} /> You shipped payout and settlement flows at a fintech
        </li>
        <li className="flex gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.8} /> Eight years in product, above the seven they ask for
        </li>
      </ul>
      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">Requirements</h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {must.map(([r, ok]) => (
          <span
            key={r}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] ${ok ? "border-white/[0.07] bg-white/[0.05] text-white/80" : "border-coral/30 bg-coral/[0.08] text-rose"}`}
          >
            {ok ? <CheckIcon className="size-3.5 text-coral" /> : <XIcon className="size-3.5" />}
            {r}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3.5 text-[13px]">
        <span>Your application is written and ready.</span>
        <span className="text-rose">Open ↗</span>
      </div>
    </div>
  );
}

// The face-down card, as it arrives.
export function FrontMock() {
  return (
    <div className="relative mx-auto flex w-full max-w-[400px] flex-col items-center rounded-[32px] border border-white/[0.07] bg-surface px-6 py-8 text-center">
      <p className="w-full text-left text-[11px] uppercase tracking-[0.3em] text-white/35">
        Career Ninja <span className="float-right">No. 1</span>
      </p>
      <div className="relative mt-6 flex size-44 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-coral/20" />
        <span className="absolute inset-6 rounded-full border border-coral/15" />
        <span className="absolute size-28 rounded-full bg-coral/25 blur-3xl" />
        <Mochi mood="surprised" className="float relative size-28" />
      </div>
      <p className="font-display mt-6 text-[20px] font-medium">A job picked for you</p>
      <p className="mt-1.5 text-sm text-white/50">Reveal it to see what your headhunter found.</p>
      <span className="mt-6 flex h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-b from-[#d27375] to-coral text-base font-semibold text-white">Reveal</span>
    </div>
  );
}

// The search status panel while a headhunter works.
// The You page: an answer to check, one it couldn't know.
// The extension filling a form.
export function ExtensionMock() {
  const rows: [string, string, boolean][] = [
    ["First name", "Alex", true],
    ["Email", "alex@example.com", true],
    ["Resume", "Alex_Tan_Resume.pdf", true],
    ["Why do you want to work at Stripe?", "Payouts are what I spent two years building at…", true],
    ["Willing to relocate?", "No", true],
    ["Years of product experience", "6", true],
  ];
  return (
    <div className="w-full max-w-[460px] rounded-3xl border border-white/[0.07] bg-[#0e1318] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">stripe.com/jobs/search?gh_jid=7994443</p>
        <span className="rounded-full bg-coral/15 px-2.5 py-1 text-xs font-medium text-rose">Career Ninja filled 6 of 6</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map(([label, value, ok]) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
            <p className="text-[11px] text-white/45">{label}</p>
            <p className="mt-0.5 flex items-center justify-between gap-3 truncate text-sm text-white">
              <span className="truncate">{value}</span>
              {ok && <CheckIcon className="size-3.5 shrink-0 text-coral" />}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-coral/10 px-4 py-3 text-[13px]">
        <span className="text-white/80">Check it, then press Submit yourself.</span>
        <span className="rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white">Submit</span>
      </div>
    </div>
  );
}
