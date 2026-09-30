"use server";

import { randomBytes } from "node:crypto";
import { count, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

export type JoinState =
  | { ok: true; id: string; position: number; code: string; referrals: number; alreadyJoined: boolean }
  | { ok: false; error: string }
  | undefined;

const emailSchema = z.email().max(254);
const newCode = () => randomBytes(5).toString("base64url").replace(/[-_]/g, "x").slice(0, 7).toLowerCase();

async function standing(entry: typeof schema.waitlist.$inferSelect) {
  const [{ n }] = await db.select({ n: count() }).from(schema.waitlist).where(lte(schema.waitlist.createdAt, entry.createdAt));
  const [{ r }] = await db.select({ r: count() }).from(schema.waitlist).where(eq(schema.waitlist.referredBy, entry.referralCode));
  return { position: n, referrals: r };
}

export async function joinWaitlist(_: JoinState, formData: FormData): Promise<JoinState> {
  // Honeypot: real people never see or fill this field.
  if (formData.get("company_website")) return { ok: false, error: "Something went wrong. Please try again." };

  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Please enter a valid email address." };
  const email = parsed.data;

  const ref = String(formData.get("ref") ?? "").trim().toLowerCase().slice(0, 16) || null;
  const source = String(formData.get("source") ?? "").trim().slice(0, 60) || null;

  const existing = await db.query.waitlist.findFirst({ where: eq(schema.waitlist.email, email) });
  if (existing) return { ok: true, id: "", code: existing.referralCode, alreadyJoined: true, ...(await standing(existing)) };

  const referrer = ref ? await db.query.waitlist.findFirst({ where: eq(schema.waitlist.referralCode, ref) }) : undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [entry] = await db
        .insert(schema.waitlist)
        .values({ email, referralCode: newCode(), referredBy: referrer?.referralCode ?? null, source })
        .returning();
      console.log(`[waitlist] joined${referrer ? " via referral" : ""}${source ? ` from ${source}` : ""}`);
      return { ok: true, id: entry.id, code: entry.referralCode, alreadyJoined: false, ...(await standing(entry)) };
    } catch (e) {
      // A double submit, or (rarely) a referral-code collision: re-check, then retry.
      const again = await db.query.waitlist.findFirst({ where: eq(schema.waitlist.email, email) });
      if (again) return { ok: true, id: "", code: again.referralCode, alreadyJoined: true, ...(await standing(again)) };
      if (attempt === 2) {
        console.error("[waitlist] insert failed", e);
        return { ok: false, error: "We couldn't add you just now. Please try again." };
      }
    }
  }
  return { ok: false, error: "We couldn't add you just now. Please try again." };
}

// The optional follow-up questions, keyed by the entry's private id (the referral code is public).
export async function saveWaitlistDetails(id: string, roleArea: string, country: string) {
  if (!z.uuid().safeParse(id).success) return;
  const clean = (s: string) => s.trim().slice(0, 80) || null;
  await db
    .update(schema.waitlist)
    .set({ roleArea: clean(roleArea), country: clean(country) })
    .where(eq(schema.waitlist.id, id));
}
