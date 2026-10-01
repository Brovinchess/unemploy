import "server-only";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { sendSearchDoneEmail } from "./email";
import { minds } from "./minds/client";
import { mindsConfig } from "./minds/config";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
export const SEARCH_TIMEOUT_MS = 3 * 60 * 60 * 1000;

type SearchFields = Pick<Profile, "searchStartedAt" | "searchEndedAt">;

export function isSearching(p: SearchFields, now = Date.now()) {
  return !!p.searchStartedAt && !p.searchEndedAt && now - p.searchStartedAt.getTime() < SEARCH_TIMEOUT_MS;
}

export function searchRequestText(username: string, jobs: number, n: number, focus?: string) {
  return (
    `SEARCH REQUEST #${n} from ${username}. Find up to ${jobs} jobs now, following every check in your brief, ` +
    `in the current format from GET ${mindsConfig.ingestUrl}/api/ingest?brief=1 (read it first; it may have new fields), ` +
    `and POST them. Mark your last push with "final": true (if you found none, POST {"jobs":[],"final":true}). ` +
    (focus ? `For this search only, focus on: ${focus}. Every check in the brief still applies. ` : "") +
    `Then stop and wait for my next request. (${new Date().toISOString()})`
  );
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
  if (reason !== "stopped") await emailResults(profile, reason === "timeout").catch((e) => console.error("[search] email failed", profile.id, e));
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
