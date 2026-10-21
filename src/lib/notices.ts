import "server-only";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { track } from "./analytics/server";
import { sendSetupReminderEmail, sendWeeklyDigestEmail, unsubscribeLink } from "./email";
import { mindsConfig } from "./minds/config";
import { poolFor } from "./pool";

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
export async function sendWeeklyDigests(now = new Date(), limit = 200): Promise<number> {
  if (now.getUTCDay() !== 1) return 0;
  const profiles = await db.query.profiles.findMany({ where: and(eq(schema.profiles.status, "hunting"), isNotNull(schema.profiles.preferences)), orderBy: desc(schema.profiles.lastDeliveryAt), limit });
  let n = 0;
  for (const p of profiles) {
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
