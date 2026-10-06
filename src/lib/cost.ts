import "server-only";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { BASE_COGNITION_PER_SEARCH, DEFAULT_COGNITION_PER_JOB } from "./preferences";

export type CostModel = { perJob: number; last: { used: number; jobs: number } | null };

// What a search really costs, learnt from this headhunter's own finished searches
// (median cognition per delivered job over the last five). Falls back to the default
// until there's history.
export async function costModel(profileId: string): Promise<CostModel> {
  const rows = await db
    .select({ jobsAdded: schema.searches.jobsAdded, start: schema.searches.balanceStart, end: schema.searches.balanceEnd })
    .from(schema.searches)
    .where(and(eq(schema.searches.profileId, profileId), isNotNull(schema.searches.endedAt), isNotNull(schema.searches.balanceEnd), gt(schema.searches.jobsAdded, 0)))
    .orderBy(desc(schema.searches.startedAt))
    .limit(5);
  const perJobs = rows
    .map((r) => (r.start! - r.end! - BASE_COGNITION_PER_SEARCH) / r.jobsAdded!)
    .filter((x) => Number.isFinite(x) && x > 0)
    .map((x) => Math.min(80, Math.max(8, x)))
    .sort((a, b) => a - b);
  const perJob = perJobs.length ? Math.round(perJobs[Math.floor(perJobs.length / 2)]) : DEFAULT_COGNITION_PER_JOB;
  const r = rows[0];
  const last = r ? { used: Math.max(0, Math.round(r.start! - r.end!)), jobs: r.jobsAdded! } : null;
  return { perJob, last };
}
