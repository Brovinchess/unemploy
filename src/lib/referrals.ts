import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Career Ninja's own referral tracking. Each user has a short code; careerninja.app/r/<code>
// drops a cookie, and a brand-new account signed up with that cookie is recorded as referred.
// No rewards yet: the Referral tab shows who joined and what they've spent.

export const REF_COOKIE = "cn_ref";
export const REF_COOKIE_DAYS = 30;

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

// The person's code, made on first use and kept.
export async function referralCodeFor(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const clash = await db.query.users.findFirst({ where: eq(schema.users.referralCode, code), columns: { id: true } });
    if (clash) continue;
    await db.update(schema.users).set({ referralCode: code }).where(eq(schema.users.id, userId));
    return code;
  }
  throw new Error("couldn't make a referral code");
}

export const isReferralCode = (s: string) => /^[a-z0-9]{6,12}$/.test(s);

// Called once for a brand-new account: links it to whoever's code was in the cookie.
export async function attachReferral(newUserId: string, code: string | undefined) {
  if (!code || !isReferralCode(code)) return false;
  const referrer = await db.query.users.findFirst({ where: eq(schema.users.referralCode, code), columns: { id: true } });
  if (!referrer || referrer.id === newUserId) return false;
  await db.update(schema.users).set({ referredBy: referrer.id }).where(eq(schema.users.id, newUserId));
  await db
    .insert(schema.referrals)
    .values({ id: crypto.randomUUID(), referrerId: referrer.id, referredId: newUserId, status: "joined" })
    .onConflictDoNothing();
  return true;
}

export type ReferredFriend = {
  username: string | null;
  joinedAt: Date;
  deployed: boolean;
  searches: number;
  cognition: number; // spent on searches so far
};

// Everyone this person brought in, newest first, with what they've done since.
export async function referralStats(userId: string): Promise<{ friends: ReferredFriend[]; cognition: number }> {
  const rows = await db
    .select({ id: schema.users.id, username: schema.users.username, joinedAt: schema.users.createdAt })
    .from(schema.referrals)
    .innerJoin(schema.users, eq(schema.users.id, schema.referrals.referredId))
    .where(eq(schema.referrals.referrerId, userId))
    .orderBy(desc(schema.users.createdAt));
  if (!rows.length) return { friends: [], cognition: 0 };
  const ids = rows.map((r) => r.id);
  const usage = await db
    .select({
      userId: schema.profiles.userId,
      deployed: sql<boolean>`bool_or(${schema.profiles.mindId} is not null)`,
      searches: sql<number>`count(${schema.searches.id})`,
      cognition: sql<number>`coalesce(sum(${schema.searches.cognitionUsed}), 0)`,
    })
    .from(schema.profiles)
    .leftJoin(schema.searches, eq(schema.searches.profileId, schema.profiles.id))
    .where(inArray(schema.profiles.userId, ids))
    .groupBy(schema.profiles.userId);
  const byUser = new Map(usage.map((u) => [u.userId, u]));
  const friends = rows.map((r) => {
    const u = byUser.get(r.id);
    return { username: r.username, joinedAt: r.joinedAt, deployed: !!u?.deployed, searches: Number(u?.searches ?? 0), cognition: Math.round(Number(u?.cognition ?? 0)) };
  });
  return { friends, cognition: friends.reduce((a, f) => a + f.cognition, 0) };
}
