"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { setJobStatus } from "@/app/actions";
import type { Job, JobStatus } from "@/db/schema";
import { CompanyLogo } from "./company-logo";
import { ApplyAllButton } from "./extension-ui";
import { MoveJob } from "./move-job";

// Every job the headhunter found, in one list: filter by stage, search, change a stage in place.
const STAGES: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "To apply" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "skipped", label: "Dismissed" },
];
const DAY = 24 * 60 * 60 * 1000;
// Applied over a week ago with no news: worth a follow-up. Computed in a handler-free helper so render stays pure.
const isStale = (j: Job) => j.status === "applied" && !!j.statusChangedAt && Date.now() - j.statusChangedAt.getTime() > 7 * DAY;

export function JobsBoard({ jobs, labels, detailsComplete }: { jobs: Job[]; labels: Map<string, string>; detailsComplete: boolean }) {
  const [stage, setStage] = useState<JobStatus | "all">("all");
  const stale = useMemo(() => new Set(jobs.filter(isStale).map((j) => j.id)), [jobs]);
  const [q, setQ] = useState("");
  const counts = useMemo(() => {
    const c = new Map<JobStatus, number>();
    for (const j of jobs) c.set(j.status, (c.get(j.status) ?? 0) + 1);
    return c;
  }, [jobs]);
  const needle = q.trim().toLowerCase();
  const shown = jobs
    .filter((j) => (stage === "all" || j.status === stage) && (!needle || `${j.title} ${j.company} ${j.city ?? ""} ${j.country ?? ""}`.toLowerCase().includes(needle)))
    // In "All", dismissed jobs sink to the bottom; everything else keeps its newest-change-first order.
    .sort((a, b) => Number(a.status === "skipped") - Number(b.status === "skipped"));
  const toApply = counts.get("saved") ?? 0;

  if (!jobs.length) return null;

  return (
    <section aria-label="All jobs">
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={stage === "all"} onClick={() => setStage("all")}>
          All <span className="text-white/40">{jobs.length}</span>
        </Chip>
        {STAGES.filter((s) => counts.get(s.status)).map((s) => (
          <Chip key={s.status} on={stage === s.status} onClick={() => setStage(s.status)}>
            {s.label} <span className="text-white/40">{counts.get(s.status)}</span>
          </Chip>
        ))}
        {jobs.length > 8 && (
          <label className="relative ml-auto block w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" aria-hidden />
            <input className="field h-9 pl-9 text-sm" placeholder="Search jobs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
          </label>
        )}
      </div>

      {toApply > 0 && (stage === "all" || stage === "saved") && (
        <div className="mt-4">
          <ApplyAllButton count={toApply} detailsComplete={detailsComplete} />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-white/40">Nothing here{needle ? ` for “${q}”` : ""}.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-3xl bg-surface">
          {shown.map((j) => (
            <Row key={j.id} job={j} label={labels.size > 1 ? labels.get(j.profileId) : undefined} stale={stale.has(j.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip min-h-8 px-3 text-sm" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Row({ job: j, label, stale }: { job: Job; label?: string; stale: boolean }) {
  const [pending, start] = useTransition();
  const place = [j.city, j.country].filter(Boolean).join(", ");
  const setting = j.workSetting ? j.workSetting[0].toUpperCase() + j.workSetting.slice(1) : null;
  const meta = [...new Set([place, setting, j.salary, j.matchScore != null ? `${j.matchScore}% match` : null].filter(Boolean))];
  const dismissed = j.status === "skipped";
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ${dismissed ? "opacity-60" : ""}`}>
      <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
      <div className="min-w-0 flex-1">
        <Link href={`/app/jobs/${j.id}`} className="font-display block truncate font-medium text-white hover:underline hover:decoration-mist hover:underline-offset-4">
          {j.title}
        </Link>
        <p className="truncate text-sm text-white/50">
          {j.company}
          {meta.length > 0 && <> · {meta.join(" · ")}</>}
          {label && <> · {label}</>}
        </p>
        {stale && <p className="mt-0.5 text-xs text-rose">Applied over a week ago. Any news from {j.company}?</p>}
      </div>
      <div className="flex items-center gap-3">
        {j.statusChangedAt && <span className="hidden text-xs text-white/35 sm:block">{j.statusChangedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
        {dismissed ? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/55 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
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
