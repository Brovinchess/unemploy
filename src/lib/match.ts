// How a job's fit is shown to people. A job that misses a must-have is capped at 55 by ingest,
// and "55%" reads as a bad match when it is really a close one with a gap to weigh. So any job
// with an unmet must-have is labelled by its gaps; every other job keeps its score.
type MustHave = { met: boolean };

export const gapsOf = (mustHaves?: MustHave[] | null) => mustHaves?.filter((m) => !m.met).length ?? 0;

// "Close match, 1 gap" or "86% match".
export function matchLabel(score: number, gaps: number) {
  return gaps > 0 ? `Close match, ${gaps} ${gaps === 1 ? "gap" : "gaps"}` : `${Math.round(score)}% match`;
}

// The form for list rows, where the score has no "match" after it: "Close match, 1 gap" or "86%".
export function matchShort(score: number, gaps: number) {
  return gaps > 0 ? matchLabel(score, gaps) : `${Math.round(score)}%`;
}

// The tooltip that says what the label means.
export function matchHint(gaps: number) {
  return gaps > 0
    ? `Close match. You meet most of what they ask for, but your resume doesn't show ${gaps === 1 ? "one requirement" : `${gaps} requirements`} yet.`
    : "How well it matches your resume";
}
