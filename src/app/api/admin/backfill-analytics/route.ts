import { NextResponse } from "next/server";
import { isNotNull, ne, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { analyticsOn, track } from "@/lib/analytics/server";
import { requireUser } from "@/lib/session";

// One-off: replays the history already in the database into PostHog with the original
// timestamps, so the dashboards show the people who signed up before analytics existed.
// Owner only. Remove once run.
export async function GET() {
  const me = await requireUser();
  if (me.username !== "rovinc") return NextResponse.json({ error: "no" }, { status: 403 });
  if (!analyticsOn) return NextResponse.json({ error: "analytics off" }, { status: 503 });

  const users = await db.query.users.findMany();
  const profiles = await db.query.profiles.findMany();
  const owner = new Map(profiles.map((p) => [p.id, p.userId]));
  const searches = await db.query.searches.findMany();
  const jobs = await db.query.jobs.findMany({ where: and(ne(schema.jobs.status, "new"), isNotNull(schema.jobs.statusChangedAt)) });

  const counts: Record<string, number> = {};
  const send = (uid: string | undefined, ev: Parameters<typeof track>[1], at: Date | null | undefined, props: Record<string, string | number | boolean | null | undefined> = {}) => {
    if (!uid || !at) return;
    track(uid, ev, { ...props, backfilled: true }, at);
    counts[ev] = (counts[ev] ?? 0) + 1;
  };

  for (const u of users) {
    send(u.id, "signed_in", u.createdAt, { new_user: true, username: u.username });
    if (u.personalMindId) send(u.id, "personal_mind_deployed", u.personalBriefedAt ?? u.createdAt, { mind: u.personalMindName });
  }
  for (const p of profiles) {
    send(p.userId, "username_saved", p.createdAt);
    if (p.resumeData) send(p.userId, "resume_uploaded", p.resumeChangedAt ?? p.createdAt, { replacing: false });
    if (p.mindId) send(p.userId, "headhunter_deployed", p.briefedAt ?? p.createdAt, { mind: p.mindName });
  }
  for (const s of searches) {
    const uid = owner.get(s.profileId);
    send(uid, "search_requested", s.startedAt, { jobs: s.jobsWanted });
    if (s.endedAt) {
      const n = s.jobsAdded ?? 0;
      send(uid, "search_finished", s.endedAt, {
        reason: s.endReason,
        jobs_found: n,
        jobs_wanted: s.jobsWanted,
        cognition_used: s.cognitionUsed,
        cognition_per_job: s.cognitionUsed != null && n > 0 ? Math.round(s.cognitionUsed / n) : null,
        balance_after: s.balanceEnd,
        minutes: Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000),
      });
    }
  }
  for (const j of jobs) send(owner.get(j.profileId), "card_decided", j.statusChangedAt, { decision: j.status === "skipped" ? "dismiss" : "apply" });

  return NextResponse.json({ ok: true, counts });
}
