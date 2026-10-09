import { Check, X } from "lucide-react";
import { Ninja } from "./brand";

// Illustrations for the landing page: floating objects on a dark field, in the palette,
// in the spirit of Muse's 3D scenes. Placeholder bars stand in for text so they read as
// pictures, not app screens. Purely decorative (aria-hidden at the call site).

function Bars({ widths, className = "" }: { widths: string[]; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {widths.map((w, i) => (
        <div key={i} className="h-2 rounded-full bg-white/10" style={{ width: w }} />
      ))}
    </div>
  );
}

function Sheet({
  className = "",
  rotate = 0,
  delay = 0,
  at,
  children,
}: {
  className?: string;
  rotate?: number;
  delay?: number;
  at?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`float absolute rounded-2xl border border-white/[0.06] bg-night-3 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ${className}`}
      style={{ ...at, ["--r" as string]: `${rotate}deg`, animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

function Stage({ ratio = "aspect-square", glow = "coral", children }: { ratio?: string; glow?: "coral" | "mist"; children: React.ReactNode }) {
  const g = glow === "coral" ? "rgba(201,101,103,0.22)" : "rgba(151,170,189,0.18)";
  return (
    <div className={`relative w-full overflow-hidden rounded-3xl bg-night-2 ${ratio}`}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${g}, transparent 60%)` }} />
      {children}
    </div>
  );
}

function Orb({ className = "", size = "size-20", label }: { className?: string; size?: string; label?: React.ReactNode }) {
  return (
    <div
      className={`float absolute flex items-center justify-center rounded-full bg-coral font-display font-semibold text-white shadow-[0_0_80px_10px_rgba(201,101,103,0.35)] ${size} ${className}`}
    >
      {label}
    </div>
  );
}

function Score({ n }: { n: number }) {
  return <span className="font-display text-2xl font-semibold text-coral">{n}%</span>;
}

// 16:9: a resume goes in, the headhunter works, matched jobs come out.
export function WideArt() {
  return (
    <Stage ratio="aspect-[16/9]">
      <Sheet className="w-[24%]" rotate={-6} at={{ left: "7%", top: "22%" }}>
        <div className="mb-4 h-3 w-1/2 rounded-full bg-white/25" />
        <Bars widths={["100%", "90%", "95%", "70%", "85%", "60%"]} />
      </Sheet>
      <div className="absolute left-[33%] right-[59%] top-1/2 h-px bg-gradient-to-r from-white/0 to-white/25" />
      <Orb className="left-[43%] top-[37.5%]" size="w-[14%] aspect-square" label={<Ninja className="w-[74%]" />} />
      <div className="absolute left-[59%] right-[35%] top-1/2 h-px bg-gradient-to-r from-white/25 to-white/0" />
      {[
        { top: "16%", n: 94, r: 3, d: 0 },
        { top: "42%", n: 89, r: -2, d: 1.2 },
        { top: "68%", n: 83, r: 2, d: 2.4 },
      ].map((j) => (
        <Sheet key={j.n} className="w-[27%] !p-4" rotate={j.r} delay={j.d} at={{ right: "7%", top: j.top }}>
          <div className="flex items-center justify-between gap-3">
            <Bars widths={["80%", "55%"]} className="flex-1" />
            <Score n={j.n} />
          </div>
        </Sheet>
      ))}
    </Stage>
  );
}

// Square: a few strong matches, ranked.
export function ShortlistArt() {
  return (
    <Stage glow="mist">
      {[
        { n: 94, top: "18%", left: "12%", r: -4, d: 0 },
        { n: 89, top: "41%", left: "20%", r: 2, d: 1 },
        { n: 83, top: "64%", left: "10%", r: -2, d: 2 },
      ].map((j) => (
        <Sheet key={j.n} className="w-[70%]" rotate={j.r} delay={j.d} at={{ top: j.top, left: j.left }}>
          <div className="flex items-center gap-4">
            <div className="size-10 shrink-0 rounded-xl bg-white/10" />
            <Bars widths={["85%", "50%"]} className="flex-1" />
            <Score n={j.n} />
          </div>
        </Sheet>
      ))}
    </Stage>
  );
}

// Square: a line in the cover letter, traced to the same line in the resume.
export function PackArt() {
  return (
    <Stage>
      <Sheet className="w-[52%]" rotate={-3} at={{ left: "10%", top: "12%" }}>
        <div className="mb-4 h-3 w-2/5 rounded-full bg-white/25" />
        <Bars widths={["100%", "92%"]} />
        <div className="my-2 h-2 w-[88%] rounded-full bg-coral" />
        <Bars widths={["96%", "70%", "84%"]} />
      </Sheet>
      <Sheet className="w-[48%]" rotate={4} delay={1.5} at={{ right: "10%", bottom: "12%" }}>
        <div className="mb-4 h-3 w-1/2 rounded-full bg-white/25" />
        <Bars widths={["80%", "95%"]} />
        <div className="my-2 h-2 w-[76%] rounded-full bg-coral" />
        <Bars widths={["90%", "60%"]} />
      </Sheet>
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M 55 34 C 70 40, 60 60, 70 64" fill="none" stroke="rgba(201,101,103,0.6)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      </svg>
    </Stage>
  );
}

// Square: you decide. Approve or skip.
export function ControlArt() {
  return (
    <Stage glow="mist">
      <Sheet className="w-[60%]" rotate={-2} at={{ left: "20%", top: "22%" }}>
        <div className="flex items-center gap-4">
          <div className="size-12 shrink-0 rounded-xl bg-white/10" />
          <Bars widths={["80%", "45%"]} className="flex-1" />
        </div>
        <Bars widths={["100%", "85%"]} className="mt-5" />
      </Sheet>
      <div className="float absolute left-[26%] top-[60%] flex size-[18%] items-center justify-center rounded-full bg-coral shadow-[0_0_80px_10px_rgba(201,101,103,0.35)]" style={{ animationDelay: "1s" }}>
        <Check className="size-1/2 text-white" strokeWidth={2.5} />
      </div>
      <div className="float absolute right-[26%] top-[62%] flex size-[14%] items-center justify-center rounded-full bg-night-3 border border-white/10" style={{ animationDelay: "2s" }}>
        <X className="size-1/2 text-white/60" strokeWidth={2.5} />
      </div>
    </Stage>
  );
}

// Square: one headhunter per kind of job, each with its own resume.
export function ProfilesArt() {
  return (
    <Stage>
      {[
        { label: "D", top: "16%", left: "16%", d: 0 },
        { label: "P", top: "40%", left: "40%", d: 1.3 },
        { label: "U", top: "64%", left: "22%", d: 2.6 },
      ].map((o) => (
        <div key={o.label} className="absolute flex items-center gap-4" style={{ top: o.top, left: o.left }}>
          <div className="float relative flex size-16 items-center justify-center rounded-full bg-coral font-display text-xl font-semibold text-white shadow-[0_0_60px_6px_rgba(201,101,103,0.3)]" style={{ animationDelay: `${o.d}s` }}>
            {o.label}
          </div>
          <div className="float w-32 rounded-xl border border-white/[0.06] bg-night-3 p-3" style={{ animationDelay: `${o.d + 0.6}s` }}>
            <Bars widths={["90%", "70%", "80%"]} />
          </div>
        </div>
      ))}
    </Stage>
  );
}

// ---------- Muse-style panels: real product UI, dark, floating on the band, no frame ----------

function Panel({ className = "", title, children }: { className?: string; title?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[22px] border border-white/[0.07] bg-[#222d38] p-5 text-left shadow-[0_40px_90px_-30px_rgba(0,0,0,0.75)] ${className}`}>
      {title && <p className="font-display mb-4 text-[15px] font-medium text-white">{title}</p>}
      {children}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-xs font-semibold text-white/80">
      {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
  );
}

export function ShortlistPanels() {
  const jobs = [
    { t: "Senior Product Designer", c: "Northwind Labs", m: "Hybrid · New York", s: 94 },
    { t: "Product Designer, Payments", c: "Fernhill Bank", m: "On-site · Full-time", s: 89 },
    { t: "UX Designer", c: "Kitefly", m: "Remote · US", s: 83 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <Panel title="Today's shortlist" className="w-[88%]">
        <ul className="space-y-1">
          {jobs.map((j, i) => (
            <li key={j.t} className={`flex items-center gap-3 rounded-xl p-2.5 ${i === 0 ? "bg-white/[0.05]" : ""}`}>
              <Initials name={j.c} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{j.t}</p>
                <p className="truncate text-[11px] text-white/45">
                  {j.c} · {j.m}
                </p>
              </div>
              <span className="font-display text-[15px] font-medium text-coral">{j.s}%</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="absolute -bottom-10 right-0 w-[56%]">
        <p className="text-[11px] font-medium uppercase tracking-wider text-coral">Why it fits</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/75">
          You led a redesign used by 1.2M customers, exactly the scale Northwind asks for.
        </p>
      </Panel>
    </div>
  );
}

export function PackPanels() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-16">
      <Panel title="Cover letter" className="w-[84%]">
        <p className="text-[12.5px] leading-[1.7] text-white/70">
          Dear Northwind team, I&rsquo;m applying for the Senior Product Designer role.{" "}
          <span className="rounded bg-coral/20 px-1 text-white">I led the redesign of an app used by 1.2 million customers</span>, and cut
          checkout drop-off by 18%&hellip;
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] text-white/80">Copy</span>
          <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] text-white/80">Edit</span>
        </div>
      </Panel>
      <Panel className="absolute bottom-0 right-0 w-[60%]">
        <p className="text-[11px] font-medium uppercase tracking-wider text-coral">From your resume</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/75">
          &ldquo;Led the redesign of the PayLane mobile app used by 1.2 million customers.&rdquo;
        </p>
      </Panel>
    </div>
  );
}

export function ApprovePanels() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <Panel>
        <div className="flex items-center gap-3">
          <Initials name="Northwind Labs" />
          <div>
            <p className="text-[13px] font-medium text-white">Senior Product Designer</p>
            <p className="text-[11px] text-white/45">Northwind Labs · 94% match</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-xl bg-white/[0.04] p-3 text-[11.5px] text-white/60">
          <p className="flex justify-between">
            <span>Cover letter</span>
            <span className="text-white/85">Ready</span>
          </p>
          <p className="flex justify-between">
            <span>Answers</span>
            <span className="text-white/85">2 of 2</span>
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <div className="rounded-full bg-coral py-2.5 text-center text-[13px] font-medium text-white">Apply</div>
          <div className="rounded-full bg-white/[0.08] py-2.5 text-center text-[13px] text-white/80">Skip</div>
        </div>
      </Panel>
    </div>
  );
}

