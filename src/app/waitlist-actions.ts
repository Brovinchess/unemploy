"use server";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { sendVerificationCode } from "@/lib/email";

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

// ---------- Verified sign-up: email → 6-digit code → name + birthdate ----------

const CODE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 30 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const MIN_AGE = 18;

const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");

export type CodeState = { ok: true; email: string } | { ok: false; error: string } | undefined;

export async function requestCode(_: CodeState, formData: FormData): Promise<CodeState> {
  if (formData.get("company_website")) return { ok: false, error: "Something went wrong. Please try again." };
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Please enter a valid email address." };
  const email = parsed.data;

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.emailCodes)
    .where(and(eq(schema.emailCodes.email, email), gte(schema.emailCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (n >= MAX_SENDS_PER_HOUR) return { ok: false, error: "Too many codes requested. Please try again in an hour." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(schema.emailCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    referredBy: String(formData.get("ref") ?? "").trim().toLowerCase().slice(0, 16) || null,
    source: String(formData.get("source") ?? "").trim().slice(0, 60) || null,
  });
  try {
    await sendVerificationCode(email, code);
  } catch (e) {
    console.error("[waitlist] sending code failed", e);
    return { ok: false, error: "We couldn't send the email just now. Please try again." };
  }
  return { ok: true, email };
}

export type VerifyResult =
  | { ok: true; ticket: string; joined?: Extract<JoinState, { ok: true }> }
  | { ok: false; error: string };

export async function verifyCode(emailInput: string, codeInput: string): Promise<VerifyResult> {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Enter the 6-digit code from the email." };

  const row = await db.query.emailCodes.findFirst({
    where: and(eq(schema.emailCodes.email, email), isNull(schema.emailCodes.verifiedAt)),
    orderBy: desc(schema.emailCodes.createdAt),
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: "That code has expired. Send a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many tries. Send a new code." };

  const match = timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hashCode(email, code), "hex"));
  if (!match) {
    await db.update(schema.emailCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.emailCodes.id, row.id));
    return { ok: false, error: "That code isn't right. Check the email and try again." };
  }
  await db.update(schema.emailCodes).set({ verifiedAt: new Date() }).where(eq(schema.emailCodes.id, row.id));

  // Already signed up with a name: nothing more to ask, just show where they stand.
  const existing = await db.query.waitlist.findFirst({ where: eq(schema.waitlist.email, email) });
  if (existing?.name) {
    await db.update(schema.emailCodes).set({ consumedAt: new Date() }).where(eq(schema.emailCodes.id, row.id));
    return {
      ok: true,
      ticket: row.id,
      joined: { ok: true, id: existing.id, code: existing.referralCode, alreadyJoined: true, ...(await standing(existing)) },
    };
  }
  return { ok: true, ticket: row.id };
}

function ageOn(birth: Date, today = new Date()) {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const m = today.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export async function completeSignup(ticket: string, nameInput: string, birthdateInput: string): Promise<JoinState> {
  if (!z.uuid().safeParse(ticket).success) return { ok: false, error: "Please start again." };
  const name = nameInput.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Please enter your name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdateInput)) return { ok: false, error: "Please enter your date of birth." };
  const birth = new Date(`${birthdateInput}T00:00:00Z`);
  const age = ageOn(birth);
  if (Number.isNaN(age) || age > 120 || age < 0) return { ok: false, error: "Please check your date of birth." };
  if (age < MIN_AGE) return { ok: false, error: `Career Ninja is for people ${MIN_AGE} and over.` };

  const t = await db.query.emailCodes.findFirst({ where: eq(schema.emailCodes.id, ticket) });
  if (!t?.verifiedAt || t.consumedAt || Date.now() - t.verifiedAt.getTime() > TICKET_TTL_MS) {
    return { ok: false, error: "Your session expired. Please verify your email again." };
  }
  await db.update(schema.emailCodes).set({ consumedAt: new Date() }).where(eq(schema.emailCodes.id, t.id));

  const details = { name, birthdate: birthdateInput, verifiedAt: new Date() };
  const existing = await db.query.waitlist.findFirst({ where: eq(schema.waitlist.email, t.email) });
  if (existing) {
    // An earlier email-only signup keeps its place in line.
    const [entry] = await db.update(schema.waitlist).set(details).where(eq(schema.waitlist.id, existing.id)).returning();
    return { ok: true, id: entry.id, code: entry.referralCode, alreadyJoined: true, ...(await standing(entry)) };
  }

  const referrer = t.referredBy
    ? await db.query.waitlist.findFirst({ where: eq(schema.waitlist.referralCode, t.referredBy) })
    : undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [entry] = await db
        .insert(schema.waitlist)
        .values({ email: t.email, referralCode: newCode(), referredBy: referrer?.referralCode ?? null, source: t.source, ...details })
        .returning();
      console.log(`[waitlist] verified signup${referrer ? " via referral" : ""}${t.source ? ` from ${t.source}` : ""}`);
      return { ok: true, id: entry.id, code: entry.referralCode, alreadyJoined: false, ...(await standing(entry)) };
    } catch (e) {
      if (attempt === 2) {
        console.error("[waitlist] insert failed", e);
        return { ok: false, error: "We couldn't add you just now. Please try again." };
      }
    }
  }
  return { ok: false, error: "We couldn't add you just now. Please try again." };
}
