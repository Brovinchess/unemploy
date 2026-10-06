import Link from "next/link";
import type { Job, JobStatus } from "@/db/schema";
import { CompanyLogo } from "./company-logo";
import { ApplyAllButton } from "./extension-ui";
import { MoveJob } from "./move-job";

// Every job the user kept, by stage: to apply → applied → heard back → interview → offer.
// Dismissed jobs sit folded at the bottom in case someone changes their mind.
export const STAGES: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "To apply" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

const DAY = 24 * 60 * 60 * 1000;
// Applied over a week ago with no news: worth a follow-up.
const isStale = (j: Job) => j.status === "applied" && !!j.statusChangedAt && Date.now() - j.statusChangedAt.getTime() > 7 * DAY;

export function Pipeline({ jobs, labels, detailsComplete }: { jobs: Job[]; labels: Map<string, string>; detailsComplete: boolean }) {
  const tracked = jobs.filter((j) => STAGES.some((s) => s.status === j.status));
  const dismissed = jobs.filter((j) => j.status === "skipped");
  const toApply = tracked.filter((j) => j.status === "saved").length;

  return (
    <div className="space-y-8">
      {toApply > 0 && (
        <div className="flex justify-center">
          <ApplyAllButton count={toApply} detailsComplete={detailsComplete} />
        </div>
      )}
      {tracked.length === 0 && <p className="text-center text-sm text-white/40">Jobs you swipe right on land here, and move along as you apply.</p>}
      {STAGES.map((stage) => {
        const items = tracked.filter((j) => j.status === stage.status);
        if (!items.length) return null;
        return (
          <section key={stage.status}>
            <h2 className="font-display flex items-center gap-2 text-sm font-medium text-white/70">
              {stage.label} <span className="text-white/35">{items.length}</span>
            </h2>
            <ul className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
              {items.map((j) => <Row key={j.id} job={j} label={labels.size > 1 ? labels.get(j.profileId) : undefined} />)}
            </ul>
          </section>
        );
      })}
      {dismissed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-white/40 hover:text-white/70">
            {dismissed.length} dismissed <span className="text-white/25 group-open:hidden">· show</span>
          </summary>
          <ul className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
            {dismissed.map((j) => <Row key={j.id} job={j} label={labels.size > 1 ? labels.get(j.profileId) : undefined} />)}
          </ul>
        </details>
      )}
    </div>
  );
}

function Row({ job: j, label }: { job: Job; label?: string }) {
  const stale = isStale(j);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
      <div className="min-w-0 flex-1">
        <Link href={`/app/jobs/${j.id}`} className="font-display font-medium text-white hover:underline hover:decoration-mist hover:underline-offset-4">
          {j.title}
        </Link>
        <p className="text-sm text-muted">
          {j.company}
          {label && <> · {label}</>}
          {j.statusChangedAt && <> · {j.statusChangedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>}
        </p>
        {stale && <p className="mt-1 text-sm text-rose">Applied over a week ago. Any news from {j.company}?</p>}
      </div>
      <MoveJob jobId={j.id} status={j.status} />
    </li>
  );
}
