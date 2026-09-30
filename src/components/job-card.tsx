import Link from "next/link";
import type { Job } from "@/db/schema";
import { workSettingLabel } from "@/lib/preferences";
import { CompanyMark } from "./logo";

export function jobPlace(job: Pick<Job, "city" | "country" | "workSetting">) {
  return [job.city, job.country].filter(Boolean).join(", ");
}

// "3 days ago" / "2 months ago" from an ISO date; null if it can't be read.
export function postedAgo(postedAt: string | null, now = Date.now()) {
  const t = postedAt ? Date.parse(postedAt) : NaN;
  if (Number.isNaN(t)) return null;
  const days = Math.max(0, Math.floor((now - t) / 86_400_000));
  const text =
    days === 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : days < 60 ? "a month ago" : `${Math.floor(days / 30)} months ago`;
  return { days, text };
}

// The site a job link points to, e.g. "greenhouse.io".
export function linkSource(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".").slice(-2).join(".");
  } catch {
    return null;
  }
}

export function MatchBadge({ score }: { score: number }) {
  return (
    <span className="font-display inline-flex items-baseline gap-1 rounded-full bg-coral-soft px-2.5 py-1 text-sm font-bold text-rose">
      {Math.round(score)}%<span className="text-xs font-semibold">match</span>
    </span>
  );
}

export function JobTags({ job }: { job: Job }) {
  const tags = [workSettingLabel(job.workSetting), jobPlace(job), job.jobType, job.salary].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </div>
  );
}

export function JobCard({ job, href, selected = false }: { job: Job; href: string; selected?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`group flex gap-4 rounded-2xl border p-4 transition-colors ${
        selected ? "border-line bg-surface lg:border-coral/40 lg:bg-white/[0.06]" : "border-line bg-surface hover:border-mist"
      }`}
    >
      <CompanyMark name={job.company} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display truncate font-medium text-ink">{job.title}</h3>
            <p className="truncate text-sm text-muted">{job.company}</p>
          </div>
          <MatchBadge score={job.matchScore} />
        </div>
        <div className="mt-2.5">
          <JobTags job={job} />
        </div>
        {(job.status === "saved" || job.demo) && (
          <div className="mt-2.5 flex gap-1.5">
            {job.status === "saved" && <span className="tag bg-plum-soft text-white/85">Saved</span>}
            {job.demo && <span className="tag bg-coral-soft text-rose">Demo</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
