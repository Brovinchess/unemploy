import { NextResponse } from "next/server";
import { and, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { pauseAfterDryDay, runFollowUps, runMorningSearches, sendCardsWaiting } from "@/lib/morning";
import { endSearch, isSearching, nudgeIfQuiet, reconcileFromChat } from "@/lib/search";

// Runs every hour (vercel.json). Morning searches start for whoever's clock says 9, follow-ups
// three hours after a short morning, the day's "nothing today" email, and the "cards waiting"
// email. Open searches get the same upkeep the daily watchdog gives them, an hour sooner.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();

  const open = await db.query.profiles.findMany({ where: and(isNotNull(schema.profiles.searchStartedAt), isNull(schema.profiles.searchEndedAt)) });
  let stale = 0;
  for (const p of open) {
    if (isSearching(p)) {
      await nudgeIfQuiet(p).catch((e) => console.error("[hourly] nudge failed", p.id, e));
      await reconcileFromChat(p).catch((e) => console.error("[hourly] reconcile failed", p.id, e));
      continue;
    }
    await endSearch(p, "timeout").catch((e) => console.error("[hourly] end search failed", p.id, e));
    stale++;
  }

  const morning = await runMorningSearches(now).catch((e) => (console.error("[hourly] morning", e), 0));
  const followUps = await runFollowUps(now).catch((e) => (console.error("[hourly] follow-ups", e), 0));
  const paused = await pauseAfterDryDay(now).catch((e) => (console.error("[hourly] dry day", e), 0));
  const cards = await sendCardsWaiting(now).catch((e) => (console.error("[hourly] cards", e), 0));

  console.log(`[hourly] daily ${morning}, follow-ups ${followUps}, paused after a dry day ${paused}, cards emails ${cards}, stale searches ${stale}`);
  return NextResponse.json({ daily: morning, followUps, paused, cards, staleSearches: stale });
}
