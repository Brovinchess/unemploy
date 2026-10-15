"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { settleQuestion } from "@/lib/personal";
import { requireUser } from "@/lib/session";

export type PersonalState = { error?: string; ok?: string } | undefined;

async function owned(user: User, id: string) {
  return db.query.questions.findFirst({ where: and(eq(schema.questions.id, id), eq(schema.questions.userId, user.id)) });
}

// The person approves the headhunter's answer, edits it, or writes their own: the extension
// fills it from now on, and the headhunter gets it with the next search request.
export async function saveQuestionAnswer(id: string, answer: string): Promise<PersonalState> {
  const user = await requireUser();
  const clean = answer.trim().slice(0, 1000);
  if (!clean) return { error: "Write an answer first." };
  if (!(await owned(user, id))) return;
  await settleQuestion(user, id, clean);
  revalidatePath("/app/you");
}

export async function ignoreQuestion(id: string) {
  const user = await requireUser();
  if (!(await owned(user, id))) return;
  await db.update(schema.questions).set({ status: "ignored" }).where(eq(schema.questions.id, id));
  revalidatePath("/app/you");
}
