"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { LEAVE_REASONS, type JobStatus, type LeaveReason, type Profile, type User } from "@/db/schema";
import { BRIEF_VERSION, buildBrief } from "@/lib/brief";
import { factsText } from "@/lib/facts";
import { hashKey, newIngestKey } from "@/lib/keys";
import { minds, MindsApiError } from "@/lib/minds/client";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { mockTopUp } from "@/lib/minds/mock";
import { ownedJob, ownedProfile } from "@/lib/owned";
import { queueQuestions } from "@/lib/personal";
import { track } from "@/lib/analytics/server";
import { guessName, parsePlace } from "@/lib/normalise";
import { GENERATED_PREFIX, quickResumeText, readQuickProfile, textToPdf } from "@/lib/quick-resume";
import { AUTO_SEARCH_DAYS, MAX_JOBS_PER_SEARCH, PENDING_LABEL, preferencesSchema, RECOMMENDED_JOBS_PER_SEARCH, type AutoSearchDaysValue, type Preferences } from "@/lib/preferences";
import { extractResumeText, MAX_RESUME_BYTES, resumeType } from "@/lib/resume";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { endSearch, isSearching, requestPacks, RESUME_TEXT_MAX, switchOff } from "@/lib/search";
import { destroySession, requireUser } from "@/lib/session";
import { friendly, resumeAttachment, startSearch } from "@/lib/start-search";
import { applyFix, type Fix } from "@/lib/outcome";

export type FormState = { error?: string } | undefined;


// ---------- Welcome ----------

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/, "Use 3 to 24 letters, numbers or dashes.");

// Fallback only: a person who somehow reaches the resume step without a name (an account from
// before the name step) gets one from the resume, or a short random handle.
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

// The name step: the first thing a new person types. The Mind is named after it. First names
// repeat, so a taken one gets a number (alex, alex2…) instead of a dead end; the summary shows it.
export async function saveUsername(username: string, timezone?: string): Promise<FormState & { username?: string }> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Free here and free on Hello Minds (Mind names are global there), so the preview is the
  // name the Mind really gets. If Hello Minds can't be reached, our own check still applies.
  const api = minds(user);
  const freeOnMinds = async (handle: string) => api.isNameAvailable(`${handle}-careerninja`.slice(0, 40)).catch(() => true);
  let name = parsed.data;
  for (let n = 2; n < 100; n++) {
    const taken = await db.query.users.findFirst({ where: eq(schema.users.username, name), columns: { id: true } });
    const ours = !taken || taken.id === user.id;
    if (ours && (taken?.id === user.id || (await freeOnMinds(name)))) break;
    name = `${parsed.data.slice(0, 24 - String(n).length)}${n}`;
  }
  await db
    .update(schema.users)
    .set({ username: name, ...(timezone ? { timezone: timezone.slice(0, 64) } : {}) })
    .where(eq(schema.users.id, user.id));
  track(user.id, "username_saved", { auto: false });
  revalidatePath("/profiles", "layout");
  return { username: name };
}

