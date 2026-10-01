"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { setJobStatus } from "@/app/actions";
import { Ninja } from "./brand";
import { CompanyLogo } from "./company-logo";

// Everything a card needs, plain data so it can cross from the server page.
export type CardJob = {
  id: string;
  title: string;
  company: string;
  domain: string | null;
  match: number;
  salary: string | null;
  salaryEstimated: boolean;
  where: string; // "Remote · Anywhere"
  jobType: string | null;
  level: string | null;
  stage: string | null;
  size: string | null;
  industry: string | null;
  perks: string[];
  highlights: string[];
  gaps: string[];
  mustHaves: { requirement: string; met: boolean }[];
  posted: string | null; // "15 days ago"
  verified: boolean;
  headhunter?: string; // shown when the user has more than one
};

type Decision = "apply" | "dismiss";
const SWIPE_AT = 110;

// New jobs as cards: each starts anonymous, Reveal flips it, then swipe right to apply
// or left to dismiss (or use the buttons / arrow keys). After the last card, a summary of
// this session's decisions.
export function SwipeDeck({ jobs, after }: { jobs: CardJob[]; after?: React.ReactNode }) {
  const [queue, setQueue] = useState(jobs);
  const [decided, setDecided] = useState<{ job: CardJob; kind: Decision }[]>([]);
  // Only the first card of each visit starts face-down. Once it's revealed, every card
  // after it arrives face-up and just needs a swipe.
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [, start] = useTransition();
  const [total, setTotal] = useState(jobs.length);
  const known = useRef(new Set(jobs.map((j) => j.id)));

  // Jobs that land while the deck is open join the back of the queue.
  useEffect(() => {
    const fresh = jobs.filter((j) => !known.current.has(j.id));
    if (!fresh.length) return;
    fresh.forEach((j) => known.current.add(j.id));
    setTotal((t) => t + fresh.length);
    setQueue((q) => [...q, ...fresh]);
  }, [jobs]);

  const current = queue[0];
  const seen = total - queue.length;

  function decide(kind: Decision) {
    if (!current) return;
    if (!revealed) return reveal();
    const job = current;
    setQueue((q) => q.slice(1));
    setDecided((d) => [{ job, kind }, ...d]);
    start(() => setJobStatus(job.id, kind === "apply" ? "saved" : "skipped"));
  }

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    setRevealing(true);
    setTimeout(() => setRevealing(false), 1300);
  }

  function move(job: CardJob) {
    setDecided((d) => d.map((x) => (x.job.id === job.id ? { job, kind: "apply" } : x)));
    start(() => setJobStatus(job.id, "saved"));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowRight") decide("apply");
      if (e.key === "ArrowLeft") decide("dismiss");
      if (e.key === " " && current && !revealed) {
        e.preventDefault();
        reveal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toApply = decided.filter((d) => d.kind === "apply").map((d) => d.job);
  const dismissed = decided.filter((d) => d.kind === "dismiss").map((d) => d.job);

  return (
    <div className="flex flex-col items-center">
      {/* Progress */}
      <div className="mb-4 flex flex-col items-center gap-2">
        {total <= 12 ? (
          <div className="flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={`h-1 w-7 rounded-full transition-colors ${i < seen ? "bg-coral" : i === seen ? "bg-white" : "bg-white/12"}`} />
            ))}
          </div>
        ) : (
          <div className="h-1 w-56 overflow-hidden rounded-full bg-white/12">
            <i className="block h-full rounded-full bg-coral transition-all" style={{ width: `${(seen / total) * 100}%` }} />
          </div>
        )}
        <p className="text-xs text-white/50">{current ? `Job ${seen + 1} of ${total}` : "All done"}</p>
      </div>

      {current ? (
        <>
          <div className="relative h-[min(600px,calc(100svh-330px))] min-h-[500px] w-[min(400px,92vw)]">
            {revealing && <span className="deck-burst" aria-hidden />}
            {queue
              .slice(0, 3)
              .reverse()
              .map((job, idx, arr) => {
                const depth = arr.length - 1 - idx;
                return depth === 0 ? (
                  <TopCard key={job.id} job={job} n={seen + 1} open={revealed} revealing={revealing} onReveal={reveal} onDecide={decide} />
                ) : (
                  <div key={job.id} className={`deck-card ${depth === 1 ? "b1" : "b2"} ${revealed ? "open" : ""}`}>
                    <div className="deck-flip">{revealed ? <Back job={job} /> : <Front />}</div>
                  </div>
                );
              })}
          </div>

          <div className="mt-5 grid w-[min(400px,92vw)] grid-cols-[1fr_auto_1fr] items-end">
            <Control label="Dismiss" onClick={() => decide("dismiss")} title="Dismiss (←)">
              <span className="flex size-[62px] items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.05] text-mist">
                <X className="size-6" strokeWidth={2.2} />
              </span>
            </Control>
            {revealed ? (
              <Link href={`/app/jobs/${current.id}`} className="group flex flex-col items-center gap-2 text-xs text-white/40" title="Full details">
                <span className="mb-2 flex size-[46px] items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.05] text-white transition-transform group-hover:-translate-y-0.5">
                  <ArrowUpRight className="size-[18px]" strokeWidth={2.2} />
                </span>
                Details
              </Link>
            ) : (
              <Control label="Reveal" onClick={reveal} title="Reveal (space)">
                <span className="mb-2 flex size-[46px] items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.05] text-white">
                  <RefreshCw className="size-[18px]" strokeWidth={2.2} />
                </span>
              </Control>
            )}
            <Control label="Apply" onClick={() => decide("apply")} title="Apply (→)">
              <span className="flex size-[62px] items-center justify-center rounded-full bg-gradient-to-b from-[#d27375] to-coral text-white shadow-[0_14px_30px_-10px_rgba(201,101,103,0.8)]">
                <Check className="size-6" strokeWidth={2.4} />
              </span>
            </Control>
          </div>
        </>
      ) : (
        <Summary toApply={toApply} dismissed={dismissed} onMove={move} after={after} />
      )}

    </div>
  );
}

