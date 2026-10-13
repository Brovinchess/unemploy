import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Referrals run on Hello Minds' own programme (both sides earn $5 in Cognitions once the
// friend has had 3 conversations with their Mind). We keep the person's link so they can
// share it from here; nothing is tracked or paid by this app.
export const HM_REFERRAL_SETUP = "https://hellominds.ai/profile?tab=account";

export function parseHmReferral(raw: string): string | null {
  const s = raw.trim();
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.hostname !== "hellominds.ai" && u.hostname !== "www.hellominds.ai") return null;
    if (!u.pathname.startsWith("/join")) return null;
    if (!u.searchParams.get("tag")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function hmReferralUrl(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { hmReferralUrl: true } });
  return u?.hmReferralUrl ?? null;
}