// Change the handle before the headhunter is deployed (its Mind is named after it).
export async function renameUsername(username: string): Promise<FormState & { username?: string }> {
  const user = await requireUser();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const deployed = await db.query.profiles.findFirst({ where: and(eq(schema.profiles.userId, user.id), isNotNull(schema.profiles.mindId)), columns: { id: true } });
  if (deployed) return { error: "Your headhunter already has this name." };
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
  // Claim the deploy first: two tabs pressing Deploy must not awaken two Minds. The claim is
  // a placeholder name that only this call knows; a second caller sees it and just waits.
  const claim = `pending-${crypto.randomUUID().slice(0, 8)}`;
  const claimed = await db
    .update(schema.profiles)
    .set({ mindName: claim })
    .where(and(eq(schema.profiles.id, profile.id), isNull(schema.profiles.mindId), or(isNull(schema.profiles.mindName), eq(schema.profiles.mindName, ""))))
    .returning({ id: schema.profiles.id });
  if (!claimed.length) return checkActivation(profileId, true);
  try {
    const name = await pickMindName(user);
    const mind = await minds(user)
      .awaken(mindsConfig.archetype, name)
      .catch(async (e) => {
        // Hello Minds sometimes refuses a name its own check called free (400, no reason given).
        // One retry with a different name before giving up.
        if (!(e instanceof MindsApiError) || e.status !== 400) throw e;
        console.error("[launch] awaken refused, retrying with another name", name, e.message);
        return minds(user).awaken(mindsConfig.archetype, `${name.slice(0, 33)}-${crypto.randomUUID().slice(0, 6)}`);
      });
    await db
      .update(schema.profiles)
      .set({ mindId: mind.mindId, mindName: mind.name, status: "needs_topup" })
      .where(eq(schema.profiles.id, profile.id));
    track(user.id, "headhunter_deployed", { mind: mind.name });
  } catch (e) {
    await db.update(schema.profiles).set({ mindName: null }).where(and(eq(schema.profiles.id, profile.id), eq(schema.profiles.mindName, claim)));
    if (e instanceof MindsApiError && e.status >= 400 && e.status < 500) {
      console.error("[launch] awaken refused twice", profile.id, e.message);
      track(user.id, "headhunter_deploy_failed", { status: e.status });
      return { error: "Hello Minds couldn't create your headhunter right now. This is a problem on their side, not with your answers. We've been told, and we'll email you as soon as it's fixed." };
    }
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
    const s = await requestSearch(profile.id, profile.preferences?.jobsPerDay ?? RECOMMENDED_JOBS_PER_SEARCH, "", "setup").catch((e) => {
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
    return { error: "Your headhunter can't reach this computer from the internet, so it wasn't started. (Local setup: INGEST_URL must be a public address.)" };
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
      resumeAttached: !profile.resumeText,
      resumeInline: !!profile.resumeText,
    }) + (profile.resumeText ? `\n\nMY RESUME, full text.\n${profile.resumeText.slice(0, RESUME_TEXT_MAX)}` : ""),
    profile.resumeText ? undefined : [resumeAttachment(profile)],
  );
  await db
    .update(schema.profiles)
    .set({ status: "hunting", briefedAt: new Date(), briefVersion: BRIEF_VERSION })
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

// No resume: a few blanks become a plain resume (text for the headhunter, PDF for forms).
export async function saveQuickProfile(profileId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (profile.status !== "needs_resume" && profile.status !== "draft") return { error: "This headhunter already has a resume." };
  const p = readQuickProfile(formData);
  const name = user.applicant ? `${user.applicant.firstName} ${user.applicant.lastName}`.trim() : (user.username ?? "Me").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const text = quickResumeText(p, name);
  await db
    .update(schema.profiles)
    .set({ resumeFileName: `${GENERATED_PREFIX} - ${name}.pdf`, resumeMime: "application/pdf", resumeData: textToPdf(text).toString("base64"), resumeText: text, status: "needs_preferences" })
    .where(eq(schema.profiles.id, profile.id));
  track(user.id, "resume_uploaded", { replacing: false, generated: true });
  redirect(`/profiles/${profileId}/setup?review=1`);
}

// The person's edits to the generated resume; the PDF is remade from them.
export async function saveReviewedResume(profileId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const text = String(formData.get("text") ?? "").replace(/\r/g, "").trim().slice(0, 6000);
  if (text.length < 20) return { error: "Keep at least a line or two, so your headhunter has something to go on." };
  // First line is the name, ALL-CAPS lines are headings: the PDF makes them bold.
  const marked = text
    .split("\n")
    .map((l, i) => (i === 0 ? `# ${l}` : /^[A-Z][A-Z ]{2,}$/.test(l.trim()) ? `## ${l.trim()}` : l))
    .join("\n");
  await db.update(schema.profiles).set({ resumeText: marked, resumeData: textToPdf(marked).toString("base64") }).where(eq(schema.profiles.id, profile.id));
  redirect(`/profiles/${profileId}/setup`);
}

export async function discardGeneratedResume(profileId: string) {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (!profile.resumeFileName?.startsWith(GENERATED_PREFIX) || profile.status === "hunting" || profile.status === "paused") return;
  await db.update(schema.profiles).set({ resumeFileName: null, resumeMime: null, resumeData: null, resumeText: null, status: "needs_resume" }).where(eq(schema.profiles.id, profile.id));
  redirect(`/profiles/${profileId}/setup`);
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

// One plain sentence naming the answer that needs fixing, instead of "something is missing".
const PREF_LABELS: Record<string, string> = {
  targetRoles: "job titles", country: "country", city: "city", workSettings: "work setting", remoteScope: "remote jobs from",
  jobTypes: "job type", levels: "level", avoidCompanies: "companies to avoid", jobsPerDay: "jobs per search", maxPostingAgeDays: "posted within", extraPlaces: "other places",
};
function preferencesError(issues: { path: PropertyKey[]; code: string }[]) {
  const first = issues[0];
  const field = String(first?.path?.[0] ?? "");
  if (field === "targetRoles" && first.code === "too_big") return "That's too many job titles. Tap Change next to Looking for and keep about 6 of the closest ones.";
  if (field === "avoidCompanies" && first.code === "too_big") return "The list of companies to avoid is too long. Tap Change next to it and shorten it.";
  const label = PREF_LABELS[field];
  return label ? `Please check your answer for ${label}. Tap Change next to it to fix it.` : "One of your answers needs a look. Please check each step.";
}

export async function savePreferences(profileId: string, input: Preferences): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: preferencesError(parsed.error.issues) };
  const place = parsePlace(parsed.data.country, parsed.data.city ?? "");
  const prefs = { ...parsed.data, country: place.country, city: place.city };

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

export async function setPaused(profileId: string, paused: boolean): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  try {
    // Pausing mid-search ends the search properly (history row closed, Mind switched off).
    // Resuming doesn't switch the Mind on: it only wakes for a search the user asks for.
    if (paused && isSearching(profile)) await endSearch(profile, "stopped");
    else if (paused && profile.mindId) await minds(user).setEnabled(profile.mindId, false);
  } catch (e) {
    return { error: friendly(e) };
  }
  await db.update(schema.profiles).set({ status: paused ? "paused" : "hunting" }).where(eq(schema.profiles.id, profile.id));
  revalidatePath("/app", "layout");
}

