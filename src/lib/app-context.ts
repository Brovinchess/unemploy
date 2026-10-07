import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { minds } from "./minds/client";
import { endSearch, isSearching } from "./search";
import { requireUser } from "./session";

export async function appContext(profileParam?: string | string[]) {
  const user = await requireUser();
  const all = await db.query.profiles.findMany({
    where: eq(schema.profiles.userId, user.id),
    orderBy: asc(schema.profiles.createdAt),
  });
  const ready = all.filter((p) => p.status === "hunting" || p.status === "paused");
  if (!ready.length) redirect("/start");
  const wanted = typeof profileParam === "string" ? profileParam : undefined;
  const current = ready.find((p) => p.id === wanted) ?? ready[0];
  const unfinished = all.filter((p) => !ready.includes(p));
  // A search that ran past its timeout without a final batch is closed now (Mind switched
  // off, you're emailed), instead of waiting for the daily watchdog.
  for (const p of all) {
    if (p.searchStartedAt && !p.searchEndedAt && !isSearching(p)) after(() => endSearch(p, "timeout").catch((e) => console.error("[search] close failed", p.id, e)));
  }
  return { user, profiles: ready, unfinished, current };
}

const BALANCE_FRESH_MS = 2 * 60 * 1000;

// The headhunter's cognition. Pages use the cached figure when it's recent (the live poll
// refreshes it every 15–60 s), so a page never waits on Hello Minds.
export const balanceFor = cache(async (user: User, profile: Profile): Promise<number | null> => {
  if (!profile.mindId) return null;
  if (profile.balanceCache != null && profile.balanceCachedAt && Date.now() - profile.balanceCachedAt.getTime() < BALANCE_FRESH_MS) {
    return profile.balanceCache;
  }
  return freshBalance(user, profile);
});

export async function freshBalance(user: User, profile: Profile): Promise<number | null> {
  if (!profile.mindId) return null;
  try {
    const balance = await minds(user).getBalance(profile.mindId);
    await db.update(schema.profiles).set({ balanceCache: balance, balanceCachedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
    return balance;
  } catch (e) {
    console.error("[balance]", e);
    return profile.balanceCache ?? null;
  }
}
