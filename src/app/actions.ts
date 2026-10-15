"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { JobStatus, Profile, User } from "@/db/schema";
import { buildBrief } from "@/lib/brief";
import { factsText } from "@/lib/facts";
import { hashKey, newIngestKey } from "@/lib/keys";
import { minds, LoginExpiredError, type Attachment } from "@/lib/minds/client";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { mockTopUp } from "@/lib/minds/mock";
import { ownedJob, ownedProfile } from "@/lib/owned";
import { queueQuestions } from "@/lib/personal";
import { track } from "@/lib/analytics/server";
import { guessName } from "@/lib/normalise";
import { costModel } from "@/lib/cost";
import { estimateSearchCost, PENDING_LABEL, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, preferencesSchema, RECOMMENDED_JOBS_PER_SEARCH, type Preferences, postingAgeDays } from "@/lib/preferences";
import { extractResumeText, MAX_RESUME_BYTES, resumeType } from "@/lib/resume";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { alreadySentList, endSearch, ingestReachable, isSearching, ruledOutList, searchRequestText, switchOff } from "@/lib/search";
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

// A username from the resume: a "Name:" label if there is one, otherwise the first line that
// looks like a person's name (2 to 4 capitalised words, no instructions, no contact details).
// Falls back to a short random handle, and never collides with an existing one. Nobody has to
// type anything to get in; the summary page lets them change it before deploying.
async function assignUsername(user: User, resumeText: string | null | undefined, timezone?: string) {
  if (user.username) return user.username;
  const first = guessName(resumeText)?.split(/\s+/)[0] ?? "";
  const base = first.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  const seed = base.length >= 3 ? base : `ninja${Math.random().toString(36).slice(2, 6)}`;
  let name = seed;
  for (let n = 2; n < 50; n++) {
    const taken = await db.query.users.findFirst({ where: eq(schema.users.username, name), columns: { id: true } });
    if (!taken) break;
    name = `${seed}${n}`;
  }
  await db.update(schema.users).set({ username: name, ...(timezone ? { timezone: timezone.slice(0, 64) } : {}) }).where(eq(schema.users.id, user.id));
  track(user.id, "username_saved", { auto: true });
  return name;
}

// Change the handle before the headhunter is deployed (its Mind is named after it).
export async function renameUsername(username: string): Promise<FormState & { username?: string }> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const deployed = await db.query.profiles.findFirst({ where: and(eq(schema.profiles.userId, user.id), isNotNull(schema.profiles.mindId)), columns: { id: true } });
  if (deployed) return { error: "Your headhunter is already deployed under this name." };
  const taken = await db.query.users.findFirst({ where: eq(schema.users.username, parsed.data), columns: { id: true } });
  if (taken && taken.id !== user.id) return { error: "That name is taken. Try another one." };
  await db.update(schema.users).set({ username: parsed.data }).where(eq(schema.users.id, user.id));
  revalidatePath("/profiles", "layout");
  return { username: parsed.data };
}

// Someone who signed in but has no headhunter yet gets one, so setup can start at the resume.
export async function ensureProfile(user: User) {
  const existing = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, user.id), columns: { id: true } });
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(schema.profiles).values({ id, userId: user.id, label: PENDING_LABEL, status: "needs_resume" });
  return id;
}

// ---------- Profiles ----------


// "Senior Product Designer, UX Designer" → "Product Designer": the first role, without seniority words.
function labelFromRoles(roles: string) {
  const first = roles.split(/,|\/| or /i)[0]?.trim() ?? "";
  const clean = first.replace(/\b(senior|junior|lead|principal|staff|head of|mid-level|entry-level)\b/gi, "").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  return (words || first || "Jobs").slice(0, 40);
}

async function pickMindName(user: User) {
  const api = minds(user);
  // Every Mind we create carries the app's name: rovin-careerninja, then rovin-careerninja-2.
  const base = `${user.username}-careerninja`.slice(0, 40);
  for (let n = 1; n <= 12; n++) {
    const name = n === 1 ? base : `${base}-${n}`;
    if (await api.isNameAvailable(name)) return name;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export type ActivationState = FormState & { balance?: number; started?: boolean; searching?: boolean };

// Creates the Mind and, since new Minds come with free cognition, briefs it straight away.
// Only if the free cognition hasn't landed yet does setup fall back to waiting for it.
export async function launchMind(profileId: string): Promise<ActivationState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.mindId) return checkActivation(profileId, true);
  try {
    const name = await pickMindName(user);
    const mind = await minds(user).awaken(mindsConfig.archetype, name);
    await db
      .update(schema.profiles)
      .set({ mindId: mind.mindId, mindName: mind.name, status: "needs_topup" })
      .where(eq(schema.profiles.id, profile.id));
    track(user.id, "headhunter_deployed", { mind: mind.name });
  } catch (e) {
    return { error: friendly(e) };
  }
  revalidatePath(`/profiles/${profileId}/setup`);
  return checkActivation(profileId, true);
}

