import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";

export const newIngestKey = () => `uk_${randomBytes(24).toString("base64url")}`;
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
// Enough of the key to tell whose it was, not enough to use it.
export const keyHint = (key: string) => key.slice(0, 8);

// A new key for a headhunter. The one before stays valid, so a push already on its way with the
// old key is not refused. Returns the key itself: it is sent once and only its hash is kept.
export async function rotateKey(profileId: string): Promise<string> {
  const key = newIngestKey();
  const current = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId), columns: { ingestKeyHash: true } });
  await db
    .update(schema.profiles)
    .set({ ingestKeyHash: hashKey(key), prevIngestKeyHash: current?.ingestKeyHash ?? null, ingestKeyHint: keyHint(key) })
    .where(eq(schema.profiles.id, profileId));
  return key;
}

export type KeyLookup = { profile: Profile | null; stale: boolean; owner: Profile | null };

// Who a key belongs to: the current key, or the one before it. A key that matches neither but
// starts like a key we issued still names its owner, so the failure can be traced and repaired.
export async function profileForKey(key: string): Promise<KeyLookup> {
  const h = hashKey(key);
  const profile = await db.query.profiles.findFirst({ where: or(eq(schema.profiles.ingestKeyHash, h), eq(schema.profiles.prevIngestKeyHash, h)) });
  if (profile) return { profile, stale: profile.ingestKeyHash !== h, owner: profile };
  const owner = key.length >= 8 ? ((await db.query.profiles.findFirst({ where: eq(schema.profiles.ingestKeyHint, keyHint(key)) })) ?? null) : null;
  return { profile: null, stale: false, owner };
}

// A rejected key that can be traced: note it once an hour, and let the caller send a fresh one.
export async function noteRejectedKey(owner: Profile): Promise<boolean> {
  const recent = await db.query.notices.findFirst({
    where: and(eq(schema.notices.userId, owner.userId), eq(schema.notices.kind, "key_rejected"), gte(schema.notices.sentAt, new Date(Date.now() - 60 * 60 * 1000))),
    columns: { id: true },
  });
  if (recent) return false;
  await db.insert(schema.notices).values({ userId: owner.userId, kind: "key_rejected", meta: { profileId: owner.id } });
  return true;
}
