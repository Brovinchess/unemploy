import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { isPublicHttpUrl } from "@/lib/ingest";
import { releaseStaleQuestions } from "@/lib/personal";
import { checkPosting } from "@/lib/quality";
import { endSearch, isSearching } from "@/lib/search";

// Runs daily (vercel.json): clears expired sessions, closes searches that never finished,
// and rechecks shortlisted postings. It never wakes a Mind; searches start only from the user.
export const maxDuration = 300;

const HOUR = 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expired = await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).returning({ id: schema.sessions.id });
  const closed = await recheckOpenJobs();

  // Searches only run when the user asks, so nothing is nudged. A search that never sent
  // its final batch is closed here, and its Mind switched off.
  const open = await db.query.profiles.findMany({
    where: and(isNotNull(schema.profiles.searchStartedAt), isNull(schema.profiles.searchEndedAt)),
  });
  let stale = 0;
  for (const p of open) {
    if (isSearching(p)) continue;
    await endSearch(p, "timeout").catch((e) => console.error("[watchdog] end search failed", p.id, e));
    stale++;
  }

  // Questions the personal Mind never answered go back in the queue, and it's switched off.
  const released = await releaseStaleQuestions();

  console.log(`[watchdog] stale searches ${stale}, closed jobs ${closed}, expired sessions ${expired.length}, released questions ${released}`);
  return NextResponse.json({ expiredSessions: expired.length, closedJobs: closed, staleSearches: stale, releasedQuestions: released });
}

// Re-opens every job still waiting on the user (new or saved, last 30 days) and marks the
// ones whose posting has closed, so shortlists don't fill up with dead jobs.
const RECHECK_LIMIT = 300;
async function recheckOpenJobs() {
  const jobs = await db.query.jobs.findMany({
    where: and(
      inArray(schema.jobs.status, ["new", "saved"]),
      eq(schema.jobs.demo, false),
      gte(schema.jobs.createdAt, new Date(Date.now() - 30 * 24 * HOUR)),
    ),
    columns: { id: true, url: true },
    limit: RECHECK_LIMIT,
  });
  let closed = 0;
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(
      jobs.slice(i, i + 8).map(async (j) => {
        const state = await checkPosting(j.url, isPublicHttpUrl);
        const now = new Date();
        if (state === "closed") {
          closed++;
          await db.update(schema.jobs).set({ status: "expired", statusChangedAt: now, lastCheckedAt: now }).where(eq(schema.jobs.id, j.id));
        } else if (state === "open") {
          await db.update(schema.jobs).set({ lastCheckedAt: now }).where(eq(schema.jobs.id, j.id));
        }
      }),
    );
  }
  return closed;
}
