"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { JobStatus, Profile, User } from "@/db/schema";
import { buildBrief } from "@/lib/brief";
import { hashKey, newIngestKey } from "@/lib/keys";
import { minds, LoginExpiredError, type Attachment } from "@/lib/minds/client";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { mockTopUp } from "@/lib/minds/mock";
import { ownedJob, ownedProfile } from "@/lib/owned";
import { preferencesSchema, type Preferences } from "@/lib/preferences";
import { extractResumeText, MAX_RESUME_BYTES, resumeType } from "@/lib/resume";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { destroySession, requireUser } from "@/lib/session";

export type FormState = { error?: string } | undefined;

function friendly(e: unknown): string {
  if (e instanceof LoginExpiredError) return "Your Hello Minds login has expired. Please sign in again.";
  console.error(e);
  return "Hello Minds didn't respond. Please try again in a minute.";
}

// ---------- Welcome ----------

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/, "Use 3–24 letters, numbers or dashes.");

export async function saveUsername(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const timezone = String(formData.get("timezone") || "UTC").slice(0, 64);
  await db.update(schema.users).set({ username: parsed.data, timezone }).where(eq(schema.users.id, user.id));
  redirect("/profiles/new");
}

// ---------- Profiles ----------

export async function createProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2 || label.length > 40) return { error: "Give it a short name, like “Design” or “Marketing”." };
  const id = crypto.randomUUID();
  await db.insert(schema.profiles).values({ id, userId: user.id, label });
  redirect(`/profiles/${id}/setup`);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);

async function pickMindName(user: User, profile: Profile) {
  const api = minds(user);
  const base = `${user.username}-${slug(profile.label) || "jobs"}`.slice(0, 40);
  for (let n = 1; n <= 12; n++) {
    const name = n === 1 ? base : `${base}-${n}`;
    if (await api.isNameAvailable(name)) return name;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function launchMind(profileId: string): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.mindId) return;
  try {
    const name = await pickMindName(user, profile);
    const mind = await minds(user).awaken(mindsConfig.archetype, name);
    await db
      .update(schema.profiles)
      .set({ mindId: mind.mindId, mindName: mind.name, status: "needs_topup" })
      .where(eq(schema.profiles.id, profile.id));
  } catch (e) {
    return { error: friendly(e) };
  }
  revalidatePath(`/profiles/${profileId}/setup`);
}

export async function checkActivation(profileId: string): Promise<FormState & { balance?: number }> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (!profile.mindId) return { error: "This headhunter hasn't been launched yet." };
  try {
    const balance = await minds(user).getBalance(profile.mindId);
    if (balance <= 0) return { balance, error: "No credit yet. Top-ups can take a minute to arrive." };
    if (profile.status === "needs_topup") {
      await db.update(schema.profiles).set({ status: "needs_resume" }).where(eq(schema.profiles.id, profile.id));
    }
    revalidatePath(`/profiles/${profileId}/setup`);
    return { balance };
  } catch (e) {
    return { error: friendly(e) };
  }
}

export async function simulateTopUp(profileId: string) {
  if (mindsMode !== "mock") return;
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.mindId) mockTopUp(profile.mindId);
  return checkActivation(profileId);
}

async function readResume(formData: FormData) {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose your resume file first." } as const;
  const type = resumeType(file.name);
  if (!type) return { error: "Please upload a PDF or Word (.docx) file." } as const;
  if (file.size > MAX_RESUME_BYTES) return { error: "That file is over 5 MB. Please upload a smaller one." } as const;
  let text: string;
  try {
    text = await extractResumeText(file);
  } catch (e) {
    console.error("[resume] extract failed", e);
    return { error: "We couldn't open that file. Try saving it again as a PDF." } as const;
  }
  if (text.length < 200) {
    return { error: "We couldn't read the text in that file. If it's a scanned image, export it as a text PDF." } as const;
  }
  return {
    values: {
      resumeFileName: file.name,
      resumeMime: type.mime,
      resumeData: Buffer.from(await file.arrayBuffer()).toString("base64"),
      resumeText: text,
    },
  } as const;
}

function resumeAttachment(p: Pick<Profile, "resumeFileName" | "resumeMime" | "resumeData">): Attachment {
  return {
    fileName: p.resumeFileName!,
    mimeType: p.resumeMime!,
    extension: p.resumeFileName!.split(".").pop()!.toLowerCase(),
    content: p.resumeData!,
  };
}

