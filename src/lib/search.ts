import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { minds } from "./minds/client";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
export const SEARCH_TIMEOUT_MS = 3 * 60 * 60 * 1000;

type SearchFields = Pick<Profile, "searchStartedAt" | "searchEndedAt">;

export function isSearching(p: SearchFields, now = Date.now()) {
  return !!p.searchStartedAt && !p.searchEndedAt && now - p.searchStartedAt.getTime() < SEARCH_TIMEOUT_MS;
}

export function searchRequestText(username: string, jobs: number, n: number) {
  return (
    `SEARCH REQUEST #${n} from ${username}. Find up to ${jobs} jobs now, following every check in your brief, ` +
    `and POST them. Mark your last push with "final": true (if you found none, POST {"jobs":[],"final":true}). ` +
    `Then stop and wait for my next request. (${new Date().toISOString()})`
  );
}

// Ends the active search and switches the Mind off. Safe to call twice.
export async function endSearch(profile: Profile) {
  await db.update(schema.profiles).set({ searchEndedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  await switchOff(profile);
}

export async function switchOff(profile: Profile) {
  if (!profile.mindId) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  await minds(user)
    .setEnabled(profile.mindId, false)
    .catch((e) => console.error("[search] couldn't switch the Mind off", profile.id, e));
}