// Morning searches: how many jobs and on which days, or off. Starts on the next due morning at 9
// in the person's time zone.
export async function setMorningSearch(profileId: string, settings: { jobs: number; days: AutoSearchDaysValue } | null): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  if (settings && profile.status !== "hunting") return { error: "Finish setting up this headhunter first." };
  const jobs = settings ? Math.round(Math.min(MAX_JOBS_PER_SEARCH, Math.max(1, Number(settings.jobs) || 1))) : null;
  const days = settings && AUTO_SEARCH_DAYS.some((d) => d.value === settings.days) ? settings.days : "daily";
  await db
    .update(schema.profiles)
    .set(settings ? { autoSearchJobs: jobs, autoSearchDays: days, autoSearchPausedAt: null, autoSearchOffAt: null, autoSearchNoticedAt: profile.autoSearchNoticedAt ?? new Date() } : { autoSearchJobs: null, autoSearchPausedAt: null, autoSearchOffAt: new Date(), autoSearchNoticedAt: profile.autoSearchNoticedAt ?? new Date() })
    .where(eq(schema.profiles.id, profile.id));
  track(user.id, "morning_search_set", { jobs, days, on: jobs != null });
  revalidatePath("/app", "layout");
}

// The Jobs page notice that daily search is on: seen once, then gone.
export async function noticeDailySearch(profileId: string): Promise<void> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  await db.update(schema.profiles).set({ autoSearchNoticedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  revalidatePath("/app", "layout");
}

// ---------- Searches (only when the user asks) ----------

export async function requestSearch(profileId: string, jobs: number, focus = "", via: "find" | "setup" = "find"): Promise<FormState> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const r = await startSearch(user, profile, jobs, focus, { via });
  if (r?.error) return r;
  revalidatePath("/app", "layout");
}

