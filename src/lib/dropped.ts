import type { DropReason } from "@/db/schema";

// Plain words for why the headhunter set a lead aside, and the one setting that would help
// when a single reason dominates.
export const DROP_LABELS: Record<DropReason, string> = {
  not_eligible: "only open to other countries",
  too_old: "posted too long ago",
  closed: "already closed",
  poor_fit: "asking for more than your resume shows",
  duplicate: "already sent",
  work_setting: "wrong work setting",
  unreachable: "page would not open",
  other: "other",
  pay: "other", // rows from before pay stopped being a reason
};

export function dropAdvice(counts: Map<DropReason, number>, total: number, country: string, remoteOnly: boolean, postingAge: number) {
  const share = (r: DropReason) => (counts.get(r) ?? 0) / Math.max(1, total);
  if (share("not_eligible") >= 0.4) {
    return remoteOnly ? `Adding hybrid or on-site roles in ${country} would widen it.` : null;
  }
  if (share("too_old") >= 0.35 && postingAge < 90) return `Allowing postings up to ${postingAge < 60 ? 60 : 90} days old would let more through.`;
  if (share("work_setting") >= 0.3) return "Allowing another work setting would widen it.";
  return null;
}