function Control({ label, title, onClick, children }: { label: string; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="group flex flex-col items-center gap-2 text-xs text-white/40" onClick={onClick} title={title}>
      <span className="transition-transform group-hover:-translate-y-0.5">{children}</span>
      {label}
    </button>
  );
}

function TopCard({
  job,
  n,
  open,
  revealing,
  onReveal,
  onDecide,
}: {
  job: CardJob;
  n: number;
  open: boolean;
  revealing: boolean;
  onReveal: () => void;
  onDecide: (k: Decision) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, x: 0, dx: 0 });

  const paint = (dx: number) => {
    if (!el.current) return;
    el.current.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 20}deg)` : "";
    const yes = el.current.querySelector<HTMLElement>(".deck-stamp.yes");
    const no = el.current.querySelector<HTMLElement>(".deck-stamp.no");
    if (yes) yes.style.opacity = String(Math.max(0, dx / SWIPE_AT));
    if (no) no.style.opacity = String(Math.max(0, -dx / SWIPE_AT));
  };

  return (
    <div
      ref={el}
      className={`deck-card ${open ? "open" : ""} ${revealing ? "revealing" : open ? "arrived" : ""}`}
      onPointerDown={(e) => {
        if (!open || (e.target as HTMLElement).closest("a,button")) return;
        drag.current = { on: true, x: e.clientX, dx: 0 };
        el.current?.classList.add("dragging");
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current.on) return;
        drag.current.dx = e.clientX - drag.current.x;
        paint(drag.current.dx);
      }}
      onPointerUp={() => {
        if (!drag.current.on) return;
        const dx = drag.current.dx;
        drag.current.on = false;
        el.current?.classList.remove("dragging");
        if (Math.abs(dx) > SWIPE_AT) {
          if (el.current) {
            el.current.style.transition = "transform .4s ease-in, opacity .4s";
            el.current.style.transform = `translateX(${dx > 0 ? 700 : -700}px) rotate(${dx > 0 ? 28 : -28}deg)`;
            el.current.style.opacity = "0";
          }
          setTimeout(() => onDecide(dx > 0 ? "apply" : "dismiss"), 250);
        } else paint(0);
      }}
    >
      <div className="deck-flip">
        <Front onReveal={onReveal} n={n} />
        <Back job={job} />
      </div>
    </div>
  );
}

function Pay({ job }: { job: CardJob }) {
  return job.salary ? (
    <div className="mt-[18px]">
      <p className="font-display text-[30px] font-semibold leading-tight tracking-tight">{job.salary}</p>
      <p className="text-[13px] text-white/55">{job.salaryEstimated ? "Estimate, not from the posting" : "From the posting"}</p>
    </div>
  ) : (
    <p className="font-display mt-[18px] text-[22px] font-semibold text-white/55">Pay not listed</p>
  );
}

function Reasons({ items, bad = false, clamp = false }: { items: string[]; bad?: boolean; clamp?: boolean }) {
  return (
    <ul className="grid gap-2 text-[13.5px] leading-relaxed text-white/80">
      {items.map((r) => (
        <li key={r} className={`flex gap-2.5 ${bad ? "text-rose" : ""}`}>
          {bad ? <X className="mt-0.5 size-4 shrink-0" /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.8} />}
          <span className={clamp ? "line-clamp-2" : ""}>{r}</span>
        </li>
      ))}
    </ul>
  );
}

// The face-down card: no job details at all, just Mochi and a nudge to reveal.
function Front({ onReveal, n }: { onReveal?: () => void; n?: number }) {
  return (
    <div className="deck-face deck-front">
      <div className="deck-front-pattern" aria-hidden />
      <div className="relative flex items-center justify-between px-6 pt-6">
        <span className="font-display text-xs font-medium uppercase tracking-[0.2em] text-white/40">Career Ninja</span>
        {n !== undefined && <span className="font-display text-xs font-medium tracking-[0.2em] text-white/40">No. {n}</span>}
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative flex size-56 items-center justify-center">
          <span className="deck-ring size-56" aria-hidden />
          <span className="deck-ring size-40 [animation-delay:-2s]" aria-hidden />
          <span className="absolute size-32 rounded-full bg-coral/25 blur-3xl" aria-hidden />
          <Sparkles className="absolute left-6 top-8 size-5 text-rose/70" strokeWidth={1.6} aria-hidden />
          <Sparkles className="absolute bottom-10 right-5 size-4 text-white/40" strokeWidth={1.6} aria-hidden />
          <Ninja className="float relative size-32" />
        </div>
        <p className="font-display mt-6 text-[22px] font-medium tracking-tight">A job picked for you</p>
        <p className="mt-1.5 text-sm text-white/50">Reveal it to see what your headhunter found.</p>
      </div>
      <div className="relative px-6 pb-6">
        <button
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#d27375] to-coral text-base font-semibold text-white shadow-[0_14px_30px_-12px_rgba(201,101,103,0.8)] hover:brightness-105"
          onClick={onReveal}
          tabIndex={onReveal ? 0 : -1}
        >
          Reveal <RefreshCw className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Back({ job }: { job: CardJob }) {
  return (
    <div className="deck-face deck-back">
      <div className="deck-stamp yes">APPLY</div>
      <div className="deck-stamp no">NOPE</div>
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/55">
            <Clock className="size-3.5" /> {job.posted ? `Posted ${job.posted}` : "Post date not shown"}
          </span>
          <span className="rounded-full bg-coral/15 px-2.5 py-1.5 text-xs font-medium text-rose">{Math.round(job.match)}% match</span>
        </div>
        <div className="deck-pop mt-5 flex items-center gap-3.5">
          <CompanyLogo name={job.company} domain={job.domain} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold leading-tight">{job.title}</p>
            <p className="mt-1 text-[13px] text-white/55">{[job.company, job.industry].filter(Boolean).join(" · ")}</p>
            {job.headhunter && <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">Found by {job.headhunter}</p>}
          </div>
        </div>
        <Pay job={job} />
      </div>
      <div className="no-scrollbar mt-3.5 flex-1 overflow-y-auto px-6">
        <div className="flex flex-wrap gap-1.5">
          {[job.where, job.jobType, job.level, [job.stage, job.size].filter(Boolean).join(" · ")].filter(Boolean).map((c) => (
            <span key={c} className="rounded-[10px] border border-white/[0.07] bg-white/[0.05] px-2.5 py-1.5 text-[12.5px] text-white/80">
              {c}
            </span>
          ))}
        </div>
        <Section title="Why you">
          <Reasons items={job.highlights} />
        </Section>
        {job.gaps.length > 0 && (
          <Section title="Watch out">
            <Reasons items={job.gaps.slice(0, 3)} bad />
          </Section>
        )}
        {job.mustHaves.length > 0 && (
          <Section title="They require">
            <div className="flex flex-wrap gap-1.5">
              {job.mustHaves.map((m) => (
                <span
                  key={m.requirement}
                  className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] ${
                    m.met ? "border-white/[0.07] bg-white/[0.05] text-white/80" : "border-coral/30 bg-coral/[0.08] text-rose"
                  }`}
                >
                  {m.met ? <Check className="size-3.5 text-coral" /> : <X className="size-3.5" />}
                  {m.requirement}
                </span>
              ))}
            </div>
          </Section>
        )}
        {job.perks.length > 0 && (
          <Section title="Perks">
            <div className="flex flex-wrap gap-1.5">
              {job.perks.map((p) => (
                <span key={p} className="rounded-[10px] border border-white/[0.07] bg-white/[0.05] px-2.5 py-1.5 text-[12.5px] text-white/80">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}
        <div className="h-4" />
      </div>
      <div className="px-6 pb-6 pt-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3.5 text-[13px]">
          <span>Cover letter &amp; answers ready, all from your resume</span>
          <Link href={`/app/jobs/${job.id}`} className="inline-flex shrink-0 items-center gap-1 text-rose hover:text-white">
            Open <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-[18px]">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">{title}</h4>
      {children}
    </div>
  );
}

function Summary({
  toApply,
  dismissed,
  onMove,
  after,
}: {
  toApply: CardJob[];
  dismissed: CardJob[];
  onMove: (j: CardJob) => void;
  after?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[820px]">
      <div className="text-center">
        <Ninja className="mx-auto size-[72px]" />
        <h2 className="font-display mt-3.5 text-[30px] font-medium tracking-tight">That&rsquo;s this search done</h2>
        <p className="mt-1.5 text-white/55">Here&rsquo;s what you decided. You can change your mind any time.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Stat n={toApply.length} label="to apply" accent />
          <Stat n={dismissed.length} label="dismissed" />
        </div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <List title="To apply" empty="Nothing this time.">
          {toApply.map((j) => (
            <Row key={j.id} job={j}>
              <Link href={`/app/jobs/${j.id}`} className="inline-flex items-center gap-1 text-xs text-rose hover:text-white">
                Apply <ArrowUpRight className="size-3.5" />
              </Link>
            </Row>
          ))}
        </List>
        <List title="Dismissed" empty="Nothing dismissed.">
          {dismissed.map((j) => (
            <Row key={j.id} job={j}>
              <button className="text-xs text-white/40 hover:text-white" onClick={() => onMove(j)}>
                Move to apply
              </button>
            </Row>
          ))}
        </List>
      </div>
      {after && <div className="mt-7 flex flex-col items-center gap-3">{after}</div>}
    </div>
  );
}

function Stat({ n, label, accent = false }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="min-w-[130px] rounded-[18px] border border-white/[0.07] bg-surface px-4 py-3.5 text-center">
      <b className={`font-display block text-[26px] font-semibold ${accent ? "text-rose" : "text-white"}`}>{n}</b>
      <span className="text-xs text-white/55">{label}</span>
    </div>
  );
}

function List({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-surface p-[18px]">
      <h3 className="font-display mb-1.5 text-[15px] font-medium text-white/55">{title}</h3>
      {children.length ? <div className="divide-y divide-white/[0.07]">{children}</div> : <p className="px-1.5 py-2.5 text-[13px] text-white/35">{empty}</p>}
    </div>
  );
}

function Row({ job, children }: { job: CardJob; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1.5 py-3">
      <CompanyLogo name={job.company} domain={job.domain} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{job.title}</p>
        <p className="text-xs text-white/55">
          {job.company} · {Math.round(job.match)}% match
        </p>
      </div>
      {children}
    </div>
  );
}
