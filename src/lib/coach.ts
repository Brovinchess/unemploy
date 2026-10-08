import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DropReason, Profile } from "@/db/schema";
import { postingAgeDays } from "./preferences";

// The search coach: how fast the last search was (minutes per delivered job) and, when it
// was slow, what to change. Plain rules over data the app already has: the drop reasons the
// headhunter reported, the search's timing, and the preferences.

export const TARGET_MIN_PER_JOB = 15;

export type Pace = {
  searchId: string;
  startedAt: Date;
  endedAt: Date | null;
  jobs: number;
  minutes: number; // from start to the last job (or to the end, when nothing came)
  perJob: number | null; // minutes per delivered job
  arrivals: number[]; // minutes after start at which each job arrived
  tooSlow: boolean;
  wanted: number;
  endReason: string | null;
};

export async function searchPace(profileId: string): Promise<Pace | null> {
  const s = await db.query.searches.findFirst({ where: and(eq(schema.searches.profileId, profileId)), orderBy: desc(schema.searches.startedAt) });
  if (!s || !s.endedAt) return null;
  const jobs = await db
    .select({ at: schema.jobs.createdAt })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profileId), gte(schema.jobs.createdAt, s.startedAt), lte(schema.jobs.createdAt, s.endedAt)))
    .orderBy(schema.jobs.createdAt);
  const arrivals = jobs.map((j) => Math.round((j.at.getTime() - s.startedAt.getTime()) / 60_000));
  const last = arrivals.length ? arrivals[arrivals.length - 1] : Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000);
  const perJob = arrivals.length ? Math.round(last / arrivals.length) : null;
  // Too slow: over the target per job, or nothing found in more than one target's worth of time.
  const tooSlow = perJob != null ? perJob > TARGET_MIN_PER_JOB : last > TARGET_MIN_PER_JOB;
  return { searchId: s.id, startedAt: s.startedAt, endedAt: s.endedAt, jobs: arrivals.length, minutes: last, perJob, arrivals, tooSlow, wanted: s.jobsWanted, endReason: s.endReason };
}

export type Suggestion = { kind: "settings" | "resume" | "where" | "fewer"; text: string; evidence: string };

// Short, plain tips. Each one names a change the person can make on the headhunter page,
// with one line on why, taken from what the last search dropped.
export async function coachSuggestions(profile: Profile, pace: Pace): Promise<Suggestion[]> {
  const prefs = profile.preferences;
  if (!prefs) return [];
  const drops = await db.query.leads.findMany({ where: and(eq(schema.leads.profileId, profile.id), gte(schema.leads.createdAt, pace.startedAt)) });
  const total = drops.length;
  const n = (r: DropReason) => drops.filter((d) => d.reason === r).length;
  const share = (r: DropReason) => (total ? n(r) / total : 0);
  const out: Suggestion[] = [];
  const city = prefs.city || prefs.country;
  const remoteOnly = prefs.workSettings.every((w) => w === "remote");
  const age = postingAgeDays(prefs);

  if (total && share("not_eligible") >= 0.4) {
    if (remoteOnly) out.push({ kind: "settings", text: `Add hybrid or on-site jobs in ${city}.`, evidence: `${n("not_eligible")} of ${total} jobs it found were remote but only for other countries.` });
    out.push({ kind: "where", text: `Add a focus like "companies with an office in ${prefs.country}".`, evidence: `Most remote jobs it found were for the US or Europe only.` });
  }
  if (total && share("too_old") >= 0.3 && age < 90) {
    const next = age < 60 ? 60 : 90;
    out.push({ kind: "settings", text: `Allow postings up to ${next} days old.`, evidence: `${n("too_old")} of ${total} jobs it found were just over ${age} days old.` });
  }
  if (total && share("pay") >= 0.3) out.push({ kind: "settings", text: `Lower your pay floor a little.`, evidence: `${n("pay")} of ${total} jobs it found paid under your floor.` });
  if (total && share("poor_fit") >= 0.3) {
    const notes = drops.filter((d) => d.reason === "poor_fit" && d.note).map((d) => d.note!).slice(0, 2);
    out.push({ kind: "resume", text: `Add missing skills to your resume and upload it again.`, evidence: notes.length ? `Jobs wanted: ${notes.join("; ")}.` : `${n("poor_fit")} of ${total} jobs it found asked for things your resume doesn't show.` });
  }
  if (pace.jobs < pace.wanted && pace.wanted > 5) out.push({ kind: "fewer", text: `Ask for 5 jobs instead of ${pace.wanted}.`, evidence: `It found ${pace.jobs} of ${pace.wanted}${pace.endReason === "timeout" ? " before time ran out" : ""}. Smaller searches finish faster.` });
  if (!out.length && pace.tooSlow) out.push({ kind: "where", text: `Add a focus, like an industry or a few companies you like.`, evidence: `A narrower search is quicker. This one took ${pace.perJob ?? pace.minutes} minutes per job.` });
  return out.slice(0, 3);
}