export async function uploadResume(profileId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const r = await readResume(formData);
  if ("error" in r) return { error: r.error };

  const replacing = profile.status === "hunting" || profile.status === "paused";
  if (replacing && profile.conversationAlias) {
    try {
      await minds(user).sendMessage(
        profile.conversationAlias,
        `${user.username} here. I've updated my resume (attached). This replaces the resume I sent before. ` +
          `From now on quote only this one as evidence. Same endpoint and key as before. Reply with one line when you've read it.`,
        [resumeAttachment(r.values)],
      );
    } catch (e) {
      return { error: friendly(e) };
    }
  }

  await db
    .update(schema.profiles)
    .set({ ...r.values, status: replacing ? profile.status : "needs_preferences" })
    .where(eq(schema.profiles.id, profile.id));

  if (replacing) {
    revalidatePath("/app/settings");
    return;
  }
  revalidatePath(`/profiles/${profileId}/setup`);
}

export async function loadSampleResume(profileId: string) {
  if (mindsMode !== "mock") return;
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.status !== "needs_resume") return;
  await db
    .update(schema.profiles)
    .set({
      resumeFileName: "sample-resume.txt",
      resumeMime: "text/plain",
      resumeData: Buffer.from(SAMPLE_RESUME).toString("base64"),
      resumeText: SAMPLE_RESUME,
      status: "needs_preferences",
    })
    .where(eq(schema.profiles.id, profile.id));
  revalidatePath(`/profiles/${profileId}/setup`);
}

export async function savePreferences(profileId: string, input: Preferences): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: "Some answers are missing. Please check each step." };
  const prefs = parsed.data;
  const api = minds(user);

  try {
    if (profile.status === "hunting" || profile.status === "paused") {
      // Name what is replaced so the old preferences don't linger as a standing rule.
      const brief = buildBrief({
        ownerName: user.username!,
        profileLabel: profile.label,
        prefs,
        timezone: user.timezone ?? "UTC",
        appUrl: mindsConfig.ingestUrl,
        ingestKey: "(the same key as before)",
      });
      await api.sendMessage(
        profile.conversationAlias!,
        `This replaces my earlier brief from ${profile.briefedAt?.toISOString().slice(0, 10)} in full.\n\n${brief}`,
      );
      await db
        .update(schema.profiles)
        .set({ preferences: prefs, briefedAt: new Date() })
        .where(eq(schema.profiles.id, profile.id));
      revalidatePath("/app", "layout");
      return;
    }

    if (!profile.mindId || !profile.resumeData) return { error: "Finish the earlier steps first." };

    const ingestKey = newIngestKey();
    // A fresh alias per brief gives the Mind a clean thread.
    const alias = `unemploy-${profile.id.slice(0, 8)}-${Date.now().toString(36)}`;
    // Save first: the Mind may push as soon as it reads the brief.
    await db
      .update(schema.profiles)
      .set({ preferences: prefs, ingestKeyHash: hashKey(ingestKey), conversationAlias: alias })
      .where(eq(schema.profiles.id, profile.id));

    await api.createConversation(alias, profile.mindId);
    await api.sendMessage(
      alias,
      buildBrief({
        ownerName: user.username!,
        profileLabel: profile.label,
        prefs,
        timezone: user.timezone ?? "UTC",
        appUrl: mindsConfig.ingestUrl,
        ingestKey,
      }),
      [resumeAttachment(profile)],
    );
    await db
      .update(schema.profiles)
      .set({ status: "hunting", briefedAt: new Date() })
      .where(eq(schema.profiles.id, profile.id));
  } catch (e) {
    return { error: friendly(e) };
  }
  redirect(`/app?profile=${profileId}&welcome=1`);
}

export async function setPaused(profileId: string, paused: boolean) {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.mindId) await minds(user).setEnabled(profile.mindId, !paused);
  await db
    .update(schema.profiles)
    .set({ status: paused ? "paused" : "hunting" })
    .where(eq(schema.profiles.id, profile.id));
  revalidatePath("/app", "layout");
}

// ---------- Jobs ----------

const STATUSES: JobStatus[] = ["new", "saved", "applied", "heard_back", "interview", "offer", "rejected", "skipped"];

export async function setJobStatus(jobId: string, status: JobStatus, skipReason?: string) {
  if (!STATUSES.includes(status)) return;
  const user = await requireUser();
  await ownedJob(user, jobId);
  await db
    .update(schema.jobs)
    .set({ status, skipReason: status === "skipped" ? (skipReason ?? null) : null, statusChangedAt: new Date() })
    .where(eq(schema.jobs.id, jobId));
  revalidatePath("/app", "layout");
}

// ---------- Account ----------

export async function deleteAccount() {
  const user = await requireUser();
  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
  // Minds can't be deleted on Hello Minds; turning them off stops all spending.
  for (const p of profiles) {
    if (p.mindId) await minds(user).setEnabled(p.mindId, false).catch((e) => console.error(e));
  }
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await destroySession();
  redirect("/?deleted=1");
}
