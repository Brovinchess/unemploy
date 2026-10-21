import "server-only";
import { and, count, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { track } from "./analytics/server";
import { BRIEF_VERSION, buildBrief } from "./brief";
import { costModel } from "./cost";
import { factsText } from "./facts";
import { LoginExpiredError, minds, type Attachment } from "./minds/client";
import { mindsConfig, mindsMode } from "./minds/config";
import { localEmployers } from "./pool";
import { estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, postingAgeDays, RECOMMENDED_JOBS_PER_SEARCH } from "./preferences";
import { blockedHosts, ingestReachable, isSearching, lastSearchLine, RESUME_TEXT_MAX, searchRequestText, skipLinks } from "./search";

export type SearchStart = { error?: string } | undefined;

export function friendly(e: unknown): string {
  if (e instanceof LoginExpiredError) return "Your Hello Minds login has expired. Sign out from Settings and sign in again.";
  console.error(e);
  return "Hello Minds didn't respond. Please try again in a minute.";
}

export function resumeAttachment(p: Pick<Profile, "resumeFileName" | "resumeMime" | "resumeData">): Attachment {
  return {
    fileName: p.resumeFileName!,
    mimeType: p.resumeMime!,
    extension: p.resumeFileName!.split(".").pop()!.toLowerCase(),
    content: p.resumeData!,
  };
}

// Starts a search for a headhunter: claims the search row, wakes the Mind, sends the request
// (with the full brief or a new resume when they changed). The person's own "Find new jobs"
// and the admin's re-run both come through here.
// `fitToBalance` (admin re-runs): when the asked-for size costs more than the Mind has, shrink
// the search to what the balance covers, two jobs at least, instead of refusing. The person's
// own default size is left as it was.
export async function startSearch(user: User, profile: Profile, jobs: number, focus = "", fitToBalance = false): Promise<SearchStart> {
  let wanted = Math.round(Math.min(MAX_JOBS_PER_SEARCH, Math.max(MIN_JOBS_PER_SEARCH, Number(jobs) || RECOMMENDED_JOBS_PER_SEARCH)));
  let fitted = false;
  const note = String(focus).replace(/\s+/g, " ").trim().slice(0, 200);
  if (profile.status === "paused") return { error: "This headhunter is paused. Resume it first." };
  if (profile.status !== "hunting" || !profile.mindId || !profile.conversationAlias) return { error: "Finish setting up this headhunter first." };
  if (isSearching(profile)) return;
  if (mindsMode === "live" && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(mindsConfig.ingestUrl)) {
    return { error: "Your headhunter can't reach this computer from the internet, so it wasn't started. (Local setup: INGEST_URL must be a public address.)" };
  }
  if (mindsMode === "live" && !(await ingestReachable())) {
    return { error: "Your headhunter couldn't reach Career Ninja just now, so the search wasn't started. Try again in a minute." };
  }
  const api = minds(user);
  try {
    const balance = await api.getBalance(profile.mindId);
    if (balance <= 0) return { error: "Your headhunter is out of cognition. Top it up on Hello Minds, then try again." };
    const { perJob } = await costModel(profile.id);
    const extra = profile.preferences?.extraPlaces?.length ?? 0;
    let need = estimateSearchCost(wanted, perJob, extra).cognition;
    if (need > balance && fitToBalance) {
      const fits = Math.floor((balance - estimateSearchCost(0, perJob, extra).cognition) / Math.max(1, perJob));
      if (fits >= 2) {
        wanted = Math.min(wanted, fits);
        need = estimateSearchCost(wanted, perJob, extra).cognition;
        fitted = true;
      }
    }
    if (need > balance) {
      return { error: `That search needs roughly ${need} cognition and ${Math.round(balance)} is left. Pick fewer jobs or top up.` };
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.ingestLog)
      .where(eq(schema.ingestLog.profileId, profile.id));
    // The chosen number becomes this search's quota (checked at ingest) and the next default.
    // Conditional on no search being open: two clicks (two tabs, a retry) start one search, not two.
    const started = await db
      .update(schema.profiles)
      .set({
        searchStartedAt: new Date(),
        searchEndedAt: null,
        ...(profile.preferences && !fitted ? { preferences: { ...profile.preferences, jobsPerDay: wanted } } : {}),
      })
      .where(and(eq(schema.profiles.id, profile.id), or(isNull(schema.profiles.searchStartedAt), isNotNull(schema.profiles.searchEndedAt))))
      .returning({ id: schema.profiles.id });
    if (!started.length) return;
    await db.insert(schema.searches).values({ profileId: profile.id, jobsWanted: wanted, focus: note || null, balanceStart: balance });
    track(user.id, "search_requested", { jobs: wanted, search_number: n + 1 });
    await api.setEnabled(profile.mindId, true);
    // Anything changed since the Mind last heard from us goes in this same message: a new brief
    // after the request, a new resume as an attachment. One message, one wake.
    const synced = profile.briefedAt?.getTime() ?? 0;
    const newBrief = !!profile.preferences && ((profile.prefsChangedAt?.getTime() ?? 0) > synced || profile.briefVersion < BRIEF_VERSION);
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
            resumeAttached: newResume && !profile.resumeText,
            resumeInline: !!profile.resumeText,
            facts: factsText(user),
          })
        : "");
    await api.sendMessage(
      profile.conversationAlias,
      searchRequestText({
        username: user.username!,
        jobs: wanted,
        n: n + 1,
        focus: note || undefined,
        skip: await skipLinks(user.id, profile.id),
        blocked: await blockedHosts(profile.id),
        employers: profile.preferences ? await localEmployers(profile.preferences).catch(() => []) : [],
        lastTime: await lastSearchLine(profile.id),
        maxAgeDays: profile.preferences ? postingAgeDays(profile.preferences) : undefined,
        resumeChanged: newResume,
        facts: newBrief ? "" : factsText(user), // a new brief below already carries it
        resumeText: profile.resumeText?.slice(0, RESUME_TEXT_MAX) ?? "",
      }) + changes,
      // The resume travels as text inside the message (free to read). The file goes only when
      // there is no text for it, so a Mind that lost the resume can still read it.
      profile.resumeData && !profile.resumeText ? [resumeAttachment(profile)] : undefined,
    );
    // The Mind is now up to date with everything saved before this moment.
    if (newBrief || newResume) await db.update(schema.profiles).set({ briefedAt: new Date(), ...(newBrief ? { briefVersion: BRIEF_VERSION } : {}) }).where(eq(schema.profiles.id, profile.id));
  } catch (e) {
    // The request never reached the Mind: close what was opened so nothing shows "in progress".
    await db.update(schema.profiles).set({ searchEndedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
    await db.delete(schema.searches).where(and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)));
    return { error: friendly(e) };
  }
}
