"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/session";

const feedbackSchema = z.object({
  kind: z.enum(["bug", "idea", "other"]),
  message: z.string().trim().min(3, "Say a little more, so we can act on it.").max(2000),
  page: z.string().trim().max(200).optional(),
});

// A person's report from the feedback button. Stored with who sent it and the page they were on.
export async function sendFeedback(input: unknown): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(schema.feedback).values({ userId: user.id, kind: parsed.data.kind, message: parsed.data.message, page: parsed.data.page || null });
}

// Admin: mark a report done, or reopen it.
export async function setFeedbackStatus(id: string, status: "new" | "done") {
  await requireAdmin();
  await db.update(schema.feedback).set({ status }).where(eq(schema.feedback.id, id));
}
