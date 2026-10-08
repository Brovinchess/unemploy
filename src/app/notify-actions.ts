"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { emailConfigured, sendVerificationCode } from "@/lib/email";
import { requireUser } from "@/lib/session";

// A verified email for "your search is done" messages. Same 6-digit code flow as the
// waitlist, with codes tagged to the signed-in user so they can't be used elsewhere.
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");
const tag = (userId: string) => `notify:${userId}`;

export type NotifyState = { ok: true; sentTo?: string; done?: boolean; devLog?: boolean } | { ok: false; error: string } | undefined;

export async function sendEmailCode(emailInput: string): Promise<NotifyState> {
  const user = await requireUser();
  const parsed = z.email().max(254).safeParse(emailInput.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Please enter a valid email address." };
  const email = parsed.data;

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.emailCodes)
    .where(and(eq(schema.emailCodes.source, tag(user.id)), gte(schema.emailCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (n >= MAX_SENDS_PER_HOUR) return { ok: false, error: "Too many codes requested. Please try again in an hour." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(schema.emailCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    source: tag(user.id),
  });
  try {
    await sendVerificationCode(email, code, "notify");
  } catch (e) {
    console.error("[notify] sending code failed", e);
    return { ok: false, error: "We couldn't send the email just now. Please try again." };
  }
  // Locally, without an email service key, the code goes to the server log instead.
  return { ok: true, sentTo: email, devLog: !emailConfigured() };
}

export async function confirmEmailCode(emailInput: string, codeInput: string): Promise<NotifyState> {
  const user = await requireUser();
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Enter the 6-digit code from the email." };

  const row = await db.query.emailCodes.findFirst({
    where: and(eq(schema.emailCodes.email, email), eq(schema.emailCodes.source, tag(user.id)), isNull(schema.emailCodes.verifiedAt)),
    orderBy: desc(schema.emailCodes.createdAt),
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: "That code has expired. Send a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many tries. Send a new code." };
  const match = timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hashCode(email, code), "hex"));
  if (!match) {
    await db.update(schema.emailCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.emailCodes.id, row.id));
    return { ok: false, error: "That code isn't right. Check the email and try again." };
  }
  await db.update(schema.emailCodes).set({ verifiedAt: new Date(), consumedAt: new Date() }).where(eq(schema.emailCodes.id, row.id));
  await db
    .update(schema.users)
    .set({ email, emailVerifiedAt: new Date(), emailOnSearchDone: true })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/app", "layout");
  return { ok: true, done: true };
}

export async function setSearchEmails(on: boolean) {
  const user = await requireUser();
  await db.update(schema.users).set({ emailOnSearchDone: on }).where(eq(schema.users.id, user.id));
  revalidatePath("/app", "layout");
}

export async function setCoachReminders(on: boolean) {
  const user = await requireUser();
  await db.update(schema.users).set({ coachReminders: on }).where(eq(schema.users.id, user.id));
  revalidatePath("/app", "layout");
}

export async function removeEmail() {
  const user = await requireUser();
  await db.update(schema.users).set({ email: null, emailVerifiedAt: null }).where(eq(schema.users.id, user.id));
  revalidatePath("/app", "layout");
}
