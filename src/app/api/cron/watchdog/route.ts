import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { minds, LoginExpiredError } from "@/lib/minds/client";
import { mindsMode } from "@/lib/minds/config";
import { isPublicHttpUrl } from "@/lib/ingest";
import { checkPosting } from "@/lib/quality";

// Runs daily (vercel.json). Nudges headhunters that have missed their daily delivery,
// following the Hello Minds field guide: one nudge a day, stop after three, and write
// every nudge in the owner's voice with a unique tail so it isn't taken as a repeat.
export const maxDuration = 300;

const HOUR = 60 * 60 * 1000;
const NUDGE_AFTER = 30 * HOUR;
const GIVE_UP_AFTER = NUDGE_AFTER + 3 * 24 * HOUR;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expired = await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).returning({ id: schema.sessions.id });
  const closed = await recheckOpenJobs();

  if (mindsMode !== "live") return NextResponse.json({ expiredSessions: expired.length, closedJobs: closed, nudged: 0, mode: mindsMode });

  const hunting = await db.query.profiles.findMany({
    where: and(eq(schema.profiles.status, "hunting"), isNotNull(schema.profiles.mindId), isNotNull(schema.profiles.briefedAt)),
  });

  let nudged = 0;
  const skipped: string[] = [];
  for (const p of hunting) {
    const lastSeen = (p.lastDeliveryAt ?? p.briefedAt!).getTime();
    const quiet = Date.now() - lastSeen;
    if (quiet < NUDGE_AFTER || quiet >= GIVE_UP_AFTER) continue;

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, p.userId) });
    if (!user) continue;
    const day = Math.floor(quiet / (24 * HOUR));
    try {
      await minds(user).beacon(
        p.mindId!,
        `${user.username} here. I haven't had any "${p.label}" jobs from you for about ${day} day${day === 1 ? "" : "s"}. ` +
          `Could you run today's search and send what you find to the endpoint in your brief? ` +
          `If something is blocking you, reply with one line saying what. (${new Date().toISOString()})`,
      );
      nudged++;
    } catch (e) {
      skipped.push(p.id);
      if (!(e instanceof LoginExpiredError)) console.error("[watchdog] beacon failed", p.id, e);
    }
  }

  console.log(`[watchdog] nudged ${nudged}, skipped ${skipped.length}, closed jobs ${closed}, expired sessions ${expired.length}`);
  return NextResponse.json({ expiredSessions: expired.length, closedJobs: closed, nudged, skipped: skipped.length });
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
