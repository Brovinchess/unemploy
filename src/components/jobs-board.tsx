"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Puzzle, RotateCcw, Search } from "lucide-react";
import { setJobStatus } from "@/app/actions";
import type { Job, JobStatus } from "@/db/schema";
import { gapsOf, matchHint, matchShort } from "@/lib/match";
import { Ninja } from "./brand";
import { CompanyLogo } from "./company-logo";
import { ApplyAllButton } from "./extension-ui";
import { isSupported } from "@/lib/extension-sites";
import { useExtension } from "./use-extension";
import { MoveJob } from "./move-job";
// What the board needs from a job row. Backend-only columns (the shared posting key and the
// clean match fields) never leave the server.
export type BoardJob = Omit<Job, "postingKey" | "countryCode" | "jobTypeKey" | "levelKey" | "postedOn">;

// Every job the headhunter found, as a pipeline: a stage bar to filter, the apply-all bar,
// then rows grouped by stage. Dismissed jobs stay out of the way until asked for.
const STAGES: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "To apply" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];
const DAY = 24 * 60 * 60 * 1000;
const matchesQ = (j: BoardJob, q: string) => {
  const needle = q.trim().toLowerCase();
  return !needle || `${j.title} ${j.company} ${j.city ?? ""} ${j.country ?? ""}`.toLowerCase().includes(needle);
};
// Applied over a week ago with no news: worth a follow-up. Computed in a handler-free helper so render stays pure.
const isStale = (j: BoardJob) =>
  j.status === "applied" &&
  !!j.statusChangedAt &&
  Date.now() - j.statusChangedAt.getTime() > 7 * DAY;