// Called on a timer while the user tops up. Once the Mind has cognition, it gets its
// brief and the hunt starts, so there's no separate "start" step.
export async function checkActivation(profileId: string, quiet = false): Promise<ActivationState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.status === "hunting" || profile.status === "paused") return { started: true };
  if (!profile.mindId) return { error: "This headhunter hasn't been created yet." };
  try {
    const balance = await minds(user).getBalance(profile.mindId);
    // Keep the cached balance in step so the app shows the real number from the first screen.
    await db.update(schema.profiles).set({ balanceCache: balance, balanceCachedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
    if (balance <= 0) return { balance, error: quiet ? undefined : "No cognition yet. It can take a minute to arrive." };
    const r = await startHunting(user, profile);
    if (r?.error) return { balance, error: r.error };
    if (r?.claimedElsewhere) return { balance, started: true, searching: true };
    // First search starts by itself, so the next screen is the headhunter already working.
    // If it can't start, the app's ready screen shows the search button and the reason.
    const s = await requestSearch(profile.id, profile.preferences?.jobsPerDay ?? RECOMMENDED_JOBS_PER_SEARCH).catch((e) => {
      console.error("[activate] first search", e);
      return { error: String(e) };
    });
    return { balance, started: true, searching: !s?.error };
  } catch (e) {
    return { error: friendly(e) };
  }
}

// After a brief (which asks the Mind not to search), give it a couple of minutes to read and
// reply, then switch it off unless a search has started meanwhile.
function switchOffLater(profileId: string) {
  after(async () => {
    await new Promise((r) => setTimeout(r, 120_000));
    const p = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
    if (p && !isSearching(p)) await switchOff(p);
  });
}

// Sends the first brief (with the resume) in a fresh conversation and marks the profile hunting.
async function startHunting(user: User, profile: Profile): Promise<{ error?: string; claimedElsewhere?: boolean } | undefined> {
  if (!profile.mindId || !profile.resumeData || !profile.preferences) return { error: "Finish the earlier steps first." };
  if (mindsMode === "live" && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(mindsConfig.ingestUrl)) {
    return { error: "Your headhunter can't reach this computer. Set INGEST_URL to your tunnel address (npm run tunnel) and try again." };
  }
  const ingestKey = newIngestKey();
  // A fresh alias per brief gives the Mind a clean thread.
  const alias = `unemploy-${profile.id.slice(0, 8)}-${Date.now().toString(36)}`;
  // Save first: the Mind may push as soon as it reads the brief. The alias write doubles as a
  // claim: the poll and a "Check now" click can both get here, and only the first one briefs.
  const claimed = await db
    .update(schema.profiles)
    .set({ ingestKeyHash: hashKey(ingestKey), conversationAlias: alias })
    .where(and(eq(schema.profiles.id, profile.id), profile.conversationAlias ? eq(schema.profiles.conversationAlias, profile.conversationAlias) : isNull(schema.profiles.conversationAlias)))
    .returning({ id: schema.profiles.id });
  if (!claimed.length) return { claimedElsewhere: true };
  const api = minds(user);
  await api.createConversation(alias, profile.mindId);
  await api.sendMessage(
    alias,
    buildBrief({
      ownerName: user.username!,
      profileLabel: profile.label,
      prefs: profile.preferences,
      timezone: user.timezone ?? "UTC",
      appUrl: mindsConfig.ingestUrl,
      ingestKey,
      facts: factsText(user),
    }),
    [resumeAttachment(profile)],
  );
  await db
    .update(schema.profiles)
    .set({ status: "hunting", briefedAt: new Date() })
    .where(eq(schema.profiles.id, profile.id));
  switchOffLater(profile.id);
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

  // Replacing: just save. The next search request attaches the new resume (see requestSearch),
  // so the Mind isn't woken, and charged, only to read a file.
  const replacing = profile.status === "hunting" || profile.status === "paused";
  await db
    .update(schema.profiles)
    .set({ ...r.values, status: replacing ? profile.status : "needs_preferences", ...(replacing ? { resumeChangedAt: new Date() } : {}) })
    .where(eq(schema.profiles.id, profile.id));
  await assignUsername(user, r.values.resumeText, String(formData.get("timezone") || ""));

  track(user.id, "resume_uploaded", { replacing });
  if (replacing) {
    revalidatePath("/app", "layout");
    return;
  }
  revalidatePath(`/profiles/${profileId}/setup`);
}

export async function loadSampleResume(profileId: string) {
  if (mindsMode !== "mock") return;
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.status !== "needs_resume" && profile.status !== "draft") return;
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
  await assignUsername(user, SAMPLE_RESUME);
  revalidatePath(`/profiles/${profileId}/setup`);
}