// The two "changed my mind" moments: someone opened the delete or stop dialog and backed out.
export async function noteKept(what: "delete" | "stop" | "stop_asked") {
  const user = await requireUser();
  track(user.id, what === "delete" ? "delete_kept" : what === "stop" ? "search_stop_kept" : "search_stop_asked");
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
  // Keeping a job is what gets its application written. A job that already has a pack (older
  // flow) just queues its form questions on the You page; otherwise the headhunter is asked for
  // the pack, a few seconds later so several swipes in a row go out as one request.
  if (status === "saved" && job.status !== "saved") {
    const pack = await db.query.packs.findFirst({ where: eq(schema.packs.jobId, jobId) });
    if (pack) {
      if (job.formQuestions?.length) await queueQuestions(user.id, job.company, job.formQuestions, pack.answers).catch((e) => console.error("[jobs] queue questions failed", jobId, e));
    } else {
      after(async () => {
        await new Promise((r) => setTimeout(r, 8000));
        await requestPacks(job.profileId).catch((e) => console.error("[jobs] pack request failed", jobId, e));
      });
    }
  }
  revalidatePath("/app", "layout");
}

// ---------- Account ----------

export async function deleteAccount(reason: LeaveReason, details = "") {
  const user = await requireUser();
  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
  // Why they left, kept after the account is gone: no user id, no name, no email.
  const why: LeaveReason = (LEAVE_REASONS as readonly string[]).includes(reason) ? reason : "other";
  const note = String(details ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  try {
    const ids = profiles.map((p) => p.id);
    const [c] = ids.length
      ? await db
          .select({
            searches: sql<number>`(select count(*) from ${schema.searches} where ${schema.searches.profileId} in ${ids})`.mapWith(Number),
            jobs: sql<number>`count(*)`.mapWith(Number),
            kept: sql<number>`count(*) filter (where ${schema.jobs.status} not in ('new', 'skipped', 'expired'))`.mapWith(Number),
            applied: sql<number>`count(*) filter (where ${schema.jobs.status} in ('applied', 'heard_back', 'interview', 'offer'))`.mapWith(Number),
          })
          .from(schema.jobs)
          .where(inArray(schema.jobs.profileId, ids))
      : [{ searches: 0, jobs: 0, kept: 0, applied: 0 }];
    await db.insert(schema.accountDeletions).values({
      reason: why,
      details: note || null,
      joinedAt: user.createdAt,
      country: profiles.find((p) => p.preferences?.country)?.preferences?.country ?? null,
      searches: c.searches,
      jobs: c.jobs,
      kept: c.kept,
      applied: c.applied,
      balance: profiles.reduce<number | null>((a, p) => (p.balanceCache == null ? a : (a ?? 0) + p.balanceCache), null),
    });
  } catch (e) {
    console.error("[delete] could not record the reason", e);
  }
  track(user.id, "account_deleted", { reason: why, wrote_details: !!note });
  // Minds can't be deleted on Hello Minds; turning them off stops all spending.
  for (const p of profiles) {
    if (p.mindId) await minds(user).setEnabled(p.mindId, false).catch((e) => console.error(e));
  }
  if (user.personalMindId) await minds(user).setEnabled(user.personalMindId, false).catch((e) => console.error(e));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await destroySession();
  redirect("/?deleted=1");
}


// The one-button fix on the "last search came back short" card: a settings change applied on
// the spot. The next search carries the new brief, the same as any settings change.
export async function applyOutcomeFix(profileId: string, fix: Fix): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  const profile = await ownedProfile(user, profileId);
  const prefs = profile.preferences;
  if (!prefs) return { error: "Finish setting up this headhunter first." };
  const next = applyFix(prefs, fix);
  const parsed = preferencesSchema.safeParse(next);
  if (!parsed.success) return { error: "That change couldn't be saved." };
  await db.update(schema.profiles).set({ preferences: parsed.data, prefsChangedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  track(user.id, "outcome_fix_applied", { fix: fix.type });
  revalidatePath("/app", "layout");
}
