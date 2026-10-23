import "server-only";
import { and, count, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, SearchOverrides, SearchVia, User } from "@/db/schema";
import { regionFor } from "./discovery";
import { track } from "./analytics/server";
import { BRIEF_VERSION, buildBrief } from "./brief";
import { costModel } from "./cost";
import { factsText } from "./facts";
import { rotateKey } from "./keys";
import { LoginExpiredError, minds, type Attachment } from "./minds/client";
import { mindsConfig, mindsMode } from "./minds/config";
import { localEmployers } from "./pool";
import { estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, postingAgeDays, RECOMMENDED_JOBS_PER_SEARCH, searchBudget, type Preferences } from "./preferences";
import { blockedHosts, ingestReachable, isSearching, lastSearchLine, RESUME_TEXT_MAX, searchRequestText, skipLinks } from "./search";

export type SearchStart = { error?: string } | undefined;

export const FIRST_SEARCH_EXTRA_COGNITION = 10;
const FIRST_BUDGET = { searches: 20, opened: 50 };

// Until a headhunter has delivered at least one job, every search runs wide.
export async function firstSearchOverrides(profileId: string, prefs: Preferences): Promise<SearchOverrides | null> {
  const found = await db.query.searches.findFirst({ where: and(eq(schema.searches.profileId, profileId), gt(schema.searches.jobsAdded, 0)), columns: { id: true } });
  if (found) return null;
  const remoteOn = prefs.workSettings.includes("remote") || prefs.workSettings.includes("hybrid");
  return {
    first: true,
    maxPostingAgeDays: Math.max(90, postingAgeDays(prefs)),
    ...(remoteOn && prefs.remoteScope === "country" ? { remoteScope: "region" as const } : {}),
    budget: FIRST_BUDGET,
  };
}

export function firstSearchLine(prefs: Preferences, o: SearchOverrides) {
  const bits = [`postings up to ${o.maxPostingAgeDays} days old`];
  if (o.remoteScope === "region") bits.push(`remote jobs open to people in ${regionFor(prefs.country)} as well as ${prefs.country} (treat this as an extra rung after the others)`);
  bits.push(`up to ${o.budget?.searches ?? 20} web searches`);
  return `This is my first search with you, so cast a wider net this once: ${bits.join("; ")}. My usual settings apply from the next search.`;
}

// The same day's second search, after the morning one fell short: the near rungs were covered
// hours ago, so it starts at the wider-title rung and, when remote or hybrid is on, may take
// remote jobs from the region this once.
export function followUpOverrides(prefs: Preferences, found: number, wanted: number): SearchOverrides {
  const remoteOn = prefs.workSettings.includes("remote") || prefs.workSettings.includes("hybrid");
  return {
    followUp: true,
    ...(remoteOn && prefs.remoteScope === "country" ? { remoteScope: "region" as const } : {}),
    budget: searchBudget(Math.max(1, wanted - found)),
  };
}

export function followUpLine(prefs: Preferences, o: SearchOverrides, found: number, wanted: number) {
  const region = o.remoteScope === "region" ? ` Remote jobs open to people in ${regionFor(prefs.country)} count this once, as a rung after the others.` : "";
  return `This is the second search today. This morning's search found ${found} of the ${wanted} I asked for and covered rungs 0 to 2, so skip rung 0 and the plain rung 1 and 2 searches; start at the wider-title rung with new search words (a synonym for the role, the next biggest city, "careers" plus an employer name), then the rungs after it.${region} My usual settings apply from tomorrow.`;
}

