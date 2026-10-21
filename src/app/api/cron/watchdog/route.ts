import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isPublicHttpUrl } from "@/lib/ingest";
import { checkPosting } from "@/lib/quality";
import { endSearch, isSearching, nudgeIfQuiet } from "@/lib/search";
import { sendSetupReminders, sendWeeklyDigests } from "@/lib/notices";

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
    if (isSearching(p)) {
      await nudgeIfQuiet(p).catch((e) => console.error("[watchdog] nudge failed", p.id, e));
      continue;
    }
    await endSearch(p, "timeout").catch((e) => console.error("[watchdog] end search failed", p.id, e));
    stale++;
  }

  // The emails the app sends on its own: the day-after reminder, and the Monday digest.
  const reminders = await sendSetupReminders().catch((e) => (console.error("[watchdog] reminders", e), 0));
  const digests = await sendWeeklyDigests().catch((e) => (console.error("[watchdog] digests", e), 0));

  // Last, because it matters least if the run is cut short: keep the shared pool fresh.
  const pool = await recheckPostings().catch((e) => (console.error("[watchdog] postings", e), { checked: 0, closed: 0, retired: 0 }));

  console.log(`[watchdog] stale searches ${stale}, closed jobs ${closed}, pool checked ${pool.checked} closed ${pool.closed} retired ${pool.retired}, expired sessions ${expired.length}`);
  return NextResponse.json({ expiredSessions: expired.length, closedJobs: closed, staleSearches: stale, reminders, digests, pool });
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
    columns: { id: true, url: true, postingKey: true },
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
        // The pool row for the same posting learns the result too, so it isn't fetched twice.
        if (j.postingKey && state !== "unknown") {
          await db
            .update(schema.postings)
            .set(state === "closed" ? { closedAt: now, lastCheckedAt: now } : { lastVerifiedOpenAt: now, lastCheckedAt: now })
            .where(eq(schema.postings.postingKey, j.postingKey));
        }
      }),
    );
  }
  return closed;
}

// The shared pool: postings nobody has looked at lately get a quick open-check, oldest first,
// with a small cap and a short timeout so the job recheck above always finishes. Rows not seen
// for 60 days are retired; a lead that pointed at one keeps its own copy of the facts.
const POOL_LIMIT = 60;
const POOL_DAYS = 60;
async function recheckPostings() {
  const retired = await db
    .delete(schema.postings)
    .where(lt(schema.postings.lastSeenAt, new Date(Date.now() - POOL_DAYS * 24 * HOUR)))
    .returning({ k: schema.postings.postingKey });
  const rows = await db.query.postings.findMany({
    where: and(isNull(schema.postings.closedAt), eq(schema.postings.demo, false)),
    orderBy: [sql`${schema.postings.lastCheckedAt} asc nulls first`],
    columns: { postingKey: true, url: true },
    limit: POOL_LIMIT,
  });
  let closed = 0;
  for (let i = 0; i < rows.length; i += 8) {
    await Promise.all(
      rows.slice(i, i + 8).map(async (p) => {
        const state = await checkPosting(p.url, isPublicHttpUrl, 6_000);
        const now = new Date();
        // Every result, even "unknown", stamps the row so the queue moves on to the next one tomorrow.
        await db
          .update(schema.postings)
          .set({ lastCheckedAt: now, ...(state === "closed" ? { closedAt: now } : state === "open" ? { lastVerifiedOpenAt: now } : {}) })
          .where(eq(schema.postings.postingKey, p.postingKey));
        if (state === "closed") closed++;
      }),
    );
  }
  return { checked: rows.length, closed, retired: retired.length };
}
