import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { track } from "./analytics/server";
import { sendComebackEmail, sendSetupReminderEmail, sendWeeklyDigestEmail, sendWeeklySummaryEmail, sendWelcomeEmail, unsubscribeLink } from "./email";
import { mindsConfig } from "./minds/config";
import { poolFor } from "./pool";
import { gapsOf } from "./match";

// Emails the app sends on its own, from the daily cron. Each kind goes to a person at most once
// per window, recorded in `notices`. Only people with a verified email and updates on.

const DAY = 86_400_000;
const base = () => mindsConfig.appUrl;

async function sentRecently(userId: string, kind: string, withinMs: number) {
  const row = await db.query.notices.findFirst({ where: and(eq(schema.notices.userId, userId), eq(schema.notices.kind, kind), gte(schema.notices.sentAt, new Date(Date.now() - withinMs))), columns: { id: true } });
  return !!row;
}

// Signed in one to seven days ago, never ran a search, has an email: one reminder.
export async function sendSetupReminders(limit = 100): Promise<number> {
  const people = await db.query.users.findMany({
    where: and(isNotNull(schema.users.email), isNotNull(schema.users.emailVerifiedAt), eq(schema.users.emailOnSearchDone, true), lt(schema.users.createdAt, new Date(Date.now() - DAY)), gte(schema.users.createdAt, new Date(Date.now() - 7 * DAY))),
    columns: { id: true, email: true },
    limit,
  });
  let n = 0;
  for (const u of people) {
    const searched = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.searches)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.searches.profileId))
      .where(eq(schema.profiles.userId, u.id));
    if (searched[0]?.n) continue;
    if (await sentRecently(u.id, "setup_reminder", 30 * DAY)) continue;
    try {
      await sendSetupReminderEmail({ to: u.email!, link: `${base()}/start`, unsubscribe: unsubscribeLink(u.id) });
      await db.insert(schema.notices).values({ userId: u.id, kind: "setup_reminder" });
      track(u.id, "setup_reminder_sent", {});
      n++;
    } catch (e) {
      console.error("[notices] setup reminder failed", u.id, e);
    }
  }
  return n;
}

// Monday: for every hunting headhunter whose person has an email, up to five fresh postings
// that fit the role and place, once a week. Nothing goes out when fewer than two are found.
export async function sendWeeklyDigests(now = new Date(), limit = 200, skipUsers: Set<string> = new Set()): Promise<number> {
  if (now.getUTCDay() !== 1) return 0;
  const profiles = await db.query.profiles.findMany({ where: and(eq(schema.profiles.status, "hunting"), isNotNull(schema.profiles.preferences)), orderBy: desc(schema.profiles.lastDeliveryAt), limit });
  let n = 0;
  for (const p of profiles) {
    if (skipUsers.has(p.userId)) continue;
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, p.userId), columns: { id: true, email: true, emailVerifiedAt: true, emailOnSearchDone: true } });
    if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) continue;
    if (await sentRecently(user.id, "weekly_digest", 6 * DAY)) continue;
    try {
      const rows = (await poolFor(p)).slice(0, 5);
      if (rows.length < 2) continue;
      const prefs = p.preferences!;
      await sendWeeklyDigestEmail({
        to: user.email,
        role: prefs.targetRoles.split(/,|\/| or /i)[0]?.trim() || p.label,
        place: prefs.city || prefs.country,
        postings: rows.map((r) => ({ title: r.title, company: r.company, matchScore: 0, place: [r.city, r.country].filter(Boolean).join(", ") || (r.workSetting === "remote" ? "Remote" : ""), verified: true })),
        link: `${base()}/app?profile=${p.id}`,
        unsubscribe: unsubscribeLink(user.id),
      });
      await db.insert(schema.notices).values({ userId: user.id, kind: "weekly_digest", meta: { profileId: p.id, postings: rows.length } });
      track(user.id, "weekly_digest_sent", { postings: rows.length });
      n++;
    } catch (e) {
      console.error("[notices] weekly digest failed", p.id, e);
    }
  }
  return n;
}

// The moment an email is verified for the first time: one welcome, ever.
export async function sendWelcome(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { id: true, email: true, emailVerifiedAt: true, emailOnSearchDone: true } });
  if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return false;
  const sent = await db.query.notices.findFirst({ where: and(eq(schema.notices.userId, userId), eq(schema.notices.kind, "welcome")), columns: { id: true } });
  if (sent) return false;
  try {
    await sendWelcomeEmail({ to: user.email, link: `${base()}/app`, unsubscribe: unsubscribeLink(userId) });
    await db.insert(schema.notices).values({ userId, kind: "welcome" });
    track(userId, "welcome_sent", {});
    return true;
  } catch (e) {
    console.error("[notices] welcome failed", userId, e);
    return false;
  }
}

const jobsOf = (p: typeof schema.jobs.$inferSelect) => ({ title: p.title, company: p.company, matchScore: p.matchScore, gaps: gapsOf(p.mustHaves), place: [p.workSetting === "remote" ? "Remote" : null, p.city, p.country].filter(Boolean).join(", "), verified: !!p.verifiedAt && !!p.locationText });

