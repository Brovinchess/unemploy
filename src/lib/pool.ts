import "server-only";
import { and, desc, eq, gte, isNull, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { countryCodeOf } from "./normalise";
import { postingAgeDays } from "./preferences";
import { checkPosting, eligibilityProblem } from "./quality";
import { isPublicHttpUrl } from "./ingest";

// The shared pool, read by a Mind at the start of a search: postings any headhunter opened
// recently that are still open and could suit this person. It is a locator only. The Mind
// re-checks each one is open and judges fit itself; nothing here is pre-approved, and the
// text never mentions where the postings came from.
const POOL_DAYS = 60;
const MAX_ROWS = 30;

export async function poolFor(profile: Profile) {
  const prefs = profile.preferences;
  if (!prefs) return [];
  const since = new Date(Date.now() - POOL_DAYS * 86_400_000);
  const minPosted = new Date(Date.now() - postingAgeDays(prefs) * 86_400_000).toISOString().slice(0, 10);
  const code = countryCodeOf(prefs.country);

  // Everything this person has already been shown or had ruled out, so nothing comes back twice.
  const sentKeys = await db
    .select({ k: schema.jobs.postingKey })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.jobs.profileId, schema.profiles.id))
    .where(and(eq(schema.profiles.userId, profile.userId), sql`${schema.jobs.postingKey} is not null`));
  const ruledKeys = await db
    .select({ k: schema.leads.postingKey })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, profile.id), gte(schema.leads.createdAt, since), sql`${schema.leads.postingKey} is not null`));
  const skip = new Set([...sentKeys, ...ruledKeys].map((r) => r.k!).filter(Boolean));

  // Candidates: open, fresh, and either in the person's country or remote in a way that may
  // include them. The country filter is loose on purpose; the location line decides below.
  const candidates = await db
    .select({
      postingKey: schema.postings.postingKey,
      url: schema.postings.url,
      title: schema.postings.title,
      company: schema.postings.company,
      city: schema.postings.city,
      country: schema.postings.country,
      countryCode: schema.postings.countryCode,
      workSetting: schema.postings.workSetting,
      locationText: schema.postings.locationText,
      postedOn: schema.postings.postedOn,
      lastVerifiedOpenAt: schema.postings.lastVerifiedOpenAt,
    })
    .from(schema.postings)
    .where(
      and(
        isNull(schema.postings.closedAt),
        eq(schema.postings.demo, false),
        gte(schema.postings.lastSeenAt, since),
        or(isNull(schema.postings.postedOn), gte(schema.postings.postedOn, minPosted)),
        prefs.remoteScope === "country" && code
          ? eq(schema.postings.countryCode, code)
          : or(code ? eq(schema.postings.countryCode, code) : sql`false`, eq(schema.postings.workSetting, "remote"), isNull(schema.postings.countryCode)),
        skip.size ? notInArray(schema.postings.postingKey, [...skip].slice(0, 2000)) : undefined,
      ),
    )
    .orderBy(desc(schema.postings.lastVerifiedOpenAt), desc(schema.postings.lastSeenAt))
    .limit(MAX_ROWS * 3);

  // The location line is the real test, the same one ingest applies to a sent job.
  const fits = candidates.filter((p) => {
    if (skip.has(p.postingKey)) return false;
    if (code && p.countryCode === code) return true;
    if (!prefs.workSettings.includes("remote") && !prefs.workSettings.includes("hybrid")) return false;
    const line = p.locationText ?? [p.city, p.country].filter(Boolean).join(", ");
    return !!line && eligibilityProblem(line, prefs.country, prefs.city) === null;
  });
  return stillOpen(fits.slice(0, MAX_ROWS));
}

// Before the Mind sees the list, the app opens each link itself and drops the closed ones, so
// the Mind spends no time on dead pages. Postings verified open in the last 12 hours are
// trusted; the rest are checked a few at a time, with a short timeout each.
const FRESH_MS = 12 * 3_600_000;
const CHECK_MAX = 30;
const CHECK_WIDTH = 8;
async function stillOpen<T extends { postingKey: string; url: string; lastVerifiedOpenAt: Date | null }>(rows: T[]) {
  const now = Date.now();
  const stale = rows.filter((p) => !p.lastVerifiedOpenAt || now - p.lastVerifiedOpenAt.getTime() > FRESH_MS).slice(0, CHECK_MAX);
  const closed = new Set<string>();
  const queue = [...stale];
  await Promise.all(
    Array.from({ length: CHECK_WIDTH }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const state = await checkPosting(p.url, isPublicHttpUrl, 6000).catch(() => "unknown" as const);
        const at = new Date();
        if (state === "closed") {
          closed.add(p.postingKey);
          await db.update(schema.postings).set({ closedAt: at, lastCheckedAt: at }).where(eq(schema.postings.postingKey, p.postingKey)).catch(() => {});
        } else if (state === "open") {
          await db.update(schema.postings).set({ lastVerifiedOpenAt: at, lastCheckedAt: at }).where(eq(schema.postings.postingKey, p.postingKey)).catch(() => {});
        }
      }
    }),
  );
  return rows.filter((p) => !closed.has(p.postingKey));
}

export function poolText(rows: Awaited<ReturnType<typeof poolFor>>) {
  if (!rows.length) return "No postings to check first this time. Go straight to rung 1.";
  const line = (p: (typeof rows)[number]) =>
    [p.title, p.company, [p.city, p.country].filter(Boolean).join(", ") || p.workSetting || "", p.postedOn ?? "", p.url].join(" | ");
  return [
    `${rows.length} postings seen open recently that may fit. Check these first, within your budget: open only the ones whose title fits my roles, confirm each is open today, judge fit against my resume and every check in the brief, and send the ones that pass before you search anywhere else. None is pre-approved.`,
    "title | company | place | posted | link",
    ...rows.map(line),
  ].join("\n");
}