export async function savePreferences(profileId: string, input: Preferences): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: "Some answers are missing. Please check each step." };
  const prefs = parsed.data;

  try {
    if (profile.status === "hunting" || profile.status === "paused") {
      // Just save. Waking the Mind to re-brief it would cost cognition for nothing: the next
      // search request carries the new brief (see requestSearch), one message, one wake.
      await db
        .update(schema.profiles)
        .set({ preferences: prefs, prefsChangedAt: new Date() })
        .where(eq(schema.profiles.id, profile.id));
      revalidatePath("/app", "layout");
      return;
    }
  } catch (e) {
    return { error: friendly(e) };
  }

  // During setup, saving the answers also deploys the headhunter: one step, not two.
  if (!profile.resumeData) return { error: "Upload your resume first." };
  // The sidebar label comes from the first role named, unless the person already chose one.
  const label = profile.label === PENDING_LABEL ? labelFromRoles(prefs.targetRoles) : profile.label;
  await db
    .update(schema.profiles)
    .set({ preferences: prefs, status: "needs_topup", label })
    .where(eq(schema.profiles.id, profile.id));
  const r = await launchMind(profileId);
  if (r?.error) return { error: r.error };
  if (r?.started) redirect(r.searching ? `/app?profile=${profileId}&welcome=1` : `/app?profile=${profileId}`);
  // Deployed, but its free cognition hasn't landed yet: the setup page waits for it.
  redirect(`/profiles/${profileId}/setup`);
}

export async function setPaused(profileId: string, paused: boolean) {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  // Resuming doesn't switch the Mind on: it only wakes for a search the user asks for.
  if (paused && profile.mindId) await minds(user).setEnabled(profile.mindId, false);
  await db
    .update(schema.profiles)
    .set({ status: paused ? "paused" : "hunting", ...(paused && isSearching(profile) ? { searchEndedAt: new Date() } : {}) })
    .where(eq(schema.profiles.id, profile.id));
  revalidatePath("/app", "layout");
}

// ---------- Searches (only when the user asks) ----------