// Mondays, for people with daily search on: last week's numbers. People who get this are left
// out of the postings digest that day.
export async function sendWeeklySummaries(now = new Date(), limit = 300): Promise<Set<string>> {
  const done = new Set<string>();
  if (now.getUTCDay() !== 1) return done;
  const since = new Date(now.getTime() - 7 * DAY);
  const profiles = await db.query.profiles.findMany({ where: and(eq(schema.profiles.status, "hunting"), isNotNull(schema.profiles.autoSearchJobs)), limit });
  const byUser = new Map<string, typeof profiles>();
  for (const p of profiles) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);
  for (const [userId, mine] of byUser) {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { id: true, email: true, emailVerifiedAt: true, emailOnSearchDone: true } });
    if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) continue;
    if (await sentRecently(userId, "weekly_summary", 6 * DAY)) continue;
    const ids = mine.map((p) => p.id);
    const [{ searches }] = await db.select({ searches: sql<number>`count(*)::int` }).from(schema.searches).where(and(inArray(schema.searches.profileId, ids), gte(schema.searches.startedAt, since)));
    if (!searches) continue;
    const found = await db.query.jobs.findMany({ where: and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.demo, false), gte(schema.jobs.createdAt, since)), orderBy: desc(schema.jobs.matchScore) });
    const moved = await db.query.jobs.findMany({ where: and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.demo, false), gte(schema.jobs.statusChangedAt, since)), columns: { status: true } });
    const kept = moved.filter((j) => ["saved", "applied", "heard_back", "interview", "offer"].includes(j.status)).length;
    const applied = moved.filter((j) => ["applied", "heard_back", "interview", "offer"].includes(j.status)).length;
    try {
      await sendWeeklySummaryEmail({ to: user.email, searches, found: found.length, kept, applied, best: found[0] ? jobsOf(found[0]) : null, link: `${base()}/app`, unsubscribe: unsubscribeLink(userId) });
      await db.insert(schema.notices).values({ userId, kind: "weekly_summary", meta: { searches, found: found.length, kept, applied } });
      track(userId, "weekly_summary_sent", { searches, found: found.length, kept, applied });
      done.add(userId);
    } catch (e) {
      console.error("[notices] weekly summary failed", userId, e);
    }
  }
  return done;
}

// Two quiet weeks (no search they started, no card decided), account older than two weeks:
// one come-back email, ever.
const QUIET_DAYS = 14;
export async function sendComebacks(now = new Date(), limit = 300): Promise<number> {
  const cutoff = new Date(now.getTime() - QUIET_DAYS * DAY);
  const people = await db.query.users.findMany({
    where: and(isNotNull(schema.users.email), isNotNull(schema.users.emailVerifiedAt), eq(schema.users.emailOnSearchDone, true), lt(schema.users.createdAt, cutoff)),
    columns: { id: true, email: true },
    limit,
  });
  let n = 0;
  for (const u of people) {
    const sent = await db.query.notices.findFirst({ where: and(eq(schema.notices.userId, u.id), eq(schema.notices.kind, "comeback")), columns: { id: true } });
    if (sent) continue;
    const mine = await db.query.profiles.findMany({ where: and(eq(schema.profiles.userId, u.id), eq(schema.profiles.status, "hunting")), columns: { id: true, autoSearchJobs: true } });
    if (!mine.length) continue;
    const ids = mine.map((p) => p.id);
    const [{ own }] = await db.select({ own: sql<number>`count(*)::int` }).from(schema.searches).where(and(inArray(schema.searches.profileId, ids), gte(schema.searches.startedAt, cutoff), inArray(schema.searches.via, ["find", "setup"])));
    if (own) continue;
    const [{ decided }] = await db.select({ decided: sql<number>`count(*)::int` }).from(schema.jobs).where(and(inArray(schema.jobs.profileId, ids), gte(schema.jobs.statusChangedAt, cutoff)));
    if (decided) continue;
    // Something must have happened before: a person who never searched gets the setup reminder instead.
    const [{ ever }] = await db.select({ ever: sql<number>`count(*)::int` }).from(schema.searches).where(inArray(schema.searches.profileId, ids));
    if (!ever) continue;
    const waiting = await db.query.jobs.findMany({ where: and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "new"), eq(schema.jobs.demo, false)), orderBy: desc(schema.jobs.matchScore) });
    try {
      await sendComebackEmail({ to: u.email!, waiting: waiting.length, jobs: waiting.slice(0, 3).map(jobsOf), dailyOn: mine.some((p) => p.autoSearchJobs != null), link: `${base()}/app`, unsubscribe: unsubscribeLink(u.id) });
      await db.insert(schema.notices).values({ userId: u.id, kind: "comeback", meta: { waiting: waiting.length } });
      track(u.id, "comeback_sent", { waiting: waiting.length });
      n++;
    } catch (e) {
      console.error("[notices] comeback failed", u.id, e);
    }
  }
  return n;
}