export function ProfilesPanels() {
  const rows = [
    { l: "Design", m: "sarah-design", n: 5 },
    { l: "Product", m: "sarah-product", n: 3 },
    { l: "UX Research", m: "sarah-ux-research", n: 4 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <Panel title="Your headhunters">
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.l} className="flex items-center gap-3 rounded-xl p-2.5">
              <span className="font-display flex size-9 items-center justify-center rounded-full bg-coral text-[13px] font-medium text-white">
                {r.l[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-white">{r.l}</p>
                <p className="font-mono text-[11px] text-white/45">{r.m}</p>
              </div>
              <span className="text-[11px] text-white/60">{r.n} new today</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ---------- Product mock-ups: the real screens, drawn with the real components ----------

import { Banknote, BadgeCheck, Check as CheckIcon, Clock, MapPin, Sparkles, X as XIcon } from "lucide-react";
import { Ninja as Mochi } from "./brand";

// A revealed job card, exactly as the app draws it, with sample data.
export function CardMock() {
  const must = [
    ["5+ years in product", true],
    ["B2B SaaS", true],
    ["Payments domain", true],
    ["Team management", false],
  ] as const;
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[32px] border border-white/[0.07] bg-surface p-6 shadow-[0_40px_100px_-30px_rgba(201,101,103,0.45)]">
      <div className="flex items-center gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white font-display text-sm font-bold text-[#314455]">AC</span>
        <div className="min-w-0">
          <p className="font-display text-[20px] font-semibold leading-tight">Senior Product Manager</p>
          <p className="mt-1 text-[13px] text-white/55">Acme Payments</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-3 py-1.5 text-[13px] font-semibold text-rose ring-1 ring-coral/30">
          <Banknote className="size-4" /> $120,000–150,000 a year
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium text-white/85 ring-1 ring-white/10">
          <MapPin className="size-4 text-coral" /> Remote · worldwide
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
        <span>Mid-Senior · Full-time</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> Posted 3 days ago
        </span>
        <span className="inline-flex items-center gap-1 text-white/70">
          <BadgeCheck className="size-3.5 text-coral" /> Open today
        </span>
      </div>
      <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">The role</h4>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/80">Own the merchant onboarding flow for a payments app used by 2M people across Southeast Asia.</p>
      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">Why it fits you</h4>
      <ul className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-white/80">
        <li className="flex gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.8} /> You launched a payments product used by thousands of merchants
        </li>
        <li className="flex gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.8} /> Six years in B2B SaaS, the level they ask for
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
export function ProgressMock() {
  return (
    <div className="w-full max-w-[360px] rounded-3xl bg-surface p-5">
      <div className="flex items-center gap-3">
        <Mochi mood="searching" className="size-12 shrink-0" />
        <div>
          <p className="flex items-center gap-2 font-medium text-white">
            <span className="size-2 animate-pulse rounded-full bg-coral" /> Searching… <span className="text-white/55">found <b className="text-white">3</b> of 5</span>
          </p>
          <p className="text-xs text-white/45">Reading application forms · 41 cognition used</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full w-[60%] rounded-full bg-coral" />
      </div>
      <ol className="mt-4 space-y-2 text-sm">
        {["Search request sent", "Searching job sites", "Checking jobs", "Reading application forms", "Writing your applications"].map((s, i) => (
          <li key={s} className="flex items-center gap-2.5">
            <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${i < 3 ? "bg-coral text-white" : i === 3 ? "border-2 border-coral text-coral" : "border border-white/15 text-white/40"}`}>
              {i < 3 ? <CheckIcon className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={i <= 3 ? "text-white" : "text-white/40"}>{s}</span>
            {i === 3 && <span className="text-xs text-coral">in progress</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// The You page: an answer to check, one it couldn't know.
export function AnswersMock() {
  return (
    <div className="w-full max-w-[420px] space-y-3">
      <div className="rounded-3xl bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/35">Check these</p>
        <p className="mt-3 text-white">Do you have experience working with remote teams across time zones?</p>
        <p className="mt-0.5 text-xs text-white/40">Asked by Acme Payments · From your resume</p>
        <div className="mt-3 flex gap-2">
          <span className="chip min-h-9 px-3.5 text-sm" aria-pressed="true">Yes</span>
          <span className="chip min-h-9 px-3.5 text-sm">No</span>
        </div>
        <span className="btn btn-primary btn-sm mt-3">
          <CheckIcon className="size-4" /> Approve
        </span>
      </div>
      <div className="rounded-3xl bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/35">Needs you</p>
        <p className="mt-3 text-white">Do you hold a valid driving licence?</p>
        <p className="mt-0.5 text-xs text-white/40">Asked by Acme Payments</p>
        <div className="field mt-3 flex h-11 items-center text-white/35">Your answer</div>
      </div>
    </div>
  );
}

// The extension filling a form.
export function ExtensionMock() {
  const rows: [string, string, boolean][] = [
    ["First name", "Alex", true],
    ["Email", "alex@example.com", true],
    ["Resume", "Alex_Tan_Resume.pdf", true],
    ["Why do you want to work at Acme?", "Your merchant tools are what I spent two years building at…", true],
    ["Willing to relocate?", "No", true],
    ["Years of product experience", "6", true],
  ];
  return (
    <div className="w-full max-w-[460px] rounded-3xl border border-white/[0.07] bg-[#0e1318] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">jobs.lever.co/acme/apply</p>
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