// Whether this search turns daily search on: the headhunter's first search, started by the
// person, with daily search neither on nor turned off before.
export function dailyByDefault(profile: Pick<Profile, "autoSearchJobs" | "autoSearchOffAt">, priorSearches: number, via: SearchVia) {
  return priorSearches === 0 && profile.autoSearchJobs == null && !profile.autoSearchOffAt && (via === "find" || via === "setup");
}

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
export type StartOptions = {
  fitToBalance?: boolean;
  via?: SearchVia;
  // A same-day follow-up: how the morning search did, so this one starts wider.
  followUp?: { found: number; wanted: number };
};
export async function startSearch(user: User, profile: Profile, jobs: number, focus = "", opts: StartOptions = {}): Promise<SearchStart> {
  const { fitToBalance = false, via = "find", followUp } = opts;
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
    // A headhunter that has never found a job casts a wider net the first time: older postings,
    // remote from the region, a bigger budget. The person's own settings return after a success.
    const first = profile.preferences ? await firstSearchOverrides(profile.id, profile.preferences) : null;
    const overrides: SearchOverrides | null = first ?? (followUp && profile.preferences ? followUpOverrides(profile.preferences, followUp.found, followUp.wanted) : null);
    let need = estimateSearchCost(wanted, perJob, extra).cognition + (first ? FIRST_SEARCH_EXTRA_COGNITION : 0);
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
    // The budget rides with every search, sized to the number asked for (the brief's own numbers are a fallback).
    const budget = overrides?.budget ?? searchBudget(wanted);
    const stored: SearchOverrides = { ...(overrides ?? {}), budget };
    // A morning search runs with its own number; it does not change the person's default.
    const fromPerson = via === "find" || via === "setup";
    const started = await db
      .update(schema.profiles)
      .set({
        searchStartedAt: new Date(),
        searchEndedAt: null,
        ...(profile.preferences && !fitted && fromPerson ? { preferences: { ...profile.preferences, jobsPerDay: wanted } } : {}),
      })
      .where(and(eq(schema.profiles.id, profile.id), or(isNull(schema.profiles.searchStartedAt), isNotNull(schema.profiles.searchEndedAt))))
      .returning({ id: schema.profiles.id });
    if (!started.length) return;
    // Daily search is on from the first search, sized like it, unless the person turned it off.
    const prior = await db.select({ n: count() }).from(schema.searches).where(eq(schema.searches.profileId, profile.id));
    const defaultOn = dailyByDefault(profile, prior[0]?.n ?? 0, via);
    await db.insert(schema.searches).values({ profileId: profile.id, jobsWanted: wanted, focus: note || null, balanceStart: balance, overrides: stored, via });
    if (defaultOn) {
      await db.update(schema.profiles).set({ autoSearchJobs: wanted, autoSearchDays: "daily", autoSearchPausedAt: null }).where(eq(schema.profiles.id, profile.id));
      track(user.id, "morning_search_set", { jobs: wanted, days: "daily", on: true, via: "default" });
    }
    track(user.id, "search_requested", { jobs: wanted, search_number: n + 1, via, fitted });
    await api.setEnabled(profile.mindId, true);
    // Anything changed since the Mind last heard from us goes in this same message: a new brief
    // after the request, a new resume as an attachment. One message, one wake.
    const synced = profile.briefedAt?.getTime() ?? 0;
    // The full brief rides with every request. A message costs the same at any length, and a
    // brief the Mind has to remember between searches is one it can half-forget. The note about
    // changes is kept for when settings actually changed.
    const changed = !!profile.preferences && ((profile.prefsChangedAt?.getTime() ?? 0) > synced || profile.briefVersion < BRIEF_VERSION);
    const newBrief = !!profile.preferences;
    const newResume = (profile.resumeChangedAt?.getTime() ?? 0) > synced && !!profile.resumeData;
    const notes = [
      changed ? `my brief changed; the full new brief is below and replaces the one from ${profile.briefedAt?.toISOString().slice(0, 10) ?? "before"} in full` : "",
      newBrief ? `the brief below is the complete one for this search, with a new key for the app; work from it, not from memory` : "",
      newResume ? `my resume changed; the new file is attached (see the first line above)` : "",
    ].filter(Boolean);
    // A re-brief carries a fresh key. Only a hash of the old one is kept, so it cannot be repeated,
    // and a Mind that has lost its key would otherwise be shut out for good (every push a 401).
    const ingestKey = newBrief ? await rotateKey(profile.id) : "";
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
            ingestKey,
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
        maxAgeDays: overrides?.maxPostingAgeDays ?? (profile.preferences ? postingAgeDays(profile.preferences) : undefined),
        budget,
        firstSearch: first ? firstSearchLine(profile.preferences!, first) : followUp && overrides ? followUpLine(profile.preferences!, overrides, followUp.found, followUp.wanted) : "",
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
