import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { track } from "./analytics/server";
import { sendCardsWaitingEmail, sendMorningOffEmail, sendMorningZeroEmail, unsubscribeLink } from "./email";
import { mindsConfig, topUpUrlFor } from "./minds/config";
import { searchOutcome } from "./outcome";
import { isSearching } from "./search";
import { startSearch } from "./start-search";

// Daily search. A person sets how many jobs they want a day and on which days. Each local day,
// from midnight, the first hourly tick that finds no search yet that day starts one (so it
// usually runs just after midnight and the cards are waiting in the morning; turned on in the
// afternoon, it starts within the hour). When it falls short, one follow-up three hours after it
// ends, wider. A day with nothing gets one email with the change most likely to help.
// Everything here runs from the hourly cron and checks what already happened today, so a late
// or repeated tick never starts a second run.

const FOLLOW_UP_AFTER_MS = 3 * 60 * 60 * 1000;
// A new day's search never starts within this long of the last search ending, whoever started
// it: two searches an hour apart mostly find the same postings.
const MIN_GAP_MS = 3 * 60 * 60 * 1000;
const NOTICE_GRACE_MS = 24 * 60 * 60 * 1000;
const CARDS_WAIT_MS = 6 * 60 * 60 * 1000;
const CARDS_EMAIL_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// Time zone for a person: the one their browser reported at setup, else their country's main one.
const COUNTRY_TZ: Record<string, string> = {
  Malaysia: "Asia/Kuala_Lumpur", Singapore: "Asia/Singapore", Indonesia: "Asia/Jakarta", Thailand: "Asia/Bangkok", Philippines: "Asia/Manila", Vietnam: "Asia/Ho_Chi_Minh",
  "Hong Kong": "Asia/Hong_Kong", Taiwan: "Asia/Taipei", Japan: "Asia/Tokyo", "South Korea": "Asia/Seoul", China: "Asia/Shanghai", India: "Asia/Kolkata", Pakistan: "Asia/Karachi",
  Bangladesh: "Asia/Dhaka", "Sri Lanka": "Asia/Colombo", "United Arab Emirates": "Asia/Dubai", "Saudi Arabia": "Asia/Riyadh", Qatar: "Asia/Qatar", Israel: "Asia/Jerusalem", Turkey: "Europe/Istanbul",
  Egypt: "Africa/Cairo", Nigeria: "Africa/Lagos", Kenya: "Africa/Nairobi", "South Africa": "Africa/Johannesburg", "United Kingdom": "Europe/London", Ireland: "Europe/Dublin", Portugal: "Europe/Lisbon",
  Netherlands: "Europe/Amsterdam", Germany: "Europe/Berlin", France: "Europe/Paris", Spain: "Europe/Madrid", Italy: "Europe/Rome", Belgium: "Europe/Brussels", Switzerland: "Europe/Zurich", Austria: "Europe/Vienna",
  Poland: "Europe/Warsaw", Czechia: "Europe/Prague", Romania: "Europe/Bucharest", Sweden: "Europe/Stockholm", Denmark: "Europe/Copenhagen", Norway: "Europe/Oslo", Finland: "Europe/Helsinki", Greece: "Europe/Athens",
  Hungary: "Europe/Budapest", Ukraine: "Europe/Kyiv", Australia: "Australia/Sydney", "New Zealand": "Pacific/Auckland", "United States": "America/New_York", Canada: "America/Toronto", Mexico: "America/Mexico_City",
  Brazil: "America/Sao_Paulo", Argentina: "America/Argentina/Buenos_Aires", Chile: "America/Santiago", Colombia: "America/Bogota", Peru: "America/Lima",
};
export function timeZoneFor(user: Pick<User, "timezone">, prefs: { country: string } | null | undefined) {
  const tz = user.timezone?.trim();
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {}
  }
  return (prefs && COUNTRY_TZ[prefs.country]) || "UTC";
}
export const localHour = (tz: string, at: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(at));
// 0 Sunday to 6 Saturday, in the person's time zone.
export const localWeekday = (tz: string, at: Date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(at));
export const localDay = (tz: string, at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

type Auto = { profile: Profile; user: User; tz: string; hour: number; day: string };

// Everyone with morning searches on, with their local time.
async function people(now: Date): Promise<Auto[]> {
  const profiles = await db.query.profiles.findMany({ where: and(isNotNull(schema.profiles.autoSearchJobs), isNull(schema.profiles.autoSearchPausedAt), eq(schema.profiles.status, "hunting"), isNotNull(schema.profiles.preferences)) });
  const out: Auto[] = [];
  for (const profile of profiles) {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
    if (!user || !user.email || !user.emailVerifiedAt) continue; // no searching until the email is verified
    const tz = timeZoneFor(user, profile.preferences);
    out.push({ profile, user, tz, hour: localHour(tz, now), day: localDay(tz, now) });
  }
  return out;
}

// This person's searches that started today, their time, oldest first. All of them, however they
// started: a search the person ran themselves before 9 is the day's first search, so the morning
// one is not stacked on top of it (two searches an hour apart mostly find the same postings).
async function todays(a: Auto, now: Date) {
  const rows = await db.query.searches.findMany({
    where: and(eq(schema.searches.profileId, a.profile.id), gte(schema.searches.startedAt, new Date(now.getTime() - 36 * HOUR))),
    orderBy: desc(schema.searches.startedAt),
  });
  return rows.filter((r) => localDay(a.tz, r.startedAt) === a.day).reverse();
}

const outOfCognition = (error?: string) => !!error && /cognition/i.test(error);

// Whether this is one of the person's mornings: every day, weekdays, every other day (no
// automatic search the day before), or Mondays.
async function dueToday(a: Auto, now: Date) {
  const days = a.profile.autoSearchDays ?? "daily";
  const wd = localWeekday(a.tz, now);
  if (days === "weekdays") return wd >= 1 && wd <= 5;
  if (days === "weekly") return wd === 1;
  if (days === "alternate") {
    const yesterday = localDay(a.tz, new Date(now.getTime() - 24 * HOUR));
    const ran = await db.query.searches.findMany({
      where: and(eq(schema.searches.profileId, a.profile.id), eq(schema.searches.via, "morning"), gte(schema.searches.startedAt, new Date(now.getTime() - 60 * HOUR))),
      columns: { startedAt: true },
    });
    return !ran.some((r) => localDay(a.tz, r.startedAt) === yesterday);
  }
  return true;
}

// Starts the day's search for everyone who has none yet today (their day, from midnight).
export async function runMorningSearches(now = new Date()): Promise<number> {
  let n = 0;
  for (const a of await people(now)) {
    if (isSearching(a.profile)) continue;
    if (!(await dueToday(a, now))) continue;
    if ((await todays(a, now)).length) continue;
    const last = await db.query.searches.findFirst({ where: eq(schema.searches.profileId, a.profile.id), orderBy: desc(schema.searches.startedAt), columns: { startedAt: true, endedAt: true } });
    if (last?.endedAt && now.getTime() - last.endedAt.getTime() < MIN_GAP_MS) continue;
    // Daily search turned itself on with the first search. It does not spend again until the
    // person has seen the notice on the Jobs page, or a day has passed since that search.
    if (!a.profile.autoSearchNoticedAt && last && now.getTime() - last.startedAt.getTime() < NOTICE_GRACE_MS) continue;
    const r = await startSearch(a.user, a.profile, a.profile.autoSearchJobs!, "", { via: "morning" }).catch((e) => ({ error: String(e) }));
    if (r?.error) {
      if (outOfCognition(r.error)) await switchOffMorning(a, "balance");
      else console.error("[morning] start failed", a.profile.id, r.error);
      continue;
    }
    track(a.user.id, "morning_search_started", { jobs: a.profile.autoSearchJobs!, via: "morning" });
    n++;
  }
  return n;
}

// Three hours after the day's first search ended short, one more search for what is still missing.
export async function runFollowUps(now = new Date()): Promise<number> {
  let n = 0;
  for (const a of await people(now)) {
    if (isSearching(a.profile)) continue;
    const ran = await todays(a, now);
    // The day's first search, whoever started it.
    const morning = ran.find((r) => r.via !== "followup");
    if (!morning?.endedAt || ran.some((r) => r.via === "followup")) continue;
    if (morning.endReason === "stopped" || morning.endReason === "no_cognition") continue;
    const found = morning.jobsAdded ?? 0;
    if (found >= morning.jobsWanted) continue;
    if (now.getTime() - morning.endedAt.getTime() < FOLLOW_UP_AFTER_MS) continue;
    const r = await startSearch(a.user, a.profile, morning.jobsWanted - found, "", { via: "followup", followUp: { found, wanted: morning.jobsWanted } }).catch((e) => ({ error: String(e) }));
    if (r?.error) {
      if (outOfCognition(r.error)) await switchOffMorning(a, "balance");
      else console.error("[morning] follow-up failed", a.profile.id, r.error);
      continue;
    }
    track(a.user.id, "morning_search_started", { jobs: morning.jobsWanted - found, via: "followup" });
    n++;
  }
  return n;
}

// A day whose searches are over and found nothing: daily search pauses (the settings stay, one
// tap resumes) and one email says so with the change most likely to help. Judged after the
// follow-up has ended, since a first search that finds nothing always gets one unless the
// balance is out, and that case has its own email.
export async function pauseAfterDryDay(now = new Date()): Promise<number> {
  let n = 0;
  for (const a of await people(now)) {
    const { user, profile } = a;
    if (isSearching(profile)) continue;
    const ran = await todays(a, now);
    if (!ran.length || ran.some((r) => !r.endedAt)) continue;
    if (ran.reduce((s, r) => s + (r.jobsAdded ?? 0), 0) > 0) continue;
    if (!ran.some((r) => r.via === "followup")) continue;
    await db.update(schema.profiles).set({ autoSearchPausedAt: now }).where(eq(schema.profiles.id, profile.id));
    track(user.id, "morning_search_off", { reason: "dry_day" });
    n++;
    if (!user.email || !user.emailVerifiedAt || !user.emailOnSearchDone) continue;
    if (await sentToday(user.id, "morning_zero", a.day)) continue;
    const prefs = profile.preferences!;
    const outcome = await searchOutcome(profile, { topUpUrl: topUpUrlFor(profile.mindId) }).catch(() => null);
    const page = `${mindsConfig.appUrl}/app/headhunters/${profile.id}#morning`;
    const link = outcome?.button?.href ? (outcome.button.href.startsWith("http") ? outcome.button.href : `${mindsConfig.appUrl}${outcome.button.href}`) : page;
    try {
      await sendMorningZeroEmail({
        to: user.email,
        label: profile.label,
        role: prefs.targetRoles.split(/,|\/| or /i)[0]?.trim() || profile.label,
        place: prefs.city || prefs.country,
        headline: outcome?.headline ?? "Widen the search a little to give it more to work with.",
        body: outcome?.body ?? "Most days this means the postings it opened were not open to you, or asked for more than your resume shows. A second title, another place, or a fuller resume usually changes it.",
        cta: outcome?.button?.label ?? "Open your headhunter",
        link,
        unsubscribe: unsubscribeLink(user.id),
      });
      await db.insert(schema.notices).values({ userId: user.id, kind: "morning_zero", meta: { profileId: profile.id, day: a.day, kind: outcome?.kind ?? null } });
      track(user.id, "morning_zero_sent", { kind: outcome?.kind ?? null });
    } catch (e) {
      console.error("[morning] zero-day email failed", profile.id, e);
    }
  }
  return n;
}

async function sentToday(userId: string, kind: string, day: string) {
  const rows = await db.query.notices.findMany({ where: and(eq(schema.notices.userId, userId), eq(schema.notices.kind, kind), gte(schema.notices.sentAt, new Date(Date.now() - 36 * HOUR))), columns: { meta: true } });
  return rows.some((r) => (r.meta as { day?: string } | null)?.day === day);
}

// Morning searches switch off when the balance cannot cover one. One email says so.
export async function switchOffMorning(a: Pick<Auto, "profile" | "user">, reason: "balance") {
  await db.update(schema.profiles).set({ autoSearchJobs: null, autoSearchOffAt: new Date() }).where(eq(schema.profiles.id, a.profile.id));
  track(a.user.id, "morning_search_off", { reason });
  const { user, profile } = a;
  if (!user.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return;
  const recent = await db.query.notices.findFirst({ where: and(eq(schema.notices.userId, user.id), eq(schema.notices.kind, "morning_off"), gte(schema.notices.sentAt, new Date(Date.now() - 24 * HOUR))), columns: { id: true } });
  if (recent) return;
  try {
    await sendMorningOffEmail({ to: user.email, label: profile.label, topUp: topUpUrlFor(profile.mindId), unsubscribe: unsubscribeLink(user.id) });
    await db.insert(schema.notices).values({ userId: user.id, kind: "morning_off", meta: { profileId: profile.id, reason } });
  } catch (e) {
    console.error("[morning] off email failed", profile.id, e);
  }
}

// Cards nobody has swiped for six hours: one email, then quiet for three days. For everyone with
// email on, not only morning searchers; the cards wait the same way however the search started.
export async function sendCardsWaiting(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CARDS_WAIT_MS);
  const since = new Date(now.getTime() - 7 * 24 * HOUR);
  const waiting = await db
    .select({ userId: schema.profiles.userId, n: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.jobs.profileId))
    .where(and(eq(schema.jobs.status, "new"), eq(schema.jobs.demo, false), gte(schema.jobs.createdAt, since), lt(schema.jobs.createdAt, cutoff)))
    .groupBy(schema.profiles.userId);
  let n = 0;
  for (const w of waiting) {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, w.userId) });
    if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) continue;
    // They have been swiping lately: no need to say anything.
    const swiped = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.jobs.profileId))
      .where(and(eq(schema.profiles.userId, user.id), gte(schema.jobs.statusChangedAt, cutoff)));
    if (swiped[0]?.n) continue;
    const recent = await db.query.notices.findFirst({ where: and(eq(schema.notices.userId, user.id), eq(schema.notices.kind, "cards_waiting"), gte(schema.notices.sentAt, new Date(now.getTime() - CARDS_EMAIL_GAP_MS))), columns: { id: true } });
    if (recent) continue;
    const jobs = await db
      .select({ title: schema.jobs.title, company: schema.jobs.company, matchScore: schema.jobs.matchScore, city: schema.jobs.city, country: schema.jobs.country, workSetting: schema.jobs.workSetting, verifiedAt: schema.jobs.verifiedAt, locationText: schema.jobs.locationText })
      .from(schema.jobs)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.jobs.profileId))
      .where(and(eq(schema.profiles.userId, user.id), eq(schema.jobs.status, "new"), eq(schema.jobs.demo, false), gte(schema.jobs.createdAt, since)))
      .orderBy(desc(schema.jobs.matchScore))
      .limit(5);
    try {
      await sendCardsWaitingEmail({
        to: user.email,
        n: w.n,
        jobs: jobs.map((j) => ({ title: j.title, company: j.company, matchScore: j.matchScore, place: [j.workSetting === "remote" ? "Remote" : null, j.city, j.country].filter(Boolean).join(", "), verified: !!j.verifiedAt && !!j.locationText })),
        link: `${mindsConfig.appUrl}/app`,
        unsubscribe: unsubscribeLink(user.id),
      });
      await db.insert(schema.notices).values({ userId: user.id, kind: "cards_waiting", meta: { cards: w.n } });
      track(user.id, "cards_waiting_sent", { cards: w.n });
      n++;
    } catch (e) {
      console.error("[morning] cards email failed", user.id, e);
    }
  }
  return n;
}
