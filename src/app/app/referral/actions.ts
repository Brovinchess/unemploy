"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseHmReferral } from "@/lib/referrals";
import { requireUser } from "@/lib/session";

export type LinkState = { error?: string; ok?: boolean } | undefined;

export async function saveHmReferral(_: LinkState, form: FormData): Promise<LinkState> {
  const user = await requireUser();
  const raw = String(form.get("link") ?? "");
  if (!raw.trim()) {
    await db.update(schema.users).set({ hmReferralUrl: null }).where(eq(schema.users.id, user.id));
    revalidatePath("/app/referral");
    return { ok: true };
  }
  const url = parseHmReferral(raw);
  if (!url) return { error: "That doesn't look like a Hello Minds referral link. It starts with hellominds.ai/join and ends with your tag." };
  await db.update(schema.users).set({ hmReferralUrl: url }).where(eq(schema.users.id, user.id));
  revalidatePath("/app/referral");
  return { ok: true };
}
