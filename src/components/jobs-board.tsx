"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { setJobStatus } from "@/app/actions";
import type { Job, JobStatus } from "@/db/schema";
import { Ninja } from "./brand";
import { CompanyLogo } from "./company-logo";
import { ApplyAllButton } from "./extension-ui";
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

export function JobsBoard({ jobs, detailsComplete }: { jobs: BoardJob[]; detailsComplete: boolean }) {
  const [stage, setStage] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
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
  const live = jobs.filter((j) => j.status !== "skipped" && matches(j));
  const dismissed = jobs.filter((j) => j.status === "skipped" && matches(j));
  const toApply = counts.get("saved") ?? 0;
  // A chosen stage that emptied out (its last job moved on) falls back to All instead of a blank view.
  if (stage !== "all" && !counts.get(stage)) setStage("all");

  if (!jobs.length) return null;

  // "All" groups by stage, follow-ups first. A chosen stage is one flat list.
  const groups: { key: string; title: string; jobs: BoardJob[]; hint?: string }[] =
    stage === "all"
      ? [
          {
            key: "stale",
            title: "Needs a follow-up",
            hint: "Applied over a week ago, no news yet",
            jobs: live.filter((j) => stale.has(j.id)),
          },
          ...STAGES.map((s) => ({
            key: s.status,
            title: s.label,
            jobs: live.filter((j) => j.status === s.status && !stale.has(j.id)),
          })),
        ].filter((g) => g.jobs.length)
      : [
          {
            key: stage,
            title: STAGES.find((s) => s.status === stage)!.label,
            jobs: live.filter((j) => j.status === stage),
          },
        ].filter((g) => g.jobs.length);

  return (
    <section aria-label="All jobs" className="space-y-4">
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
        <ApplyAllButton count={toApply} detailsComplete={detailsComplete} bar />
      )}

      {groups.length === 0 ? (
        <Empty
          text={
            needle
              ? `Nothing matches “${q}”.`
              : stage === "saved"
                ? "Nothing to apply to. Review new cards or ask for more."
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
              {g.jobs.map((j) => (
                <Row key={j.id} job={j} />
              ))}
            </ul>
          </div>
        ))
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
      <Ninja mood="sleeping" className="size-16" />
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

function Row({ job: j }: { job: BoardJob }) {
  const [pending, start] = useTransition();
  const place = [j.city, j.country].filter(Boolean).join(", ");
  const setting = j.workSetting
    ? j.workSetting[0].toUpperCase() + j.workSetting.slice(1)
    : null;
  const meta = [...new Set([place, setting].filter(Boolean))];
  const dismissed = j.status === "skipped";
  const match = Math.round(j.matchScore);
  const strong = match >= 80;
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${dismissed ? "opacity-60" : ""}`}
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
          title="How well it matches your resume"
        >
          {match}%
        </span>
        <span
          className="hidden w-14 shrink-0 text-right text-xs text-white/35 md:block"
          suppressHydrationWarning
        >
          {when(j.statusChangedAt)}
        </span>
        {dismissed ? (
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs text-white/60 hover:border-white/25 hover:text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => start(() => setJobStatus(j.id, "saved"))}
            title="Move back to To apply"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Restore
          </button>
        ) : (
          <MoveJob jobId={j.id} status={j.status} />
        )}
      </div>
    </li>
  );
}