export async function requestSearch(profileId: string, jobs: number, focus = ""): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const wanted = Math.round(Math.min(MAX_JOBS_PER_SEARCH, Math.max(MIN_JOBS_PER_SEARCH, Number(jobs) || RECOMMENDED_JOBS_PER_SEARCH)));
  const note = String(focus).replace(/\s+/g, " ").trim().slice(0, 200);
  if (profile.status === "paused") return { error: "This headhunter is paused. Resume it first." };
  if (profile.status !== "hunting" || !profile.mindId || !profile.conversationAlias) return { error: "Finish setting up this headhunter first." };
  if (isSearching(profile)) return;
  if (mindsMode === "live" && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(mindsConfig.ingestUrl)) {
    return { error: "Your headhunter can't reach this computer. Set INGEST_URL to your tunnel address (npm run tunnel)." };
  }
  if (mindsMode === "live" && !(await ingestReachable())) {
    return { error: `Your headhunter couldn't reach ${mindsConfig.ingestUrl}, so it wasn't started. If you're running locally, check the tunnel is up.` };
  }
  const api = minds(user);
  try {
    const balance = await api.getBalance(profile.mindId);
    if (balance <= 0) return { error: "Your headhunter is out of cognition. Top it up on Hello Minds, then try again." };
    const { perJob } = await costModel(profile.id);
    const need = estimateSearchCost(wanted, perJob).cognition;
    if (need > balance) {
      return { error: `That search needs roughly ${need} cognition and ${Math.round(balance)} is left. Pick fewer jobs or top up.` };
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.ingestLog)
      .where(eq(schema.ingestLog.profileId, profile.id));
    // The chosen number becomes this search's quota (checked at ingest) and the next default.
    await db
      .update(schema.profiles)
      .set({
        searchStartedAt: new Date(),
        searchEndedAt: null,
        ...(profile.preferences ? { preferences: { ...profile.preferences, jobsPerDay: wanted } } : {}),
      })
      .where(eq(schema.profiles.id, profile.id));
    await db.insert(schema.searches).values({ profileId: profile.id, jobsWanted: wanted, focus: note || null, balanceStart: balance });
    track(user.id, "search_requested", { jobs: wanted, search_number: n + 1 });
    await api.setEnabled(profile.mindId, true);
    // Anything changed since the Mind last heard from us goes in this same message: a new brief
    // after the request, a new resume as an attachment. One message, one wake.
    const synced = profile.briefedAt?.getTime() ?? 0;
    const newBrief = !!profile.preferences && (profile.prefsChangedAt?.getTime() ?? 0) > synced;
    const newResume = (profile.resumeChangedAt?.getTime() ?? 0) > synced && !!profile.resumeData;
    const notes = [
      newBrief ? `my brief changed; the full new brief is below and replaces the one from ${profile.briefedAt?.toISOString().slice(0, 10) ?? "before"} in full` : "",
      newResume ? `my resume changed; the new file is attached (see the first line above)` : "",
    ].filter(Boolean);
    const changes =
      (notes.length ? `\n\nCHANGES SINCE LAST TIME, read before you start: ${notes.join(". ")}.` : "") +
      (newBrief
        ? "\n\n---\n\n" +
          buildBrief({
            ownerName: user.username!,
            profileLabel: profile.label,
            prefs: { ...profile.preferences!, jobsPerDay: wanted },
            timezone: user.timezone ?? "UTC",
            appUrl: mindsConfig.ingestUrl,
            ingestKey: "(the same key as before)",
            resumeAttached: newResume,
            facts: factsText(user),
          })
        : "");
    await api.sendMessage(
      profile.conversationAlias,
      searchRequestText(
        user.username!,
        wanted,
        n + 1,
        note || undefined,
        await alreadySentList(user.id),
        profile.preferences ? { targetRoles: profile.preferences.targetRoles, country: profile.preferences.country, city: profile.preferences.city } : undefined,
        await ruledOutList(profile.id),
        profile.preferences ? postingAgeDays(profile.preferences) : undefined,
        newResume,
        newBrief ? "" : factsText(user), // a new brief below already carries it
      ) + changes,
      newResume ? [resumeAttachment(profile)] : undefined,
    );
    // The Mind is now up to date with everything saved before this moment.
    if (newBrief || newResume) await db.update(schema.profiles).set({ briefedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  } catch (e) {
    await db.update(schema.profiles).set({ searchEndedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
    return { error: friendly(e) };
  }
  revalidatePath("/app", "layout");
}

export async function stopSearch(profileId: string) {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  await endSearch(profile, "stopped");
  revalidatePath("/app", "layout");
}

// Renames the headhunter in the app. The Mind's own name on Hello Minds is permanent.
export async function renameProfile(profileId: string, label: string): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const clean = label.trim();
  if (clean.length < 2 || clean.length > 40) return { error: "Use 2 to 40 characters." };
  await db.update(schema.profiles).set({ label: clean }).where(eq(schema.profiles.id, profile.id));
  revalidatePath("/app", "layout");
}

// Turns the Mind off (Hello Minds has no delete) and removes the headhunter and its jobs.
export async function removeProfile(profileId: string) {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.mindId) await minds(user).setEnabled(profile.mindId, false).catch((e) => console.error(e));
  await db.delete(schema.profiles).where(eq(schema.profiles.id, profile.id));
  track(user.id, "headhunter_removed");
  redirect("/start");
}

// ---------- Jobs ----------

const STATUSES: JobStatus[] = ["new", "saved", "applied", "heard_back", "interview", "offer", "rejected", "skipped"];

export async function setJobStatus(jobId: string, status: JobStatus, skipReason?: string) {
  if (!STATUSES.includes(status)) return;
  const user = await requireUser();
  const { job } = await ownedJob(user, jobId);
  await db
    .update(schema.jobs)
    .set({ status, skipReason: status === "skipped" ? (skipReason ?? null) : null, statusChangedAt: new Date() })
    .where(eq(schema.jobs.id, jobId));
  // A swipe is a decision on a fresh card; later stage changes are tracked as moves.
  if (job.status === "new" && (status === "saved" || status === "skipped")) track(user.id, "card_decided", { decision: status === "saved" ? "apply" : "dismiss" });
  // Form questions only matter once the person wants the job: a swipe right (or a restore) queues
  // them on the You page. Jobs still face down or dismissed never reach "Needs you".
  if (status === "saved" && job.status !== "saved" && job.formQuestions?.length) {
    const pack = await db.query.packs.findFirst({ where: eq(schema.packs.jobId, jobId) });
    await queueQuestions(user.id, job.company, job.formQuestions, pack?.answers ?? []).catch((e) => console.error("[jobs] queue questions failed", jobId, e));
  }
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
  if (user.personalMindId) await minds(user).setEnabled(user.personalMindId, false).catch((e) => console.error(e));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await destroySession();
  redirect("/?deleted=1");
}
