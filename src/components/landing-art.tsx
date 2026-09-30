import { BriefcaseBusiness, Check, X } from "lucide-react";

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
      <Orb className="left-[43%] top-[37.5%]" size="w-[14%] aspect-square" label={<BriefcaseBusiness className="size-[42%]" strokeWidth={1.75} />} />
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
