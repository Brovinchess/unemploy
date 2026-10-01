"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createExtensionToken } from "@/lib/extension";
import { requireUser } from "@/lib/session";

// Hands the extension a token for this account (the page passes it on; it never shows).
export async function connectExtension(): Promise<{ token: string }> {
  const user = await requireUser();
  return { token: await createExtensionToken(user.id) };
}

const text = (max: number) => z.string().trim().max(max);
const detailsSchema = z.object({
  firstName: text(60).min(1, "Add your first name"),
  lastName: text(60).min(1, "Add your last name"),
  email: z.email("Add a valid email").max(254),
  phone: text(40).min(5, "Add a phone number"),
  location: text(120).min(2, "Add where you live"),
  linkedin: text(300).optional(),
  website: text(300).optional(),
  workAuthorization: text(200).optional(),
  noticePeriod: text(100).optional(),
  salaryExpectation: text(100).optional(),
});

export type DetailsState = { ok?: boolean; error?: string } | undefined;

export async function saveApplicantDetails(_: DetailsState, form: FormData): Promise<DetailsState> {
  const user = await requireUser();
  const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = detailsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(schema.users).set({ applicant: parsed.data }).where(eq(schema.users.id, user.id));
  revalidatePath("/app", "layout");
  return { ok: true };
}