export function JobsBoard({ jobs, ready, other, detailsComplete }: { jobs: BoardJob[]; ready: number; other: number; detailsComplete: boolean }) {
  // One extension check for the whole board; rows get the per-job "Apply now" from it.
  const ext = useExtension();
  const extReady = !!ext.status?.installed && !!ext.status.connected && detailsComplete && !ext.status.needsUpdate;
  const [stage, setStage] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const stale = useMemo(
    () => new Set(jobs.filter(isStale).map((j) => j.id)),
    [jobs],
  );
  // Chip counts and rows both honour the search box, so a count never says 5 while 0 rows show.
  const matches = (j: BoardJob) => matchesQ(j, q);
  const counts = useMemo(() => {
    const c = new Map<JobStatus, number>();
    for (const j of jobs) if (matchesQ(j, q)) c.set(j.status, (c.get(j.status) ?? 0) + 1);
    return c;
  }, [jobs, q]);
  const needle = q.trim();
  const live = jobs.filter((j) => j.status !== "skipped" && j.status !== "expired" && matches(j));
  const dismissed = jobs.filter((j) => j.status === "skipped" && matches(j));
  // Postings the daily check found closed before the person applied: shown, not silently gone.
  const closed = jobs.filter((j) => j.status === "expired" && matches(j));
  const toApply = counts.get("saved") ?? 0;
  // A chosen stage that emptied out (its last job moved on) falls back to All instead of a blank view.
  if (stage !== "all" && !counts.get(stage)) setStage("all");

  if (!jobs.length) return null;

  // "All" groups by stage, follow-ups first. A chosen stage is one flat list.
  const groups: Group[] =
    stage === "all"
      ? [
          {
            key: "stale",
            title: "Needs a follow-up",
            hint: "Applied over a week ago, no news yet",
            jobs: live.filter((j) => stale.has(j.id)),
          },
          ...STAGES.flatMap((s): Group[] => (s.status === "saved" ? applyGroups(live.filter((j) => j.status === "saved" && !stale.has(j.id))) : [{
            key: s.status,
            title: s.label,
            jobs: live.filter((j) => j.status === s.status && !stale.has(j.id)),
          }])),
        ].filter((g) => g.jobs.length)
      : stage === "saved"
        ? applyGroups(live.filter((j) => j.status === "saved")).filter((g) => g.jobs.length)
        : [
            {
              key: stage,
              title: STAGES.find((s) => s.status === stage)!.label,
              jobs: live.filter((j) => j.status === stage),
            },
          ].filter((g) => g.jobs.length);

  return (
    <section aria-label="All jobs" className="rise rise-2 space-y-4">
      {/* Stage bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={stage === "all"} onClick={() => setStage("all")}>
          All{" "}
          <span className="opacity-50">
            {live.length}
          </span>
        </Chip>
        {STAGES.filter((s) => counts.get(s.status)).map((s) => (
          <Chip
            key={s.status}
            on={stage === s.status}
            onClick={() => setStage(s.status)}
          >
            {s.label} <span className="opacity-50">{counts.get(s.status)}</span>
          </Chip>
        ))}
        {jobs.length > 8 && (
          <label className="relative ml-auto block w-full sm:w-52">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35"
              aria-hidden
            />
            <input
              className="field h-9 min-h-0 rounded-full pl-9 text-sm"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search jobs"
            />
          </label>
        )}
      </div>

      {/* The one action for this list: everything swiped right, applied in one go. */}
      {toApply > 0 && (stage === "all" || stage === "saved") && (
        <ApplyAllButton count={ready} other={other} detailsComplete={detailsComplete} bar />
      )}

      {groups.length === 0 ? (
        <Empty
          text={
            needle
              ? `Nothing matches “${q}”.`
              : stage === "saved"
                ? "Nothing to apply to yet. Swipe right on a new card, or ask for more jobs."
                : "Nothing here yet."
          }
        />
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-baseline gap-2 px-1">
              <h3
                className={`text-xs font-semibold uppercase tracking-[0.14em] ${g.key === "stale" ? "text-rose" : "text-white/45"}`}
              >
                {g.title}
              </h3>
              <span className="text-xs text-white/30">{g.jobs.length}</span>
              {g.hint && (
                <span className="hidden text-xs text-white/35 sm:inline">
                  · {g.hint}
                </span>
              )}
            </div>
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl bg-surface">
              {g.jobs.map((j, i) => (
                <Row key={j.id} job={j} index={i} extReady={extReady} apply={ext.status?.canApplyOne ? ext.applyOne : ext.applyAll} />
              ))}
            </ul>
          </div>
        ))
      )}

      {closed.length > 0 && stage === "all" && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/35 hover:text-white/70"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
          >
            Closed before you applied{" "}
            <span className="font-normal normal-case tracking-normal">{closed.length}</span>
            <ChevronDown className={`size-3.5 transition-transform ${showClosed ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showClosed && (
            <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-3xl bg-surface/60">
              {closed.map((j) => (
                <Row key={j.id} job={j} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dismissed: out of the way, one click to see and restore. */}
      {dismissed.length > 0 && stage === "all" && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/35 hover:text-white/70"
            onClick={() => setShowDismissed((v) => !v)}
            aria-expanded={showDismissed}
          >
            Dismissed{" "}
            <span className="font-normal normal-case tracking-normal">
              {dismissed.length}
            </span>
            <ChevronDown
              className={`size-3.5 transition-transform ${showDismissed ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {showDismissed && (
            <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-3xl bg-surface/60">
              {dismissed.map((j) => (
                <Row key={j.id} job={j} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip min-h-8 px-3 text-sm"
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-surface px-6 py-10 text-center">
      <Ninja mood="sleeping" className="float size-16" />
      <p className="mt-3 text-sm text-white/45">{text}</p>
    </div>
  );
}

// "2d ago" style, short enough for a row.
function when(d: Date | null) {
  if (!d) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return "just now";
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Group = { key: string; title: string; jobs: BoardJob[]; hint?: string };

// Kept jobs split by who applies: the extension, on the sites it supports, or the person.
function applyGroups(saved: BoardJob[]): Group[] {
  return [
    { key: "saved-ext", title: "To apply with the extension", hint: "Apply now opens the form and fills it in for you", jobs: saved.filter((j) => isSupported(j.url)) },
    { key: "saved-manual", title: "To apply yourself", hint: "Open the posting; your cover letter and answers are on the job's page", jobs: saved.filter((j) => !isSupported(j.url)) },
  ];
}

function Row({ job: j, index = 0, extReady = false, apply }: { job: BoardJob; index?: number; extReady?: boolean; apply?: (id: string) => Promise<{ ok: boolean; reason?: string } | null> }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  const [applying, startApply] = useTransition();
  const viaExtension = j.status === "saved" && isSupported(j.url);
  const applyNow = () =>
    startApply(async () => {
      const r = await apply?.(j.id);
      setNote(r?.ok ? "Opening the form…" : "Couldn't start. Check the extension.");
    });
  const place = [j.city, j.country].filter(Boolean).join(", ");
  const setting = j.workSetting
    ? j.workSetting[0].toUpperCase() + j.workSetting.slice(1)
    : null;
  const meta = [...new Set([place, setting].filter(Boolean))];
  const dismissed = j.status === "skipped";
  const closed = j.status === "expired";
  const match = Math.round(j.matchScore);
  const gaps = gapsOf(j.mustHaves);
  const strong = !gaps && match >= 80;
  return (
    <li
      className={`rise flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${dismissed || closed ? "opacity-60" : ""}`}
      style={{ animationDelay: `${Math.min(index, 10) * 40 + 150}ms` }}
    >
      <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
      <div className="min-w-0 flex-1 basis-[13rem]">
        <Link
          href={`/app/jobs/${j.id}`}
          className="font-display block truncate font-medium text-white hover:underline hover:decoration-mist hover:underline-offset-4"
        >
          {j.title}
        </Link>
        <p className="truncate text-sm text-white/50">
          <span className="text-white/70">{j.company}</span>
          {meta.length > 0 && <> · {meta.join(" · ")}</>}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${strong ? "bg-coral/15 text-rose ring-1 ring-coral/30" : "bg-white/[0.06] text-white/55"}`}
          title={matchHint(gaps)}
        >
          {matchShort(match, gaps)}
        </span>
        <span
          className="hidden w-14 shrink-0 text-right text-xs text-white/35 md:block"
          suppressHydrationWarning
        >
          {when(j.statusChangedAt)}
        </span>
        {closed ? (
          <span className="flex h-8 shrink-0 items-center rounded-full border border-white/10 px-3 text-xs text-white/50" title="The posting no longer accepts applications">
            Closed
          </span>
        ) : dismissed ? (
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs text-white/60 hover:border-white/25 hover:text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => start(() => setJobStatus(j.id, "saved"))}
            title="Move back to To apply"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Restore
          </button>
        ) : j.status === "saved" ? (
          <>
            {viaExtension ? (
              extReady ? (
                <button
                  type="button"
                  className="btn btn-accent h-8 shrink-0 px-3.5 text-xs"
                  disabled={applying}
                  onClick={applyNow}
                  title="The extension opens this form and fills it in"
                >
                  <Puzzle className="size-3.5" aria-hidden /> {applying ? "Starting…" : "Apply now"}
                </button>
              ) : (
                <Link href="/app/settings#extension" className="btn btn-accent h-8 shrink-0 px-3.5 text-xs" title="Set up the extension and it fills this form for you">
                  <Puzzle className="size-3.5" aria-hidden /> Apply now
                </Link>
              )
            ) : (
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost h-8 shrink-0 px-3.5 text-xs"
                title="This site isn't one the extension fills yet; the application is on the job's page"
              >
                Open posting <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            <MoveJob jobId={j.id} status={j.status} compact />
          </>
        ) : (
          <MoveJob jobId={j.id} status={j.status} />
        )}
      </div>
      {note && <p className="basis-full text-right text-xs text-white/45">{note}</p>}
    </li>
  );
}
