"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { hashKey, newIngestKey } from "@/lib/keys";
import { LoginExpiredError, minds } from "@/lib/minds/client";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { mockTopUp } from "@/lib/minds/mock";
import { askPersonalMind, personalBrief, settleQuestion, switchOffLater } from "@/lib/personal";
import { requireUser } from "@/lib/session";

export type PersonalState = { error?: string; ok?: string } | undefined;

function friendly(e: unknown): string {
  if (e instanceof LoginExpiredError) return "Your Hello Minds login has expired. Please sign in again.";
  console.error(e);
  return "Hello Minds didn't respond. Please try again in a minute.";
}

const done = () => revalidatePath("/app", "layout");

// Awakens the personal Mind. It needs cognition before it can be briefed.
export async function createPersonalMind(): Promise<PersonalState> {
  const user = await requireUser();
  if (user.personalMindId) return;
  const api = minds(user);
  try {
    const base = `${user.username}-me`.slice(0, 40);
    let name = base;
    for (let n = 2; n <= 12 && !(await api.isNameAvailable(name)); n++) name = `${base}-${n}`;
    if (!(await api.isNameAvailable(name))) name = `${base}-${crypto.randomUUID().slice(0, 6)}`;
    const mind = await api.awaken(mindsConfig.archetype, name);
    // Off until it's briefed; it's switched on only when it has something to answer.
    await api.setEnabled(mind.mindId, false).catch((e) => console.error("[personal] couldn't switch off", e));
    await db.update(schema.users).set({ personalMindId: mind.mindId, personalMindName: mind.name }).where(eq(schema.users.id, user.id));
  } catch (e) {
    return { error: friendly(e) };
  }
  done();
}

// Once it has cognition, sends the brief with the latest resume. Safe to call repeatedly.
export async function activatePersonalMind(): Promise<PersonalState> {
  const user = await requireUser();
  if (!user.personalMindId) return { error: "Create your personal Mind first." };
  if (user.personalBriefedAt) return;
  if (mindsMode === "live" && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(mindsConfig.ingestUrl)) {
    return { error: "Your personal Mind can't reach this computer. Set INGEST_URL to your tunnel address (npm run tunnel)." };
  }
  const profile = await db.query.profiles.findFirst({
    where: and(eq(schema.profiles.userId, user.id), isNotNull(schema.profiles.resumeData)),
    orderBy: desc(schema.profiles.createdAt),
  });
  if (!profile?.resumeData) return { error: "Upload a resume to one of your headhunters first." };
  const api = minds(user);
  try {
    const balance = await api.getBalance(user.personalMindId);
    if (balance <= 0) return { error: "No cognition yet. Top it up on Hello Minds; it can take a minute to arrive." };
    const key = newIngestKey();
    const alias = `unemploy-me-${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
    await db.update(schema.users).set({ personalKeyHash: hashKey(key), personalAlias: alias }).where(eq(schema.users.id, user.id));
    await api.setEnabled(user.personalMindId, true);
    await api.createConversation(alias, user.personalMindId);
    await api.sendMessage(alias, personalBrief({ username: user.username ?? "Me", ingestUrl: mindsConfig.ingestUrl, key, user }), [
      {
        fileName: profile.resumeFileName!,
        mimeType: profile.resumeMime!,
        extension: profile.resumeFileName!.split(".").pop()!.toLowerCase(),
        content: profile.resumeData,
      },
    ]);
    // The brief already holds every saved answer.
    const now = new Date();
    await db.update(schema.users).set({ personalBriefedAt: now, personalSyncedAt: now }).where(eq(schema.users.id, user.id));
    switchOffLater(user.id);
  } catch (e) {
    return { error: friendly(e) };
  }
  done();
}

export async function simulatePersonalTopUp() {
  if (mindsMode !== "mock") return;
  const user = await requireUser();
  if (user.personalMindId) mockTopUp(user.personalMindId);
  return activatePersonalMind();
}

export async function askNow(): Promise<PersonalState> {
  const user = await requireUser();
  try {
    const r = await askPersonalMind(user.id);
    done();
    if (r.busy) return { ok: "It's still answering your last batch." };
    if (!r.sent && !r.taught) return { ok: "Nothing new to ask." };
    return { ok: r.sent ? `Sent ${r.sent} ${r.sent === 1 ? "question" : "questions"}. Answers usually arrive within a few minutes.` : "Sent your latest answers for it to remember." };
  } catch (e) {
    return { error: friendly(e) };
  }
}

async function owned(user: User, id: string) {
  return db.query.questions.findFirst({ where: and(eq(schema.questions.id, id), eq(schema.questions.userId, user.id)) });
}

// The person approves the Mind's answer, edits it, or writes their own: the extension uses it
// from now on, and the personal Mind learns it with the next batch.
export async function saveQuestionAnswer(id: string, answer: string): Promise<PersonalState> {
  const user = await requireUser();
  const clean = answer.trim().slice(0, 1000);
  if (!clean) return { error: "Write an answer first." };
  if (!(await owned(user, id))) return;
  await settleQuestion(user, id, clean);
  done();
}

export async function ignoreQuestion(id: string) {
  const user = await requireUser();
  if (!(await owned(user, id))) return;
  await db.update(schema.questions).set({ status: "ignored" }).where(eq(schema.questions.id, id));
  done();
}
