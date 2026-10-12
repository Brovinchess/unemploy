import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { mindsConfig } from "./minds/config";

// Friend referrals. A person shares careerninja.app/?ref=CODE; a friend who signs in through it
// is "joined"; once the friend's first headhunter is running they are "qualified" and the
// referrer is owed REFERRAL_REWARD cognition, topped up by hand on Hello Minds (there's no API
// for it), after which the row is marked "rewarded".
export const REFERRAL_REWARD = 100;
export const REF_COOKIE = "cn_ref";

const newCode = () => randomBytes(5).toString("base64url").replace(/[-_]/g, "x").slice(0, 7).toLowerCase();

export async function referralCodeFor(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await db.update(schema.users).set({ referralCode: code }).where(eq(schema.users.id, userId));
      return code;
    } catch {
      /* collision, try another */
    }
  }
  throw new Error("Couldn't make a referral code");
}

export const referralLink = (code: string) => `${mindsConfig.appUrl}/?ref=${code}`;

// A new account arrived with a code: remember who sent them. Self-referrals and unknown codes are ignored.
export async function recordReferral(newUserId: string, code: string | undefined | null) {
  const ref = (code ?? "").trim().toLowerCase().slice(0, 16);
  if (!ref) return;
  const referrer = await db.query.users.findFirst({ where: eq(schema.users.referralCode, ref), columns: { id: true } });
  if (!referrer || referrer.id === newUserId) return;
  await db.update(schema.users).set({ referredBy: ref }).where(eq(schema.users.id, newUserId));
  await db
    .insert(schema.referrals)
    .values({ id: crypto.randomUUID(), referrerId: referrer.id, referredId: newUserId })
    .onConflictDoNothing();
}

// The friend's first headhunter is running: the referral counts, and the reward is owed.
export async function qualifyReferral(userId: string) {
  await db
    .update(schema.referrals)
    .set({ status: "qualified", reward: REFERRAL_REWARD, qualifiedAt: new Date() })
    .where(and(eq(schema.referrals.referredId, userId), eq(schema.referrals.status, "joined")));
}

export async function referralStats(userId: string) {
  const rows = await db
    .select({ status: schema.referrals.status, n: count(), reward: sum(schema.referrals.reward) })
    .from(schema.referrals)
    .where(eq(schema.referrals.referrerId, userId))
    .groupBy(schema.referrals.status);
  const by = (s: string) => rows.find((r) => r.status === s);
  return {
    joined: rows.reduce((a, r) => a + r.n, 0),
    qualified: (by("qualified")?.n ?? 0) + (by("rewarded")?.n ?? 0),
    owed: Number(by("qualified")?.reward ?? 0),
    paid: Number(by("rewarded")?.reward ?? 0),
  };
}
