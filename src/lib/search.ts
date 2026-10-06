import "server-only";
import { and, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { sendSearchDoneEmail } from "./email";
import { minds } from "./minds/client";
import { SAME_ROLE_DAYS } from "./dedupe";
import { askPersonalMind } from "./personal";
import { mindsConfig } from "./minds/config";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
// Careful searches (opening every posting and its form) can run for several hours.
export const SEARCH_TIMEOUT_MS = 6 * 60 * 60 * 1000;

type SearchFields = Pick<Profile, "searchStartedAt" | "searchEndedAt">;

export function isSearching(p: SearchFields, now = Date.now()) {
  return !!p.searchStartedAt && !p.searchEndedAt && now - p.searchStartedAt.getTime() < SEARCH_TIMEOUT_MS;
}

// The user's recent jobs, so the Mind skips them instead of researching them again.
export async function alreadySentList(userId: string, limit = 80) {
  const rows = await db
    .select({ company: schema.jobs.company, title: schema.jobs.title })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.jobs.profileId, schema.profiles.id))
    .where(and(eq(schema.profiles.userId, userId), gte(schema.jobs.createdAt, new Date(Date.now() - SAME_ROLE_DAYS * 86_400_000))))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit);
  return rows.map((r) => `${r.company}: ${r.title}`);
}

export function searchRequestText(username: string, jobs: number, n: number, focus?: string, alreadySent: string[] = [], payFloor?: string) {
  const pay = payFloor
    ? `Pay floor: ${payFloor}. A posted range passes if its top reaches it; skip jobs whose whole posted range is below it; jobs without posted pay are fine. `
    : "";
  const skip = alreadySent.length
    ? `Skip these; I already have them (company: title): ${alreadySent.join("; ")}. `
    : "";
  return (
    `SEARCH REQUEST #${n} from ${username}. Use the copy of my resume you already saved; don't re-read the file (I'll tell you if it changes). Find up to ${jobs} jobs now, following every check in your brief, ` +
    `in the current format from GET ${mindsConfig.ingestUrl}/api/ingest?brief=1 (read it first; it may have new fields), ` +
    `and POST them to ${mindsConfig.ingestUrl}/api/ingest (use this address even if your brief says another; it can change). For each job, open its application form and list its questions in "formQuestions". ` +
    `Send each job AS SOON AS it passes every check, one job per POST is fine: I see it straight away and can start swiping while you keep searching. Don't hold jobs back for one big batch at the end. ` +
    `When you're done, POST {"jobs":[],"final":true} (or mark your last push "final": true). ` +
    pay +
    skip +
    (focus ? `For this search only, focus on: ${focus}. Every check in the brief still applies. ` : "") +
    `If you can't reach that address, reply once to say so, then stop: don't keep retrying or searching. ` +
    `Then stop and wait for my next request. (${new Date().toISOString()})`
  );
}

// Minds run on Hello Minds' servers, so the address they send results to must be public.
// Checked before waking a Mind: locally, a tunnel that has died would leave it retrying.
export async function ingestReachable() {
  try {
    const res = await fetch(`${mindsConfig.ingestUrl}/api/ingest`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Ends the active search, switches the Mind off and, unless the user stopped it
// themselves, emails them what it found. Only the first call for a search does anything.
export async function endSearch(profile: Profile, reason: "finished" | "stopped" | "timeout" = "finished") {
  const ended = await db
    .update(schema.profiles)
    .set({ searchEndedAt: new Date() })
    .where(and(eq(schema.profiles.id, profile.id), isNull(schema.profiles.searchEndedAt)))
    .returning({ id: schema.profiles.id });
  if (!ended.length) return;
  await switchOff(profile);
  await recordEnd(profile, reason).catch((e) => console.error("[search] record failed", profile.id, e));
  if (reason !== "stopped") await emailResults(profile, reason === "timeout").catch((e) => console.error("[search] email failed", profile.id, e));
  // The search's form questions go to the personal Mind in one batch.
  await askPersonalMind(profile.userId).catch((e) => console.error("[search] personal Mind not asked", profile.id, e));
}

// Closes the search's history row: when, why, jobs added and the balance after.
async function recordEnd(profile: Profile, reason: "finished" | "stopped" | "timeout") {
  const row = await db.query.searches.findFirst({
    where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)),
    orderBy: desc(schema.searches.startedAt),
  });
  if (!row) return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, row.startedAt)));
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  const balanceEnd = user && profile.mindId ? await minds(user).getBalance(profile.mindId).catch(() => null) : null;
  await db
    .update(schema.searches)
    .set({ endedAt: new Date(), endReason: reason, jobsAdded: n, balanceEnd })
    .where(eq(schema.searches.id, row.id));
}

async function emailResults(profile: Profile, timedOut: boolean) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return;
  const since = profile.searchStartedAt ?? new Date(Date.now() - SEARCH_TIMEOUT_MS);
  const jobs = await db.query.jobs.findMany({
    where: and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, since), inArray(schema.jobs.status, ["new", "saved"])),
    orderBy: desc(schema.jobs.matchScore),
  });
  await sendSearchDoneEmail({
    to: user.email,
    mindName: profile.mindName ?? "Your headhunter",
    label: profile.label,
    timedOut,
    link: `${mindsConfig.appUrl}/app?profile=${profile.id}`,
    jobs: jobs.map((j) => ({
      title: j.title,
      company: j.company,
      matchScore: j.matchScore,
      place: [j.workSetting === "remote" ? "Remote" : null, j.city, j.country].filter(Boolean).join(", "),
      verified: !!j.verifiedAt && !!j.locationText,
    })),
  });
}

export async function switchOff(profile: Profile) {
  if (!profile.mindId) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  await minds(user)
    .setEnabled(profile.mindId, false)
    .catch((e) => console.error("[search] couldn't switch the Mind off", profile.id, e));
}
