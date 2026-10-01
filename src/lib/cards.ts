import "server-only";
import type { Job } from "@/db/schema";
import type { CardJob } from "@/components/swipe-deck";
import { postedAgo } from "@/components/job-card";
import { workSettingLabel } from "./preferences";

// The first sentence of a longer text, for jobs delivered before highlights existed.
const firstSentence = (t: string) => (t.match(/^.+?[.!?](\s|$)/)?.[0] ?? t).trim().slice(0, 160);

export function toCard(job: Job): CardJob {
  const place = [job.city, job.country].filter(Boolean).join(", ");
  const scope = job.workSetting === "remote" ? place || "anywhere" : place;
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    domain: job.companyDomain,
    match: job.matchScore,
    salary: job.salary,
    salaryEstimated: job.salaryEstimated,
    where: [workSettingLabel(job.workSetting), scope].filter(Boolean).join(" · "),
    jobType: job.jobType,
    level: job.level,
    stage: job.companyStage,
    size: job.companySize,
    industry: job.industry,
    perks: job.perks ?? [],
    highlights: job.highlights?.length ? job.highlights : [firstSentence(job.whyFit)],
    gaps: job.gaps,
    mustHaves: job.mustHaves ?? [],
    posted: postedAgo(job.postedAt)?.text ?? null,
    verified: !!job.verifiedAt && !!job.locationText,
  };
}
