import "server-only";
import type { FeedbackKind } from "@/db/schema";
import { buildBrief } from "./brief";
import { factsText } from "./facts";
import { mindsConfig } from "./minds/config";
import { postingAgeDays } from "./preferences";
import { searchRequestText, usageByTool } from "./search";
import { minds } from "./minds/client";
import { COUNTRY_NAMES, countryCodeOf } from "./normalise";
import { and, asc, desc, eq, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { DropReason, JobStatus, ProfileStatus, QuestionStatus, SavedAnswer, ApplicantDetails } from "@/db/schema";
import type { Preferences } from "./preferences";
import { MAX_POSTING_AGE_DAYS, workSettingLabel } from "./preferences";
import { DROP_LABELS } from "./dropped";
import {
  APPLIED_PLUS_LIST,
  type Dir,
  KEPT,
  MIND_MISTAKES,
  PIPELINE,
  STAGE_ORDER,
  WAITING_QUESTION_LIST,
  dayKeys,
  daysAgo,
  mins,
  pushDetails,
  stageLabel,
  tally,
} from "./admin";

// All data access for the admin pages lives here. The rules, so the pooler never stalls again:
//   1. Aggregates (tiles, breakdowns, per-day series, funnel steps) are computed in SQL with
//      COUNT / SUM / GROUP BY / FILTER / date_trunc. Rows are never loaded just to be counted.
//   2. Every list query has a LIMIT (200, or the cap the page states) and applies its filters
//      and ORDER BY in SQL. Names are JOINed in (users.username, profiles.label), never looked
//      up from a preloaded directory.
//   3. One page render issues at most FOUR queries, run one after another, never Promise.all.
//   4. One exported async function per page or detail, returning a plain, fully typed object
//      with exactly what the page renders. Pages parse params, call one function, render.
//   5. Each exported function is wrapped in a 30 s in-memory memo keyed by its arguments
//      (10 s for the detail pages). See memo() below.
//
// Raw SQL (db.execute) comes back untyped: timestamps are selected as epoch milliseconds
// (ms()) and turned into Dates here; counts are cast ::int so they arrive as numbers.

// ---- memo ---------------------------------------------------------------------------------

const TTL = 30_000;
const DETAIL_TTL = 10_000;
const store = new Map<string, { at: number; value: Promise<unknown> }>();

// Returns the cached promise for `key` while it is younger than ttlMs; otherwise runs fn once
// and caches it (so concurrent renders share one set of queries). Failures are not cached.
export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  if (store.size > 500) for (const [k, v] of store) if (now - v.at >= TTL) store.delete(k);
  const value = fn().catch((e: unknown) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { at: now, value });
  return value;
}

// ---- SQL helpers -------------------------------------------------------------------------

type Raw = Record<string, unknown>;
async function rows<T extends Raw>(q: SQL): Promise<T[]> {
  return [...(await db.execute<T>(q))] as T[];
}
async function one<T extends Raw>(q: SQL): Promise<T> {
  return (await rows<T>(q))[0];
}

// A Date bound as a timestamptz literal (raw queries have no column to encode through).
const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;
// A timestamp as epoch milliseconds (float8), or null.
const ms = (col: SQL) => sql`(extract(epoch from ${col}) * 1000)::float8`;
const at = (v: unknown): Date | null => (typeof v === "number" ? new Date(v) : null);
// Calendar day in UTC, the key the charts use.
const dayOf = (col: SQL) => sql`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`;
// Whole minutes between two moments, at least one (the same rule as mins()).
const minutesBetween = (from: SQL, to: SQL) => sql`greatest(1, round(extract(epoch from (${to} - ${from})) / 60))::int`;
// Literal list of constant strings for IN (...).
const lit = (xs: Iterable<string>) => sql.raw([...xs].map((x) => `'${x}'`).join(", "));
// Literal text[] of constant strings for array_position.
const arr = (xs: readonly string[]) => sql.raw(`array[${xs.map((x) => `'${x}'`).join(", ")}]::text[]`);
// A contains-pattern for ILIKE, with the user's % and _ escaped.
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
// "username · label", or "?" when the headhunter is gone. Expects aliases p (profiles) and u (users).
const WHO = sql.raw(`case when p.id is null then '?' else coalesce(u.username, '(no name yet)') || ' · ' || p.label end`);
const NAME = sql.raw(`coalesce(u.username, '(no name yet)')`);
// ORDER BY one whitelisted expression; empty values always sink to the bottom.
function orderBy(map: Record<string, SQL>, key: string, dir: Dir, fallback: string) {
  const expr = map[key] ?? map[fallback];
  return sql`${expr} ${sql.raw(dir)} nulls last`;
}
// Case-insensitive text sort key; empty strings sort like NULL.
const text = (col: string) => sql.raw(`lower(nullif(${col}, ''))`);
// Per-day series: SQL gives (day, value) for days that had something; fill the rest with zero.
function fill(keys: string[], points: { key: string; v: number }[]) {
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map(() => 0);
  for (const p of points) {
    const i = idx.get(p.key);
    if (i != null) out[i] += p.v;
  }
  return out;
}
// [label, count][] sorted by count, as Counts expects.
const counts = (xs: { key: string; n: number }[]): [string, number][] => xs.map((x) => [x.key, x.n] as [string, number]).sort((a, b) => b[1] - a[1]);

type Facet = { kind: string; key: string; n: number; v: number };

// People type their country freely ("hong kong", "dubai- but I work remote only"): group by the
// country the normaliser recognises, keep the time-zone guesses, and pool the rest as Other.
function groupCountries(raw: { key: string; n: number }[]) {
  const out = new Map<string, number>();
  for (const r of raw) {
    const code = r.key.startsWith("Unknown") ? null : countryCodeOf(r.key);
    const name = code ? (COUNTRY_NAMES[code] ?? code) : r.key.startsWith("Unknown (") ? r.key.replace("Unknown (", "").replace(")", "") + " (from time zone)" : r.key === "Unknown" ? "Not set" : "Other";
    out.set(name, (out.get(name) ?? 0) + r.n);
  }
  return [...out].map(([key, n]) => ({ key, n }));
}

// ---- overview -----------------------------------------------------------------------------

const NOTICE_LABELS: Record<string, string> = {
  welcome: "Welcome", setup_reminder: "Setup reminder", weekly_digest: "Monday postings", weekly_summary: "Monday summary", morning_zero: "Daily search paused",
  morning_off: "Daily search stopped", cards_waiting: "Cards waiting", comeback: "Come back", key_rejected: "Key reissued",
};

export type Overview = {
  days: number;
  keys: string[];
  allTime: { users: number; emailVerified: number; deployed: number; live: number; searchingNow: number; jobs: number; appliedPlus: number; extensionUsers: number };
  window: {
    newUsers: number; referred: number; activeUsers: number; searches: number; openSearches: number; finished: number; finishedWithJobs: number; jobs: number; kept: number; leads: number; cognition: number; poolJobs: number;
    avgMinutes: number | null; firstJobMinutes: number | null; wanted: number; applied: number; interviews: number; emptySearches: number;
  };
  countries: [string, number][]; // accounts by the country they set, all time
  people: { id: string; username: string | null; country: string; searches: number; jobs: number; kept: number; avgMinutes: number | null; cognition: number }[];
  funnel: { label: string; count: number; href?: string }[];
  trend: { signups: number[]; searches: number[]; jobs: number[]; cognition: number[] };
  byStage: [string, number][];
  byReason: [string, number][];
  alerts: { label: string; count: number; href: string; hint?: string }[];
  recent: { id: string; startedAt: Date; who: string; userId?: string; jobsWanted: number; jobsAdded: number | null; cognitionUsed: number | null; open: boolean; endReason: string | null; minutes: number }[];
  // Daily search and the emails, for the push: who has it on, how the automatic runs do against
  // the ones people start, who is blocked by the email gate, and what went out.
  daily: { on: number; paused: number; turnedOff: number; runs: number; followUps: number; runsWanted: number; runsAdded: number; manual: number; manualWanted: number; manualAdded: number; runCog: number; manualCog: number; long: number };
  emails: { verified: number; blocked: number; sent: [string, number][] };
};

export const overview = (days: number) => memo(`overview:${days}`, TTL, () => loadOverview(days));

async function loadOverview(days: number): Promise<Overview> {
  const since = daysAgo(days);
  const now = daysAgo(0);
  const keys = dayKeys(days);

  // Query 1: every scalar on the page (all-time tiles, funnel steps, window tiles, alert
  // counts) as one row of subselects.
  type Scalars = {
    users: number; named: number; email_verified: number; deployed: number; live: number; searching_now: number; paused: number; jobs: number; applied_plus: number; extension_users: number;
    with_resume: number; with_prefs: number; with_mind: number; searched: number; got_job: number; kept: number; applied: number; never_searched: number; kept_nothing: number;
    new_users: number; referred: number; searches: number; open_searches: number; finished: number; finished_with_jobs: number; empty_searches: number; cognition: number; active_users: number; window_jobs: number; window_kept: number; leads: number; pool_jobs: number;
    avg_minutes: number | null; first_job_minutes: number | null; wanted: number; window_applied: number; window_interviews: number; feedback_new: number;
    stuck: number; stuck_hint: string | null; refused_24h: number; old_questions: number; old_question_people: number;
    daily_on: number; daily_paused: number; daily_off: number; runs: number; follow_ups: number; runs_wanted: number; runs_added: number; manual: number; manual_wanted: number; manual_added: number; run_cog: number; manual_cog: number; long_searches: number; email_blocked: number;
  };
  const s = await one<Scalars>(sql`
    select
      (select count(*) from users)::int as users,
      (select count(username) from users)::int as named,
      (select count(email_verified_at) from users)::int as email_verified,
      (select count(*) from profiles where mind_id is not null)::int as deployed,
      (select count(*) from profiles where status in ('hunting', 'paused'))::int as live,
      (select count(*) from profiles where search_started_at is not null and search_ended_at is null)::int as searching_now,
      (select count(*) from profiles where status = 'paused')::int as paused,
      (select count(*) from jobs)::int as jobs,
      (select count(*) from jobs where status in (${lit(APPLIED_PLUS_LIST)}))::int as applied_plus,
      (select count(distinct user_id) from extension_tokens)::int as extension_users,
      (select count(distinct user_id) from profiles where resume_file_name is not null)::int as with_resume,
      (select count(distinct user_id) from profiles where preferences is not null)::int as with_prefs,
      (select count(distinct user_id) from profiles where mind_id is not null)::int as with_mind,
      (select count(distinct p.user_id) from searches s join profiles p on p.id = s.profile_id)::int as searched,
      (select count(distinct p.user_id) from jobs j join profiles p on p.id = j.profile_id)::int as got_job,
      (select count(distinct p.user_id) from jobs j join profiles p on p.id = j.profile_id where j.status in (${lit(KEPT)}))::int as kept,
      (select count(distinct p.user_id) from jobs j join profiles p on p.id = j.profile_id where j.status in (${lit(APPLIED_PLUS_LIST)}))::int as applied,
      (select count(*) from (
        select user_id from profiles where mind_id is not null
        except select p.user_id from searches s join profiles p on p.id = s.profile_id) x)::int as never_searched,
      (select count(*) from (
        select p.user_id from searches s join profiles p on p.id = s.profile_id
        except select p.user_id from jobs j join profiles p on p.id = j.profile_id where j.status in (${lit(KEPT)})) x)::int as kept_nothing,
      (select count(*) from users where created_at >= ${ts(since)})::int as new_users,
      (select count(*) from users where created_at >= ${ts(since)} and nullif(referred_by, '') is not null)::int as referred,
      (select count(*) from searches where started_at >= ${ts(since)})::int as searches,
      (select count(*) from searches where started_at >= ${ts(since)} and ended_at is null)::int as open_searches,
      (select count(*) from searches where started_at >= ${ts(since)} and ended_at is not null)::int as finished,
      (select count(*) from searches where started_at >= ${ts(since)} and ended_at is not null and coalesce(jobs_added, 0) > 0)::int as finished_with_jobs,
      (select count(*) from searches where started_at >= ${ts(since)} and ended_at is not null and coalesce(jobs_added, 0) = 0)::int as empty_searches,
      (select coalesce(sum(cognition_used), 0) from searches where started_at >= ${ts(since)})::float8 as cognition,
      (select count(distinct p.user_id) from searches s join profiles p on p.id = s.profile_id where s.started_at >= ${ts(since)})::int as active_users,
      (select count(*) from jobs where created_at >= ${ts(since)})::int as window_jobs,
      (select count(*) from jobs where created_at >= ${ts(since)} and status in (${lit(KEPT)}))::int as window_kept,
      (select count(*) from leads where created_at >= ${ts(since)})::int as leads,
      (select count(*) from jobs where created_at >= ${ts(since)} and from_pool)::int as pool_jobs,
      (select count(*) from feedback where status = 'new')::int as feedback_new,
      (select round(avg(extract(epoch from (ended_at - started_at)) / 60))::int from searches where started_at >= ${ts(since)} and ended_at is not null) as avg_minutes,
      (select round(percentile_cont(0.5) within group (order by m))::int from (
        select extract(epoch from (min(j.created_at) - s.started_at)) / 60 as m from searches s join jobs j on j.search_id = s.id where s.started_at >= ${ts(since)} group by s.id, s.started_at) x) as first_job_minutes,
      (select coalesce(sum(jobs_wanted), 0) from searches where started_at >= ${ts(since)})::int as wanted,
      (select count(*) from jobs where status_changed_at >= ${ts(since)} and status in (${lit(APPLIED_PLUS_LIST)}))::int as window_applied,
      (select count(*) from jobs where status_changed_at >= ${ts(since)} and status in ('interview', 'offer'))::int as window_interviews,
      (select count(*) from searches where ended_at is null and started_at < now() - interval '2 hours')::int as stuck,
      (select string_agg(who, ', ') from (
        select ${WHO} as who from searches s left join profiles p on p.id = s.profile_id left join users u on u.id = p.user_id
        where s.ended_at is null and s.started_at < now() - interval '2 hours' order by s.started_at desc limit 3) x) as stuck_hint,
      (select coalesce(sum(rejected), 0) from ingest_log where created_at >= now() - interval '1 day' and not dry_run)::int as refused_24h,
      (select count(*) from questions where status in (${lit(WAITING_QUESTION_LIST)}) and created_at < now() - interval '7 days')::int as old_questions,
      (select count(distinct user_id) from questions where status in (${lit(WAITING_QUESTION_LIST)}) and created_at < now() - interval '7 days')::int as old_question_people,
      (select count(*) from profiles where status = 'hunting' and auto_search_jobs is not null and auto_search_paused_at is null)::int as daily_on,
      (select count(*) from profiles where status = 'hunting' and auto_search_jobs is not null and auto_search_paused_at is not null)::int as daily_paused,
      (select count(*) from profiles where status = 'hunting' and auto_search_jobs is null and auto_search_off_at is not null)::int as daily_off,
      (select count(*) from searches where started_at >= ${ts(since)} and via = 'morning')::int as runs,
      (select count(*) from searches where started_at >= ${ts(since)} and via = 'followup')::int as follow_ups,
      (select coalesce(sum(jobs_wanted), 0) from searches where started_at >= ${ts(since)} and via in ('morning', 'followup'))::int as runs_wanted,
      (select coalesce(sum(jobs_added), 0) from searches where started_at >= ${ts(since)} and via in ('morning', 'followup'))::int as runs_added,
      (select count(*) from searches where started_at >= ${ts(since)} and coalesce(via, 'find') in ('find', 'setup'))::int as manual,
      (select coalesce(sum(jobs_wanted), 0) from searches where started_at >= ${ts(since)} and coalesce(via, 'find') in ('find', 'setup'))::int as manual_wanted,
      (select coalesce(sum(jobs_added), 0) from searches where started_at >= ${ts(since)} and coalesce(via, 'find') in ('find', 'setup'))::int as manual_added,
      (select coalesce(sum(cognition_used), 0) from searches where started_at >= ${ts(since)} and via in ('morning', 'followup'))::float8 as run_cog,
      (select coalesce(sum(cognition_used), 0) from searches where started_at >= ${ts(since)} and coalesce(via, 'find') in ('find', 'setup'))::float8 as manual_cog,
      (select count(*) from searches where started_at >= ${ts(since)} and extract(epoch from (coalesce(ended_at, now()) - started_at)) > 90 * 60)::int as long_searches,
      (select count(distinct p.user_id) from profiles p join users u on u.id = p.user_id where p.status = 'hunting' and (u.email is null or u.email_verified_at is null))::int as email_blocked
  `);

  // Query 2: every breakdown for the window in one UNION: per-day signups, searches, jobs and
  // cognition (by search end), plus jobs by stage and leads by reason.
  const facets = await rows<Facet>(sql`
    select 'signups' as kind, ${dayOf(sql.raw("created_at"))} as key, count(*)::int as n, 0::float8 as v from users where created_at >= ${ts(since)} group by 2
    union all select 'searches', ${dayOf(sql.raw("started_at"))}, count(*)::int, 0::float8 from searches where started_at >= ${ts(since)} group by 2
    union all select 'jobs', ${dayOf(sql.raw("created_at"))}, count(*)::int, 0::float8 from jobs where created_at >= ${ts(since)} group by 2
    union all select 'cognition', ${dayOf(sql.raw("coalesce(ended_at, started_at)"))}, 0, coalesce(sum(cognition_used), 0)::float8 from searches where started_at >= ${ts(since)} group by 2
    union all select 'stage', status, count(*)::int, 0::float8 from jobs where created_at >= ${ts(since)} group by 2
    union all select 'reason', reason, count(*)::int, 0::float8 from leads where created_at >= ${ts(since)} group by 2
    union all select 'notice', kind, count(*)::int, 0::float8 from notices where sent_at >= ${ts(since)} group by 2
    union all select 'country', c, count(*)::int, 0::float8 from (
      select u.id, coalesce(nullif(max(p.preferences->>'country'), ''), case when u.timezone is null then 'Unknown' else 'Unknown (' || split_part(u.timezone, '/', 1) || ')' end) as c
      from users u left join profiles p on p.user_id = u.id group by u.id, u.timezone) t group by 2
  `);
  const of = (kind: string) => facets.filter((f) => f.kind === kind);
  const series = (kind: string, value: (f: Facet) => number = (f) => f.n) => fill(keys, of(kind).map((f) => ({ key: f.key, v: value(f) })));

  // Query 3: the 15 newest searches in the window, with who ran them.
  const recent = await db
    .select({
      id: schema.searches.id,
      startedAt: schema.searches.startedAt,
      endedAt: schema.searches.endedAt,
      endReason: schema.searches.endReason,
      jobsWanted: schema.searches.jobsWanted,
      jobsAdded: schema.searches.jobsAdded,
      cognitionUsed: schema.searches.cognitionUsed,
      label: schema.profiles.label,
      username: schema.users.username,
      userId: schema.users.id,
    })
    .from(schema.searches)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.searches.profileId))
    .leftJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(gte(schema.searches.startedAt, since))
    .orderBy(desc(schema.searches.startedAt))
    .limit(15);

  // Query 4: the people who searched in the window, with where they are and what they got.
  type P = { id: string; username: string | null; country: string | null; searches: number; jobs: number; kept: number; avg_minutes: number | null; cognition: number };
  const people = await rows<P>(sql`
    select u.id, u.username, max(p.preferences->>'country') as country, count(s.id)::int as searches,
      coalesce(sum(s.jobs_added), 0)::int as jobs,
      (select count(*) from jobs j join profiles q on q.id = j.profile_id where q.user_id = u.id and j.created_at >= ${ts(since)} and j.status in (${lit(KEPT)}))::int as kept,
      round(avg(extract(epoch from (s.ended_at - s.started_at)) / 60))::int as avg_minutes,
      coalesce(sum(s.cognition_used), 0)::float8 as cognition
    from searches s join profiles p on p.id = s.profile_id join users u on u.id = p.user_id
    where s.started_at >= ${ts(since)}
    group by u.id, u.username order by searches desc, jobs desc limit 15
  `);

  return {
    days,
    keys,
    countries: counts(groupCountries(of("country").map((f) => ({ key: f.key, n: f.n })))),
    people: people.map((p) => ({ id: p.id, username: p.username, country: p.country ?? "", searches: p.searches, jobs: p.jobs, kept: p.kept, avgMinutes: p.avg_minutes, cognition: Math.round(p.cognition) })),
    allTime: { users: s.users, emailVerified: s.email_verified, deployed: s.deployed, live: s.live, searchingNow: s.searching_now, jobs: s.jobs, appliedPlus: s.applied_plus, extensionUsers: s.extension_users },
    window: {
      newUsers: s.new_users, referred: s.referred, activeUsers: s.active_users, searches: s.searches, openSearches: s.open_searches, finished: s.finished, finishedWithJobs: s.finished_with_jobs,
      jobs: s.window_jobs, kept: s.window_kept, leads: s.leads, cognition: s.cognition, poolJobs: s.pool_jobs,
      avgMinutes: s.avg_minutes, firstJobMinutes: s.first_job_minutes, wanted: s.wanted, applied: s.window_applied, interviews: s.window_interviews, emptySearches: s.empty_searches,
    },
    funnel: [
      { label: "Signed up", count: s.users, href: "/admin/users" },
      { label: "Chose a name", count: s.named },
      { label: "Verified an email", count: s.email_verified },
      { label: "Uploaded a resume", count: s.with_resume },
      { label: "Set preferences", count: s.with_prefs },
      { label: "Deployed a headhunter", count: s.with_mind, href: "/admin/users?deployed=1" },
      { label: "Ran a search", count: s.searched, href: "/admin/searches" },
      { label: "Got a job", count: s.got_job, href: "/admin/jobs" },
      { label: "Kept a job", count: s.kept },
      { label: "Applied", count: s.applied, href: "/admin/applications" },
    ],
    trend: { signups: series("signups"), searches: series("searches"), jobs: series("jobs"), cognition: series("cognition", (f) => f.v) },
    byStage: counts(of("stage").map((f) => ({ key: stageLabel(f.key), n: f.n }))),
    byReason: counts(of("reason").map((f) => ({ key: DROP_LABELS[f.key as DropReason] ?? f.key, n: f.n }))),
    alerts: [
      { label: "Feedback waiting to be read", count: s.feedback_new, href: "/admin/feedback" },
      { label: "Searches open for more than 2 hours", count: s.stuck, href: "/admin/searches?open=1", hint: s.stuck_hint ?? "" },
      { label: `Searches that ended with no jobs (last ${days} days)`, count: s.empty_searches, href: `/admin/searches?days=${days}&empty=1` },
      { label: "Deployed a headhunter but never searched", count: s.never_searched, href: "/admin/users?idle=1" },
      { label: "Searched but kept nothing", count: s.kept_nothing, href: "/admin/users?nokeep=1" },
      { label: "Jobs refused by the app, last 24 hours", count: s.refused_24h, href: "/admin/quality?days=1" },
      { label: "Headhunters paused", count: s.paused, href: "/admin/headhunters?status=paused" },
      { label: "People who cannot search until they verify an email", count: s.email_blocked, href: "/admin/headhunters" },
      { label: `Searches over 90 minutes (last ${days} days)`, count: s.long_searches, href: `/admin/searches?days=${days}&sort=minutes&dir=desc` },
      { label: "Questions waiting on people for over a week", count: s.old_questions, href: "/admin/applications", hint: `${s.old_question_people} people` },
    ],
    daily: {
      on: s.daily_on, paused: s.daily_paused, turnedOff: s.daily_off, runs: s.runs, followUps: s.follow_ups, runsWanted: s.runs_wanted, runsAdded: s.runs_added,
      manual: s.manual, manualWanted: s.manual_wanted, manualAdded: s.manual_added, runCog: s.run_cog, manualCog: s.manual_cog, long: s.long_searches,
    },
    emails: { verified: s.email_verified, blocked: s.email_blocked, sent: counts(of("notice").map((f) => ({ key: NOTICE_LABELS[f.key] ?? f.key, n: f.n }))) },
    recent: recent.map((r) => ({
      id: r.id,
      startedAt: r.startedAt,
      who: r.label != null ? `${r.username ?? "(no name yet)"} · ${r.label}` : "?",
      userId: r.userId ?? undefined,
      jobsWanted: r.jobsWanted,
      jobsAdded: r.jobsAdded,
      cognitionUsed: r.cognitionUsed,
      open: !r.endedAt,
      endReason: r.endReason,
      minutes: mins(r.startedAt, r.endedAt ?? now) ?? 1,
    })),
  };
}

// ---- feedback ------------------------------------------------------------------------------

export type FeedbackRow = { id: string; createdAt: Date; userId: string; username: string | null; kind: FeedbackKind; message: string; page: string | null; status: "new" | "done" };
export type Feedback = { total: number; open: number; rows: FeedbackRow[] };

export const feedbackList = () => memo("feedback", DETAIL_TTL, loadFeedback);

async function loadFeedback(): Promise<Feedback> {
  const rows = await db
    .select({ id: schema.feedback.id, createdAt: schema.feedback.createdAt, userId: schema.users.id, username: schema.users.username, kind: schema.feedback.kind, message: schema.feedback.message, page: schema.feedback.page, status: schema.feedback.status })
    .from(schema.feedback)
    .innerJoin(schema.users, eq(schema.users.id, schema.feedback.userId))
    .orderBy(desc(schema.feedback.createdAt))
    .limit(300);
  return { total: rows.length, open: rows.filter((r) => r.status === "new").length, rows };
}

// ---- briefs --------------------------------------------------------------------------------

export type BriefRow = { id: string; username: string | null; userId: string; label: string; mindName: string | null; status: ProfileStatus; briefVersion: number; briefedAt: Date | null; text: string; request: string };

export const briefs = () => memo("briefs", DETAIL_TTL, loadBriefs);

// The brief each headhunter gets today, built from its current settings, key hidden. Newest
// headhunters first; drafts without preferences have no brief yet.
async function loadBriefs(): Promise<BriefRow[]> {
  const rows = await db
    .select({
      id: schema.profiles.id, label: schema.profiles.label, mindName: schema.profiles.mindName, status: schema.profiles.status, preferences: schema.profiles.preferences, briefVersion: schema.profiles.briefVersion, briefedAt: schema.profiles.briefedAt, createdAt: schema.profiles.createdAt,
      userId: schema.users.id, username: schema.users.username, timezone: schema.users.timezone, applicant: schema.users.applicant, savedAnswers: schema.users.savedAnswers,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(sql`${schema.profiles.preferences} is not null and ${schema.profiles.mindId} is not null`)
    .orderBy(desc(schema.profiles.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id, username: r.username, userId: r.userId, label: r.label, mindName: r.mindName, status: r.status, briefVersion: r.briefVersion, briefedAt: r.briefedAt,
    text: buildBrief({ ownerName: r.username ?? "(no name yet)", profileLabel: r.label, prefs: r.preferences!, timezone: r.timezone ?? "UTC", appUrl: mindsConfig.ingestUrl, ingestKey: "(hidden)", facts: factsText({ applicant: r.applicant, savedAnswers: r.savedAnswers }) }),
    request: searchRequestText({ username: r.username ?? "me", jobs: r.preferences!.jobsPerDay, n: 0, maxAgeDays: postingAgeDays(r.preferences!), facts: "" }),
  }));
}

// ---- headhunters -------------------------------------------------------------------------

export type HeadhuntersParams = { status?: string; user?: string; sort: string; dir: Dir };
export type HeadhunterRow = {
  id: string; userId: string; user: string; email: string | null; emailVerified: boolean; label: string; mindName: string | null; status: ProfileStatus;
  roles: string; place: string; settings: string; perSearch: number | null; age: number | null;
  searches: number; jobs: number; jobsPerSearch: number | null; avgMinutes: number | null; perJob: number | null;
  lastSearch: Date | null; lastDeliveryAt: Date | null;
};
export type Headhunters = { total: number; deployed: number; hunting: number; paused: number; rows: HeadhunterRow[] };

const HH_LIMIT = 200;
const HH_SORT: Record<string, SQL> = {
  user: text('"user"'), label: text("label"), mind: text("mind_name"), status: sql.raw("status"), roles: text("roles"), place: text("place"), settings: text("settings"),
  perSearch: sql.raw("per_search"), age: sql.raw("age"), searches: sql.raw("searches"), jobs: sql.raw("jobs"), jobsPerSearch: sql.raw("jobs_per_search"),
  avgMinutes: sql.raw("avg_minutes"), perJob: sql.raw("per_job"), lastSearch: sql.raw("last_search"), lastDelivery: sql.raw("last_delivery"), created: sql.raw("created"),
};

export const headhunters = (params: HeadhuntersParams) => memo(`headhunters:${JSON.stringify(params)}`, TTL, () => loadHeadhunters(params));

async function loadHeadhunters(params: HeadhuntersParams): Promise<Headhunters> {
  const filters: SQL[] = [];
  if (params.status) filters.push(sql`p.status = ${params.status}`);
  if (params.user) filters.push(sql`${NAME} ilike ${like(params.user)}`);
  const where = filters.length ? sql.join(filters, sql` and `) : sql`true`;

  // Query 1: how many match the filters, and the all-time deployed / hunting / paused counts.
  const c = await one<{ total: number; deployed: number; hunting: number; paused: number }>(sql`
    select (count(*) filter (where ${where}))::int as total, count(p.mind_id)::int as deployed,
      (count(*) filter (where p.status = 'hunting'))::int as hunting, (count(*) filter (where p.status = 'paused'))::int as paused
    from profiles p left join users u on u.id = p.user_id
  `);

  // Query 2: one row per headhunter with its search and job totals folded in, sorted in SQL.
  type Row = {
    id: string; user_id: string; user: string; email: string | null; email_verified: boolean; label: string; mind_name: string | null; status: ProfileStatus; roles: string; place: string; work_settings: string[] | null;
    per_search: number | null; age: number | null; searches: number; jobs: number; jobs_per_search: number | null; avg_minutes: number | null; per_job: number | null;
    last_search: number | null; last_delivery: number | null;
  };
  const list = await rows<Row>(sql`
    select * from (
      select p.id, p.user_id, ${NAME} as "user", u.email, (u.email_verified_at is not null) as email_verified, p.label, p.mind_name, p.status,
        coalesce(p.preferences->>'targetRoles', '') as roles,
        case when p.preferences is null then '' else concat_ws(', ', nullif(p.preferences->>'city', ''), nullif(p.preferences->>'country', '')) end as place,
        case when p.preferences is null then '' else coalesce(p.preferences->>'workSettings', '') end as settings,
        p.preferences->'workSettings' as work_settings,
        (p.preferences->>'jobsPerDay')::int as per_search,
        case when p.preferences is null then null else coalesce((p.preferences->>'maxPostingAgeDays')::int, ${MAX_POSTING_AGE_DAYS}) end as age,
        s.searches, s.avg_minutes, s.cognition, s.jobs_added,
        (select count(*) from jobs j where j.profile_id = p.id)::int as jobs,
        case when s.searches > 0 then (select count(*) from jobs j where j.profile_id = p.id)::float8 / s.searches end as jobs_per_search,
        case when s.jobs_added > 0 then s.cognition / s.jobs_added end as per_job,
        ${ms(sql.raw("s.last_search"))} as last_search, ${ms(sql.raw("p.last_delivery_at"))} as last_delivery, ${ms(sql.raw("p.created_at"))} as created
      from profiles p
      left join users u on u.id = p.user_id
      left join lateral (
        select count(*)::int as searches,
          (round(avg(${minutesBetween(sql.raw("started_at"), sql.raw("ended_at"))}) filter (where ended_at is not null)))::int as avg_minutes,
          coalesce(sum(cognition_used), 0)::float8 as cognition, coalesce(sum(jobs_added), 0)::int as jobs_added, max(started_at) as last_search
        from searches s where s.profile_id = p.id
      ) s on true
      where ${where}
    ) t order by ${orderBy(HH_SORT, params.sort, params.dir, "lastSearch")} limit ${HH_LIMIT}
  `);

  return {
    total: c.total,
    deployed: c.deployed,
    hunting: c.hunting,
    paused: c.paused,
    rows: list.map((r) => ({
      id: r.id, userId: r.user_id, user: r.user, email: r.email, emailVerified: r.email_verified, label: r.label, mindName: r.mind_name, status: r.status,
      roles: r.roles, place: r.place, settings: (r.work_settings ?? []).map(workSettingLabel).join(", "), perSearch: r.per_search, age: r.age,
      searches: r.searches, jobs: r.jobs, jobsPerSearch: r.jobs_per_search, avgMinutes: r.avg_minutes, perJob: r.per_job,
      lastSearch: at(r.last_search), lastDeliveryAt: at(r.last_delivery),
    })),
  };
}

// ---- searches ----------------------------------------------------------------------------

export type SearchesParams = { days: number; user?: string; open?: boolean; empty?: boolean; sort: string; dir: Dir };
export type SearchRow = {
  id: string; startedAt: Date; endedAt: Date | null; endReason: string | null; jobsWanted: number; jobsAdded: number | null; cognitionUsed: number | null; focus: string | null;
  who: string; userId?: string; delivered: number; dropped: number; minutes: number; poolHits: number; opened: number | null; summary: string | null;
};
export type Searches = { total: number; userFound: boolean; avgMinutes: number | null; jobsPerSearch: [number, number]; cogPerSearch: number | null; cogPerJob: number | null; rows: SearchRow[] };

const SEARCHES_LIMIT = 500;
const SEARCHES_SORT: Record<string, SQL> = {
  started: sql.raw("started"), who: text("who"), wanted: sql.raw("jobs_wanted"), delivered: sql.raw("delivered"), dropped: sql.raw("dropped"), cognition: sql.raw("cognition_used"),
  minutes: sql.raw("minutes"), ended: sql.raw("nullif(coalesce(end_reason, case when ended is null then 'open' else '' end), '')"), pool: sql.raw("pool_hits"), opened: sql.raw("opened"),
};

export const searches = (params: SearchesParams) => memo(`searches:${JSON.stringify(params)}`, TTL, () => loadSearches(params));

// The user filter means "this username exactly"; an unknown name shows nothing and a note.
async function userIdByName(username: string): Promise<string | null> {
  const r = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.username}) = lower(${username.trim()})`).limit(1);
  return r[0]?.id ?? null;
}

async function loadSearches(params: SearchesParams): Promise<Searches> {
  const since = daysAgo(params.days);
  const none: Searches = { total: 0, userFound: false, avgMinutes: null, jobsPerSearch: [0, 0], cogPerSearch: null, cogPerJob: null, rows: [] };

  // Query 1 (only with a user filter): who that is.
  let userId: string | null = null;
  if (params.user) {
    userId = await userIdByName(params.user);
    if (!userId) return none;
  }
  const filters: SQL[] = [sql`s.started_at >= ${ts(since)}`];
  if (userId) filters.push(sql`p.user_id = ${userId}`);
  if (params.open) filters.push(sql`s.ended_at is null`);
  if (params.empty) filters.push(sql`s.ended_at is not null and coalesce(s.jobs_added, 0) = 0`);
  const where = sql.join(filters, sql` and `);
  // Jobs and leads belong to a search when they arrived between its start and its end.
  const delivered = sql.raw(`(select count(*) from jobs j where j.profile_id = s.profile_id and j.created_at >= s.started_at and j.created_at <= coalesce(s.ended_at, now()))::int`);
  const dropped = sql.raw(`(select count(*) from leads l where l.profile_id = s.profile_id and l.created_at >= s.started_at and l.created_at <= coalesce(s.ended_at, now()))::int`);
  const minutes = minutesBetween(sql.raw("s.started_at"), sql.raw("coalesce(s.ended_at, now())"));
  const from = sql`from searches s left join profiles p on p.id = s.profile_id left join users u on u.id = p.user_id where ${where}`;

  // Query 2: the tiles, over every matching search (not only the rows shown).
  const a = await one<{ total: number; done: number; total_min: number; total_jobs: number; total_cog: number }>(sql`
    select count(*)::int as total, count(s.ended_at)::int as done,
      coalesce(sum(${minutes}) filter (where s.ended_at is not null), 0)::int as total_min,
      coalesce(sum(${delivered}), 0)::int as total_jobs,
      coalesce(sum(s.cognition_used), 0)::float8 as total_cog
    ${from}
  `);

  // Query 3: the rows, filtered and sorted in SQL.
  type Row = { id: string; started: number; ended: number | null; end_reason: string | null; jobs_wanted: number; jobs_added: number | null; cognition_used: number | null; focus: string | null; who: string; user_id: string | null; delivered: number; dropped: number; minutes: number; pool_hits: number; opened: number | null; summary: string | null };
  const list = await rows<Row>(sql`
    select * from (
      select s.id, ${ms(sql.raw("s.started_at"))} as started, ${ms(sql.raw("s.ended_at"))} as ended, s.end_reason, s.jobs_wanted, s.jobs_added, s.cognition_used, s.focus, s.pool_hits, s.opened, s.summary,
        ${WHO} as who, u.id as user_id, ${delivered} as delivered, ${dropped} as dropped, ${minutes} as minutes
      ${from}
    ) t order by ${orderBy(SEARCHES_SORT, params.sort, params.dir, "started")} limit ${SEARCHES_LIMIT}
  `);

  return {
    total: a.total,
    userFound: true,
    avgMinutes: a.done ? Math.round(a.total_min / a.done) : null,
    jobsPerSearch: [a.total_jobs, a.total],
    cogPerSearch: a.total ? Math.round(a.total_cog / a.total) : null,
    cogPerJob: a.total_jobs ? Math.round(a.total_cog / a.total_jobs) : null,
    rows: list.map((r) => ({
      id: r.id, startedAt: at(r.started)!, endedAt: at(r.ended), endReason: r.end_reason, jobsWanted: r.jobs_wanted, jobsAdded: r.jobs_added, cognitionUsed: r.cognition_used, focus: r.focus,
      who: r.who, userId: r.user_id ?? undefined, delivered: r.delivered, dropped: r.dropped, minutes: r.minutes, poolHits: r.pool_hits, opened: r.opened, summary: r.summary,
    })),
  };
}

// Plain names for the Hello Minds tools in the ledger.
const TOOL_LABEL: Record<string, string> = { SEARCH_Web: "Web searches", SEARCH_X: "X searches", HTTP_Execute: "Pages opened", FILE_Analyze: "Files read", LLM_Turn: "Thinking and writing", LLM_CodeInterpreter: "Code run" };

// ---- search detail -------------------------------------------------------------------------

export type SearchDetail = {
  search: { id: string; startedAt: Date; endedAt: Date | null; endReason: string | null; jobsWanted: number; jobsAdded: number | null; focus: string | null; balanceStart: number | null; balanceEnd: number | null; poolHits: number; opened: number | null; summary: string | null };
  profile: { id: string; label: string; mindName: string | null; status: ProfileStatus; preferences: Preferences | null } | null;
  user: { id: string; username: string | null } | null;
  open: boolean;
  minutes: number;
  cognition: number | null;
  events: { at: Date; what: string; detail?: string }[];
  jobs: { id: string; createdAt: Date; company: string; title: string; url: string; matchScore: number; place: string; status: JobStatus; fromPool: boolean }[];
  leads: { id: string; createdAt: Date; company: string; title: string; url: string | null; note: string | null; reason: DropReason }[];
  leadsByReason: [string, number][];
  leadGroups: { reason: string; label: string; leads: SearchDetail["leads"] }[];
  pushes: { id: number; createdAt: Date; dryRun: boolean; accepted: number; rejected: number; codes: string }[];
  refused: { code: string; url: string; hint: string }[];
  usage: { label: string; calls: number; cognition: number }[]; // where the cognition went, per tool
  usageLive: boolean; // read from Hello Minds just now (search still open)
  chat: { at: Date; fromMind: boolean; text: string }[]; // the conversation since the search started, newest last
};

export const searchDetail = (id: string) => memo(`search:${id}`, DETAIL_TTL, () => loadSearchDetail(id));

const codesOf = (detail: unknown) => tally(pushDetails(detail).filter((x) => x.code), (x) => x.code!).map(([c, n]) => `${c} ×${n}`).join(", ");

async function loadSearchDetail(id: string): Promise<SearchDetail | null> {
  const now = daysAgo(0);
  // Query 1: the search with its headhunter and the person, in one go.
  const [row] = await db
    .select({
      id: schema.searches.id, startedAt: schema.searches.startedAt, endedAt: schema.searches.endedAt, endReason: schema.searches.endReason, jobsWanted: schema.searches.jobsWanted, jobsAdded: schema.searches.jobsAdded, via: schema.searches.via,
      focus: schema.searches.focus, nudgedAt: schema.searches.nudgedAt, balanceStart: schema.searches.balanceStart, balanceEnd: schema.searches.balanceEnd, cognitionUsed: schema.searches.cognitionUsed, profileId: schema.searches.profileId,
      poolHits: schema.searches.poolHits, opened: schema.searches.opened, summary: schema.searches.summary, toolUsage: schema.searches.toolUsage, mindId: schema.profiles.mindId, alias: schema.profiles.conversationAlias,
      pId: schema.profiles.id, label: schema.profiles.label, mindName: schema.profiles.mindName, status: schema.profiles.status, preferences: schema.profiles.preferences,
      uId: schema.users.id, username: schema.users.username,
    })
    .from(schema.searches)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.searches.profileId))
    .leftJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(eq(schema.searches.id, id))
    .limit(1);
  if (!row) return null;
  const end = row.endedAt ?? now;
  const between = (col: typeof schema.jobs.createdAt | typeof schema.leads.createdAt | typeof schema.ingestLog.createdAt) => and(gte(col, row.startedAt), lte(col, end));

  // Queries 2 to 4: what arrived between start and end: jobs, dropped leads, pushes.
  const jobs = await db
    .select({ id: schema.jobs.id, createdAt: schema.jobs.createdAt, company: schema.jobs.company, title: schema.jobs.title, url: schema.jobs.url, matchScore: schema.jobs.matchScore, city: schema.jobs.city, country: schema.jobs.country, status: schema.jobs.status, fromPool: schema.jobs.fromPool })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, row.profileId), or(eq(schema.jobs.searchId, row.id), and(isNull(schema.jobs.searchId), between(schema.jobs.createdAt)))))
    .orderBy(asc(schema.jobs.createdAt))
    .limit(200);
  const leads = await db
    .select({ id: schema.leads.id, createdAt: schema.leads.createdAt, company: schema.leads.company, title: schema.leads.title, url: schema.leads.url, note: schema.leads.note, reason: schema.leads.reason })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, row.profileId), between(schema.leads.createdAt)))
    .orderBy(asc(schema.leads.createdAt))
    .limit(200);
  const pushes = await db
    .select({ id: schema.ingestLog.id, createdAt: schema.ingestLog.createdAt, dryRun: schema.ingestLog.dryRun, accepted: schema.ingestLog.accepted, rejected: schema.ingestLog.rejected, detail: schema.ingestLog.detail })
    .from(schema.ingestLog)
    .where(and(eq(schema.ingestLog.profileId, row.profileId), between(schema.ingestLog.createdAt)))
    .orderBy(asc(schema.ingestLog.createdAt))
    .limit(200);

  // Timeline: start, nudge, every push, end.
  const events: SearchDetail["events"] = [{ at: row.startedAt, what: "Search started", detail: `${row.jobsWanted} jobs wanted${row.via ? `, via ${row.via}` : ""}${row.focus ? `, focus: ${row.focus}` : ""}` }];
  if (row.nudgedAt) events.push({ at: row.nudgedAt, what: "Nudged", detail: "Nothing had arrived; the Mind was asked to send what it had." });
  for (const p of pushes) {
    const codes = codesOf(p.detail);
    events.push({ at: p.createdAt, what: p.dryRun ? "Dry run" : "Push", detail: `${p.accepted} accepted, ${p.rejected} rejected${codes ? ` (${codes})` : ""}` });
  }
  if (row.endedAt) events.push({ at: row.endedAt, what: `Ended: ${row.endReason ?? "unknown"}`, detail: row.summary ?? `${row.jobsAdded ?? 0} jobs added` });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const byReason = new Map<string, SearchDetail["leads"]>();
  for (const l of leads) byReason.set(l.reason, [...(byReason.get(l.reason) ?? []), l]);

  // Where the cognition went. Stored at the end of a search; read live from Hello Minds while it runs.
  let usageMap = row.toolUsage ?? null;
  let usageLive = false;
  // What was said in the conversation since the search started: our request, the Mind's replies.
  // The one place to see a Mind that answered in words instead of searching.
  let chat: SearchDetail["chat"] = [];
  if (row.uId && (row.mindId || row.alias)) {
    try {
      const owner = await db.query.users.findFirst({ where: eq(schema.users.id, row.uId) });
      if (owner) {
        const api = minds(owner);
        if (!usageMap && !row.endedAt && row.mindId) {
          const since = new Date(row.startedAt);
          since.setUTCMinutes(0, 0, 0);
          usageMap = usageByTool(await api.toolUsage(row.mindId, since));
          usageLive = true;
        }
        if (row.alias) {
          const from = row.startedAt.getTime() - 60_000;
          const to = (row.endedAt?.getTime() ?? Date.now()) + 60_000;
          chat = (await api.history(row.alias, 40))
            .filter((m) => m.at.getTime() >= from && m.at.getTime() <= to)
            .sort((a, b) => a.at.getTime() - b.at.getTime())
            .map((m) => ({ at: m.at, fromMind: m.fromMind, text: m.text }));
        }
      }
    } catch (e) {
      console.error("[admin] ledger", e);
    }
  }
  const usage = Object.entries(usageMap ?? {})
    .map(([tool, u]) => ({ label: TOOL_LABEL[tool] ?? tool, calls: u.calls, cognition: u.cognition }))
    .sort((x, y) => y.cognition - x.cognition);

  return {
    search: { id: row.id, startedAt: row.startedAt, endedAt: row.endedAt, endReason: row.endReason, jobsWanted: row.jobsWanted, jobsAdded: row.jobsAdded, focus: row.focus, balanceStart: row.balanceStart, balanceEnd: row.balanceEnd, poolHits: row.poolHits, opened: row.opened, summary: row.summary },
    profile: row.pId ? { id: row.pId, label: row.label!, mindName: row.mindName, status: row.status!, preferences: row.preferences ?? null } : null,
    user: row.uId ? { id: row.uId, username: row.username } : null,
    open: !row.endedAt,
    minutes: mins(row.startedAt, end) ?? 1,
    cognition: row.cognitionUsed != null ? Math.round(Number(row.cognitionUsed)) : null,
    events,
    jobs: jobs.map((j) => ({ ...j, place: [j.city, j.country].filter(Boolean).join(", ") })),
    leads,
    leadsByReason: tally(leads, (l) => DROP_LABELS[l.reason] ?? l.reason),
    leadGroups: [...byReason.entries()].map(([reason, list]) => ({ reason, label: DROP_LABELS[reason as DropReason] ?? reason, leads: list })),
    pushes: pushes.map((p) => ({ id: p.id, createdAt: p.createdAt, dryRun: p.dryRun, accepted: p.accepted, rejected: p.rejected, codes: codesOf(p.detail) })),
    usage,
    usageLive,
    chat,
    refused: pushes.flatMap((p) => pushDetails(p.detail).filter((x) => x.code).map((x) => ({ code: x.code!, url: x.url ?? "", hint: x.hint ?? "" }))),
  };
}

// ---- jobs --------------------------------------------------------------------------------

export type JobsParams = { days: number; user?: string; stage?: string; host?: string; q?: string; sort: string; dir: Dir };
export type JobRow = {
  id: string; createdAt: Date; who: string; userId?: string; matchScore: number; company: string; title: string; place: string; workSetting: string; postedOn: string | null; postedAt: string | null;
  salary: string | null; salaryEstimated: boolean; status: JobStatus; statusChangedAt: Date | null; url: string; host: string;
};
export type Jobs = { total: number; userFound: boolean; byStage: [string, number][]; bySetting: [string, number][]; byHost: [string, number][]; rows: JobRow[] };

const JOBS_LIMIT = 500;
// The link's host, as host() in lib/admin reads it: hostname without www., or the raw url.
const HOST = sql.raw(`coalesce(lower(regexp_replace(substring(j.url from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#:]+)'), '^www\\.', '')), j.url)`);
const JOBS_SORT: Record<string, SQL> = {
  when: sql.raw("created"), who: text("who"), match: sql.raw("match_score"), company: text("company"), title: text("title"), place: text("place"), setting: sql.raw("work_setting"),
  posted: sql.raw("posted_on"), salary: text("salary"), stage: sql`array_position(${arr(STAGE_ORDER)}, status)`, changed: sql.raw("status_changed"), host: text("host"),
};

export const jobs = (params: JobsParams) => memo(`jobs:${JSON.stringify(params)}`, TTL, () => loadJobs(params));

async function loadJobs(params: JobsParams): Promise<Jobs> {
  const since = daysAgo(params.days);
  const none: Jobs = { total: 0, userFound: false, byStage: [], bySetting: [], byHost: [], rows: [] };

  // Query 1 (only with a user filter): who that is.
  let userId: string | null = null;
  if (params.user) {
    userId = await userIdByName(params.user);
    if (!userId) return none;
  }
  const filters: SQL[] = [sql`j.created_at >= ${ts(since)}`];
  if (userId) filters.push(sql`p.user_id = ${userId}`);
  if (params.stage) filters.push(sql`j.status = ${params.stage}`);
  if (params.host) filters.push(sql`${HOST} ilike ${like(params.host)}`);
  if (params.q) filters.push(sql`(j.company ilike ${like(params.q)} or j.title ilike ${like(params.q)})`);
  const from = sql`from jobs j left join profiles p on p.id = j.profile_id left join users u on u.id = p.user_id where ${sql.join(filters, sql` and `)}`;

  // Query 2: the total and the three breakdowns (stage, work setting, top 10 hosts) in one UNION.
  const facets = await rows<Facet>(sql`
    select 'total' as kind, '' as key, count(*)::int as n, 0::float8 as v ${from}
    union all select 'stage', j.status, count(*)::int, 0::float8 ${from} group by j.status
    union all select 'setting', coalesce(j.work_setting, 'unknown'), count(*)::int, 0::float8 ${from} group by j.work_setting
    union all (select 'host', h.host, count(*)::int, 0::float8 from (select ${HOST} as host ${from}) h group by h.host order by 3 desc limit 10)
  `);
  const of = (kind: string) => facets.filter((f) => f.kind === kind);

  // Query 3: the rows, filtered and sorted in SQL.
  type Row = {
    id: string; created: number; who: string; user_id: string | null; match_score: number; company: string; title: string; place: string; work_setting: string; posted_on: string | null; posted_at: string | null;
    salary: string | null; salary_estimated: boolean; status: JobStatus; status_changed: number | null; url: string; host: string;
  };
  const list = await rows<Row>(sql`
    select * from (
      select j.id, ${ms(sql.raw("j.created_at"))} as created, ${WHO} as who, u.id as user_id, j.match_score, j.company, j.title,
        concat_ws(', ', nullif(j.city, ''), nullif(j.country, '')) as place, j.work_setting, j.posted_on::text as posted_on, j.posted_at,
        j.salary, j.salary_estimated, j.status, ${ms(sql.raw("j.status_changed_at"))} as status_changed, j.url, ${HOST} as host
      ${from}
    ) t order by ${orderBy(JOBS_SORT, params.sort, params.dir, "when")} limit ${JOBS_LIMIT}
  `);

  return {
    total: of("total")[0]?.n ?? 0,
    userFound: true,
    byStage: counts(of("stage").map((f) => ({ key: stageLabel(f.key), n: f.n }))),
    bySetting: counts(of("setting").map((f) => ({ key: workSettingLabel(f.key), n: f.n }))),
    byHost: counts(of("host").map((f) => ({ key: f.key, n: f.n }))),
    rows: list.map((r) => ({
      id: r.id, createdAt: at(r.created)!, who: r.who, userId: r.user_id ?? undefined, matchScore: r.match_score, company: r.company, title: r.title, place: r.place, workSetting: r.work_setting,
      postedOn: r.posted_on, postedAt: r.posted_at, salary: r.salary, salaryEstimated: r.salary_estimated, status: r.status, statusChangedAt: at(r.status_changed), url: r.url, host: r.host,
    })),
  };
}

// ---- quality -----------------------------------------------------------------------------

export type QualityParams = { days: number; sort: string; dir: Dir };
export type LeadRow = { id: string; createdAt: Date; who: string; userId?: string; reason: DropReason; company: string; title: string; url: string | null; note: string | null };
export type RefusedRow = { at: Date; who: string; code: string; url: string; hint: string };
export type Quality = {
  keys: string[];
  searches: number;
  delivered: number;
  leadTotal: number;
  refusedTotal: number;
  mistakeTotal: number;
  perDayByReason: { reason: DropReason; values: number[] }[];
  byReason: [string, number][];
  byWho: [string, number][];
  byPlace: [string, number][];
  byOther: [string, number][];
  byCode: [string, number][];
  blockedHosts: [string, number][];
  mistakeRows: { pid: string; who: string; userId?: string; total: number; counts: number[] }[];
  leads: LeadRow[];
  refused: RefusedRow[];
};

const QUALITY_LIMIT = 500;
// Sub-buckets read from the Mind's note, so the two vague reasons say something. Postgres
// regexes: \y is a word boundary (JS \b).
const PLACES: [string, string][] = [
  ["United States", "\\yus\\y|u\\.s\\.|usa|united states|americas|north america|california|new york|pacific time|eastern time"],
  ["Singapore", "singapore"],
  ["UK or Europe", "\\yuk\\y|united kingdom|europe|emea|london|berlin|vienna|malta|stockholm"],
  ["UAE", "abu dhabi|dubai|uae"],
  ["India", "india"],
  ["Thailand", "bangkok|thailand"],
  ["Vietnam", "vietnam|ho chi minh"],
  ["Philippines", "philippines|manila|quezon"],
  ["Indonesia", "indonesia|jakarta"],
  ["Hong Kong or China", "hong kong|shanghai|china"],
  ["Qualification bar, not place", "requires?|qualification|credential|degree|years|experience|certif"],
];
const OTHERS: [string, string][] = [
  ["Employer page would not load or blocked", "not load|blocked|403|unreachable|would not render|unverifiable|could not open|returned no job|no longer exists"],
  ["Recruiter or staffing agency, employer unnamed", "recruit|staffing|agency|client (not |un)named|michael page|robert walters"],
  ["Only job-board mirrors found", "aggregator|mirror|job board|linkedin only|no employer"],
  ["Not a real opening (pool, programme, window)", "resume pool|accelerator|application window|one-liner|not an active"],
  ["Level or title outside target", "associate|principal|level"],
];
const bucket = (table: [string, string][]) => sql.raw(`case ${table.map(([label, re]) => `when l.note ~* '${re}' then '${label.replace(/'/g, "''")}'`).join(" ")} else 'Unspecified' end`);
// Pushes' rejection details, one row per refused job (ingest_log.detail is a JSON array).
const REFUSED = sql.raw(`from ingest_log g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.detail) = 'array' then g.detail else '[]'::jsonb end) d
  left join profiles p on p.id = g.profile_id left join users u on u.id = p.user_id`);
const LEADS_SORT: Record<string, SQL> = { when: sql.raw("created"), who: text("who"), reason: sql.raw("reason"), company: text("company") };

export const quality = (params: QualityParams) => memo(`quality:${JSON.stringify(params)}`, TTL, () => loadQuality(params));

async function loadQuality(params: QualityParams): Promise<Quality> {
  const since = daysAgo(params.days);
  const keys = dayKeys(params.days);
  const leadsFrom = sql`from leads l left join profiles p on p.id = l.profile_id left join users u on u.id = p.user_id where l.created_at >= ${ts(since)}`;
  const refusedWhere = sql`where g.created_at >= ${ts(since)} and d->>'code' is not null`;

  // Query 1: every count on the page in one UNION: searches and jobs delivered in the window,
  // leads by reason / headhunter / place bucket / other bucket / day+reason, refusals by code,
  // and the Mind's mistakes per headhunter and code.
  type F = { kind: string; key: string; sub: string | null; label: string | null; user_id: string | null; n: number };
  const facets = await rows<F>(sql`
    select 'searches' as kind, '' as key, null::text as sub, null::text as label, null::uuid as user_id, count(*)::int as n from searches where started_at >= ${ts(since)}
    union all select 'delivered', '', null, null, null, coalesce(sum(jobs_added), 0)::int from searches where started_at >= ${ts(since)}
    union all select 'total', '', null, null, null, count(*)::int ${leadsFrom}
    union all select 'reason', l.reason, null, null, null, count(*)::int ${leadsFrom} group by l.reason
    union all select 'who', ${WHO}, null, null, null, count(*)::int ${leadsFrom} group by 2
    union all select 'place', ${bucket(PLACES)}, null, null, null, count(*)::int ${leadsFrom} and l.reason = 'not_eligible' group by 2
    union all select 'other', ${bucket(OTHERS)}, null, null, null, count(*)::int ${leadsFrom} and l.reason in ('other', 'pay') group by 2
    union all select 'day', ${dayOf(sql.raw("l.created_at"))}, l.reason, null, null, count(*)::int ${leadsFrom} group by 2, 3
    union all select 'code', d->>'code', null, null, null, count(*)::int ${REFUSED} ${refusedWhere} group by 2
    union all select 'host', regexp_replace(substring(l.url from '^https?://([^/]+)'), '^www\\.', ''), null, null, null, count(*)::int from leads l where l.created_at >= now() - interval '7 days' and l.reason = 'unreachable' and l.url is not null group by 2
    union all select 'mistake', g.profile_id::text, d->>'code', ${WHO}, u.id, count(*)::int ${REFUSED} ${refusedWhere} and d->>'code' in (${lit(MIND_MISTAKES)}) group by 2, 3, 4, 5
  `);
  const of = (kind: string) => facets.filter((f) => f.kind === kind);
  const scalar = (kind: string) => of(kind)[0]?.n ?? 0;

  // Query 2: every dropped lead, newest first (or as sorted), capped.
  type L = { id: string; created: number; who: string; user_id: string | null; reason: DropReason; company: string; title: string; url: string | null; note: string | null };
  const leads = await rows<L>(sql`
    select * from (
      select l.id, ${ms(sql.raw("l.created_at"))} as created, ${WHO} as who, u.id as user_id, l.reason, l.company, l.title, l.url, l.note ${leadsFrom}
    ) t order by ${orderBy(LEADS_SORT, params.sort, params.dir, "when")} limit ${QUALITY_LIMIT}
  `);

  // Query 3: every refused job in the window's pushes, newest push first, capped.
  type R = { at: number; who: string; code: string; url: string; hint: string };
  const refused = await rows<R>(sql`
    select ${ms(sql.raw("g.created_at"))} as at, ${WHO} as who, d->>'code' as code, coalesce(d->>'url', '') as url, coalesce(d->>'hint', '') as hint
    ${REFUSED} ${refusedWhere} order by g.created_at desc, g.id desc limit ${QUALITY_LIMIT}
  `);

  // The Mind's mistakes, pivoted per headhunter: total, then one count per code.
  const mistakes = new Map<string, Quality["mistakeRows"][number]>();
  for (const f of of("mistake")) {
    const m = mistakes.get(f.key) ?? { pid: f.key, who: f.label ?? "?", userId: f.user_id ?? undefined, total: 0, counts: MIND_MISTAKES.map(() => 0) };
    m.total += f.n;
    const i = (MIND_MISTAKES as readonly string[]).indexOf(f.sub ?? "");
    if (i >= 0) m.counts[i] += f.n;
    mistakes.set(f.key, m);
  }
  const days = of("day");
  const reasons = [...new Set(days.map((f) => f.sub as DropReason))];

  return {
    keys,
    searches: scalar("searches"),
    delivered: scalar("delivered"),
    leadTotal: scalar("total"),
    refusedTotal: of("code").reduce((a, f) => a + f.n, 0),
    mistakeTotal: of("mistake").reduce((a, f) => a + f.n, 0),
    perDayByReason: reasons.map((reason) => ({ reason, values: fill(keys, days.filter((f) => f.sub === reason).map((f) => ({ key: f.key, v: f.n }))) })),
    byReason: counts(of("reason").map((f) => ({ key: f.key, n: f.n }))),
    byWho: counts(of("who").map((f) => ({ key: f.key, n: f.n }))),
    byPlace: counts(of("place").map((f) => ({ key: f.key, n: f.n }))),
    byOther: counts(of("other").map((f) => ({ key: f.key, n: f.n }))),
    byCode: counts(of("code").map((f) => ({ key: f.key, n: f.n }))),
    blockedHosts: counts(of("host").filter((f) => f.key).map((f) => ({ key: f.key, n: f.n }))),
    mistakeRows: [...mistakes.values()].sort((a, b) => b.total - a.total),
    leads: leads.map((l) => ({ id: l.id, createdAt: at(l.created)!, who: l.who, userId: l.user_id ?? undefined, reason: l.reason, company: l.company, title: l.title, url: l.url, note: l.note })),
    refused: refused.map((r) => ({ at: at(r.at)!, who: r.who, code: r.code, url: r.url, hint: r.hint })),
  };
}

// ---- users -------------------------------------------------------------------------------

export type UsersParams = { q?: string; deployed?: boolean; active?: number; idle?: boolean; nokeep?: boolean; sort: string; dir: Dir };
export type UserRow = {
  id: string; name: string; username: string | null; email: string | null; emailVerified: boolean; createdAt: Date; hhStatus: string; hhRaw: string;
  searches: number; jobs: number; kept: number; applied: number; cognition: number; lastSearch: Date | null; lastSeen: Date | null;
  extension: boolean; extensionUsed: Date | null; referrer: string; referrerId?: string; waiting: number; answers: number;
};
export type Users = { total: number; allUsers: number; deployedUsers: number; unnamed: number; rows: UserRow[] };

const USERS_LIMIT = 500;
const USERS_SORT: Record<string, SQL> = {
  name: text("username"), joined: sql.raw("joined"), email: text("email"), status: text("hh_status"), searches: sql.raw("searches"), jobs: sql.raw("jobs"), kept: sql.raw("kept"), applied: sql.raw("applied"),
  cognition: sql.raw("cognition"), lastSearch: sql.raw("last_search"), lastSeen: sql.raw("last_seen"), extension: sql.raw("extension_used"), referrer: text("referrer_text"), waiting: sql.raw("waiting"), answers: sql.raw("answers"),
};

export const users = (params: UsersParams) => memo(`users:${JSON.stringify(params)}`, TTL, () => loadUsers(params));

async function loadUsers(params: UsersParams): Promise<Users> {
  // One row per account with everything folded in. "Last seen" is the newest session's
  // creation (expiry minus 30 days) or the last search, whichever is later.
  const base = sql.raw(`
    with x as (
      select u.id, u.username, u.email, u.email_verified_at is not null as email_verified, (extract(epoch from u.created_at) * 1000)::float8 as joined, u.referred_by,
        coalesce(u.username, '(no name yet)') as name,
        exists (select 1 from profiles p where p.user_id = u.id and p.mind_id is not null) as deployed,
        coalesce(replace(hh.status, '_', ' '), '') as hh_status, coalesce(hh.status, '') as hh_raw,
        (select count(*) from searches s join profiles p on p.id = s.profile_id where p.user_id = u.id)::int as searches,
        (select count(*) from jobs j join profiles p on p.id = j.profile_id where p.user_id = u.id)::int as jobs,
        (select count(*) from jobs j join profiles p on p.id = j.profile_id where p.user_id = u.id and j.status in (${[...KEPT].map((x) => `'${x}'`).join(", ")}))::int as kept,
        (select count(*) from jobs j join profiles p on p.id = j.profile_id where p.user_id = u.id and j.status in (${APPLIED_PLUS_LIST.map((x) => `'${x}'`).join(", ")}))::int as applied,
        round(coalesce((select sum(s.cognition_used) from searches s join profiles p on p.id = s.profile_id where p.user_id = u.id), 0))::int as cognition,
        (extract(epoch from (select max(s.started_at) from searches s join profiles p on p.id = s.profile_id where p.user_id = u.id)) * 1000)::float8 as last_search,
        (extract(epoch from (select max(expires_at) from sessions where user_id = u.id) - interval '30 days') * 1000)::float8 as last_session,
        exists (select 1 from extension_tokens t where t.user_id = u.id) as extension,
        (extract(epoch from (select max(coalesce(t.last_used_at, t.created_at)) from extension_tokens t where t.user_id = u.id)) * 1000)::float8 as extension_used,
        r.id as referrer_id,
        case when r.id is not null then coalesce(r.username, '(no name yet)') when nullif(u.referred_by, '') is not null then 'code ' || u.referred_by else '' end as referrer_text,
        (select count(*) from questions q where q.user_id = u.id and q.status in (${WAITING_QUESTION_LIST.map((x) => `'${x}'`).join(", ")}))::int as waiting,
        case when jsonb_typeof(u.saved_answers) = 'array' then jsonb_array_length(u.saved_answers) else 0 end as answers
      from users u
      left join lateral (select p.status from profiles p where p.user_id = u.id order by (p.status in ('hunting', 'paused')) desc, p.created_at asc limit 1) hh on true
      left join lateral (select r.id, r.username from users r where r.referral_code = u.referred_by limit 1) r on true
    ), y as (select *, greatest(last_session, last_search) as last_seen from x)
  `);
  const filters: SQL[] = [];
  if (params.q) filters.push(sql`(username ilike ${like(params.q)} or email ilike ${like(params.q)})`);
  if (params.deployed) filters.push(sql`deployed`);
  if (params.active) filters.push(sql`last_search >= ${daysAgo(params.active).getTime()}`);
  if (params.idle) filters.push(sql`deployed and searches = 0`);
  if (params.nokeep) filters.push(sql`searches > 0 and kept = 0`);
  const where = filters.length ? sql.join(filters, sql` and `) : sql`true`;

  // Query 1: how many match, plus the three numbers in the description.
  const c = await one<{ total: number; all_users: number; deployed_users: number; unnamed: number }>(sql`
    ${base}
    select (select count(*) from y where ${where})::int as total, (select count(*) from users)::int as all_users,
      (select count(distinct user_id) from profiles where mind_id is not null)::int as deployed_users, (select count(*) from users where username is null)::int as unnamed
  `);

  // Query 2: the rows, filtered and sorted in SQL.
  type Row = {
    id: string; username: string | null; email: string | null; email_verified: boolean; joined: number; name: string; hh_status: string; hh_raw: string;
    searches: number; jobs: number; kept: number; applied: number; cognition: number; last_search: number | null; last_session: number | null; last_seen: number | null;
    extension: boolean; extension_used: number | null; referrer_id: string | null; referrer_text: string; waiting: number; answers: number;
  };
  const list = await rows<Row>(sql`${base} select * from y where ${where} order by ${orderBy(USERS_SORT, params.sort, params.dir, "joined")} limit ${USERS_LIMIT}`);

  return {
    total: c.total,
    allUsers: c.all_users,
    deployedUsers: c.deployed_users,
    unnamed: c.unnamed,
    rows: list.map((r) => ({
      id: r.id, name: r.name, username: r.username, email: r.email, emailVerified: r.email_verified, createdAt: at(r.joined)!, hhStatus: r.hh_status, hhRaw: r.hh_raw,
      searches: r.searches, jobs: r.jobs, kept: r.kept, applied: r.applied, cognition: r.cognition, lastSearch: at(r.last_search), lastSeen: at(r.last_seen),
      extension: r.extension, extensionUsed: at(r.extension_used), referrer: r.referrer_text, referrerId: r.referrer_id ?? undefined, waiting: r.waiting, answers: r.answers,
    })),
  };
}

// ---- user detail -------------------------------------------------------------------------

export type UserDetail = {
  user: {
    id: string; username: string | null; email: string | null; emailVerifiedAt: Date | null; emailOnSearchDone: boolean; coachReminders: boolean; timezone: string | null; referralCode: string | null; referredBy: string | null;
    hmReferralUrl: string | null; personalMindId: string | null; personalMindName: string | null; scope: string | null; applicant: ApplicantDetails | null; savedAnswers: SavedAnswer[]; createdAt: Date;
  };
  referrer: { id: string; username: string | null } | null;
  sessions: { total: number; valid: number };
  profiles: {
    id: string; label: string; mindId: string | null; mindName: string | null; status: ProfileStatus; resumeFileName: string | null; briefedAt: Date | null; lastDeliveryAt: Date | null;
    searchStartedAt: Date | null; searchEndedAt: Date | null; balanceCache: number | null; balanceCachedAt: Date | null; createdAt: Date; preferences: Preferences | null;
  }[];
  main: UserDetail["profiles"][number] | undefined;
  totals: { searches: number; jobs: number; kept: number; applied: number; cognition: number };
  searches: { id: string; startedAt: Date; endedAt: Date | null; endReason: string | null; jobsWanted: number; jobsAdded: number | null; cognitionUsed: number | null; focus: string | null; label: string; minutes: number | null }[];
  jobs: { id: string; createdAt: Date; company: string; title: string; url: string; matchScore: number; place: string; status: JobStatus; statusChangedAt: Date | null }[];
  questions: { id: string; status: QuestionStatus; question: string; company: string | null; askedAt: Date }[];
  questionTotal: number;
  waiting: number;
  tokens: { id: string; createdAt: Date; lastUsedAt: Date | null }[];
  tokenTotal: number;
  made: { id: string; friendId: string; friend: string; status: string; createdAt: Date }[];
  received: { id: string; referrerId: string; referrer: string; status: string; createdAt: Date }[];
};

const USER_LIST_LIMIT = 500;

export const userDetail = (id: string) => memo(`user:${id}`, DETAIL_TTL, () => loadUserDetail(id));

async function loadUserDetail(id: string): Promise<UserDetail | null> {
  const u = schema.users;
  const ref = alias(schema.users, "referrer");
  // Query 1: the account, who referred them (by code), and the session counts.
  const [row] = await db
    .select({
      id: u.id, username: u.username, email: u.email, emailVerifiedAt: u.emailVerifiedAt, emailOnSearchDone: u.emailOnSearchDone, coachReminders: u.coachReminders, timezone: u.timezone, referralCode: u.referralCode, referredBy: u.referredBy,
      hmReferralUrl: u.hmReferralUrl, personalMindId: u.personalMindId, personalMindName: u.personalMindName, scope: u.scope, applicant: u.applicant, savedAnswers: u.savedAnswers, createdAt: u.createdAt,
      referrerId: ref.id, referrerName: ref.username,
      sessions: sql<number>`(select count(*) from ${schema.sessions} where ${schema.sessions.userId} = ${u.id})`.mapWith(Number),
      validSessions: sql<number>`(select count(*) from ${schema.sessions} where ${schema.sessions.userId} = ${u.id} and ${schema.sessions.expiresAt} > now())`.mapWith(Number),
    })
    .from(u)
    .leftJoin(ref, eq(ref.referralCode, u.referredBy))
    .where(eq(u.id, id))
    .limit(1);
  if (!row) return null;

  // Query 2: their headhunters (never the resume itself).
  const p = schema.profiles;
  const profiles = await db
    .select({
      id: p.id, label: p.label, mindId: p.mindId, mindName: p.mindName, status: p.status, resumeFileName: p.resumeFileName, briefedAt: p.briefedAt, lastDeliveryAt: p.lastDeliveryAt,
      searchStartedAt: p.searchStartedAt, searchEndedAt: p.searchEndedAt, balanceCache: p.balanceCache, balanceCachedAt: p.balanceCachedAt, createdAt: p.createdAt, preferences: p.preferences,
    })
    .from(p)
    .where(eq(p.userId, id))
    .orderBy(desc(p.createdAt))
    .limit(200);

  // Query 3: searches and jobs (newest first, capped) as JSON, with the totals over all of them.
  type S = { id: string; started: number; ended: number | null; end_reason: string | null; jobs_wanted: number; jobs_added: number | null; cognition_used: number | null; focus: string | null; label: string };
  type J = { id: string; created: number; company: string; title: string; url: string; match_score: number; city: string | null; country: string | null; status: JobStatus; changed: number | null };
  const mine = sql.raw(`join profiles p on p.id = x.profile_id where p.user_id = `);
  const activity = await one<{ searches: S[]; jobs: J[]; search_total: number; job_total: number; kept: number; applied: number; cognition: number }>(sql`
    select
      (select coalesce(json_agg(s), '[]'::json) from (
        select x.id, ${ms(sql.raw("x.started_at"))} as started, ${ms(sql.raw("x.ended_at"))} as ended, x.end_reason, x.jobs_wanted, x.jobs_added, x.cognition_used, x.focus, p.label
        from searches x ${mine} ${id} order by x.started_at desc limit ${USER_LIST_LIMIT}) s) as searches,
      (select coalesce(json_agg(j), '[]'::json) from (
        select x.id, ${ms(sql.raw("x.created_at"))} as created, x.company, x.title, x.url, x.match_score, x.city, x.country, x.status, ${ms(sql.raw("x.status_changed_at"))} as changed
        from jobs x ${mine} ${id} order by x.created_at desc limit ${USER_LIST_LIMIT}) j) as jobs,
      (select count(*) from searches x ${mine} ${id})::int as search_total,
      (select count(*) from jobs x ${mine} ${id})::int as job_total,
      (select count(*) from jobs x ${mine} ${id} and x.status in (${lit(KEPT)}))::int as kept,
      (select count(*) from jobs x ${mine} ${id} and x.status in (${lit(APPLIED_PLUS_LIST)}))::int as applied,
      (select coalesce(sum(x.cognition_used), 0) from searches x ${mine} ${id})::float8 as cognition
  `);

  // Query 4: the small lists as JSON: form questions, extension tokens, referrals both ways.
  type Q = { id: string; status: QuestionStatus; question: string; company: string | null; asked: number };
  type T = { id: string; created: number; last_used: number | null };
  type M = { id: string; friend_id: string; friend: string; status: string; created: number };
  type Rc = { id: string; referrer_id: string; referrer: string; status: string; created: number };
  const small = await one<{ questions: Q[]; question_total: number; waiting: number; tokens: T[]; token_total: number; made: M[]; received: Rc[] }>(sql`
    select
      (select coalesce(json_agg(q), '[]'::json) from (
        select q.id, q.status, q.question, q.company, ${ms(sql.raw("coalesce(q.asked_at, q.created_at)"))} as asked from questions q where q.user_id = ${id} order by q.created_at desc limit 200) q) as questions,
      (select count(*) from questions q where q.user_id = ${id})::int as question_total,
      (select count(*) from questions q where q.user_id = ${id} and q.status in (${lit(WAITING_QUESTION_LIST)}))::int as waiting,
      (select coalesce(json_agg(t), '[]'::json) from (
        select t.id, ${ms(sql.raw("t.created_at"))} as created, ${ms(sql.raw("t.last_used_at"))} as last_used from extension_tokens t where t.user_id = ${id} order by t.created_at desc limit 200) t) as tokens,
      (select count(*) from extension_tokens t where t.user_id = ${id})::int as token_total,
      (select coalesce(json_agg(m), '[]'::json) from (
        select r.id, r.referred_id as friend_id, coalesce(f.username, '(no name yet)') as friend, r.status, ${ms(sql.raw("r.created_at"))} as created
        from referrals r left join users f on f.id = r.referred_id where r.referrer_id = ${id} order by r.created_at desc limit 200) m) as made,
      (select coalesce(json_agg(m), '[]'::json) from (
        select r.id, r.referrer_id, coalesce(f.username, '(no name yet)') as referrer, r.status, ${ms(sql.raw("r.created_at"))} as created
        from referrals r left join users f on f.id = r.referrer_id where r.referred_id = ${id} order by r.created_at desc limit 200) m) as received
  `);

  const main = profiles.find((x) => x.status === "hunting" || x.status === "paused") ?? profiles[0];
  const { referrerId, referrerName, sessions, validSessions, ...account } = row;
  return {
    user: { ...account, applicant: account.applicant ?? null, savedAnswers: account.savedAnswers ?? [] },
    referrer: referrerId ? { id: referrerId, username: referrerName } : null,
    sessions: { total: sessions, valid: validSessions },
    profiles,
    main,
    totals: { searches: activity.search_total, jobs: activity.job_total, kept: activity.kept, applied: activity.applied, cognition: Math.round(activity.cognition) },
    searches: activity.searches.map((s) => ({
      id: s.id, startedAt: at(s.started)!, endedAt: at(s.ended), endReason: s.end_reason, jobsWanted: s.jobs_wanted, jobsAdded: s.jobs_added, cognitionUsed: s.cognition_used, focus: s.focus, label: s.label,
      minutes: mins(at(s.started)!, at(s.ended)),
    })),
    jobs: activity.jobs.map((j) => ({ id: j.id, createdAt: at(j.created)!, company: j.company, title: j.title, url: j.url, matchScore: j.match_score, place: [j.city, j.country].filter(Boolean).join(", "), status: j.status, statusChangedAt: at(j.changed) })),
    questions: small.questions.map((q) => ({ id: q.id, status: q.status, question: q.question, company: q.company, askedAt: at(q.asked)! })),
    questionTotal: small.question_total,
    waiting: small.waiting,
    tokens: small.tokens.map((t) => ({ id: t.id, createdAt: at(t.created)!, lastUsedAt: at(t.last_used) })),
    tokenTotal: small.token_total,
    made: small.made.map((m) => ({ id: m.id, friendId: m.friend_id, friend: m.friend, status: m.status, createdAt: at(m.created)! })),
    received: small.received.map((m) => ({ id: m.id, referrerId: m.referrer_id, referrer: m.referrer, status: m.status, createdAt: at(m.created)! })),
  };
}

// ---- applications ------------------------------------------------------------------------

export type ApplicationsParams = { stage?: string; stale?: boolean; sort: string; dir: Dir };
export type ApplicationRow = { id: string; who: string; userId?: string; company: string; title: string; url: string; status: JobStatus; changed: Date; age: number; stale: boolean };
export type Applications = {
  byStage: Record<string, number>;
  total: number;
  staleTotal: number;
  rows: ApplicationRow[];
  waitingTotal: number;
  waiting: { uid: string; name: string; n: number; oldest: Date; days: number }[];
};

const APPLICATIONS_LIMIT = 500;
const STALE_DAYS = 7;
const APPLICATIONS_SORT: Record<string, SQL> = {
  who: text("who"), company: text("company"), title: text("title"), stage: sql`array_position(${arr(STAGE_ORDER)}, status)`, changed: sql.raw("changed"), age: sql.raw("age"),
};

export const applications = (params: ApplicationsParams) => memo(`applications:${JSON.stringify(params)}`, TTL, () => loadApplications(params));

async function loadApplications(params: ApplicationsParams): Promise<Applications> {
  // Query 1: the pipeline tiles, every stage from saved to rejected.
  const stages = await db
    .select({ status: schema.jobs.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.jobs)
    .where(sql`${schema.jobs.status} in (${lit(PIPELINE)})`)
    .groupBy(schema.jobs.status);

  // Applied or further, with "stale" = applied more than 7 days ago and unchanged since.
  const filters: SQL[] = [sql`j.status in (${lit(APPLIED_PLUS_LIST)})`];
  if (params.stage) filters.push(sql`j.status = ${params.stage}`);
  const age = sql.raw(`floor(extract(epoch from (now() - coalesce(j.status_changed_at, j.created_at))) / 86400)::int`);
  const stale = sql`(j.status = 'applied' and ${age} > ${STALE_DAYS})`;
  if (params.stale) filters.push(stale);
  const from = sql`from jobs j left join profiles p on p.id = j.profile_id left join users u on u.id = p.user_id where ${sql.join(filters, sql` and `)}`;

  // Query 2: how many match, how many of those are stale, and how many questions wait overall.
  const c = await one<{ total: number; stale: number; waiting: number }>(sql`
    select count(*)::int as total, (count(*) filter (where ${stale}))::int as stale,
      (select count(*) from questions where status in (${lit(WAITING_QUESTION_LIST)}))::int as waiting
    ${from}
  `);

  // Query 3: the rows, sorted in SQL.
  type Row = { id: string; who: string; user_id: string | null; company: string; title: string; url: string; status: JobStatus; changed: number; age: number; stale: boolean };
  const list = await rows<Row>(sql`
    select * from (
      select j.id, ${WHO} as who, u.id as user_id, j.company, j.title, j.url, j.status, ${ms(sql.raw("coalesce(j.status_changed_at, j.created_at)"))} as changed, ${age} as age, ${stale} as stale ${from}
    ) t order by ${orderBy(APPLICATIONS_SORT, params.sort, params.dir, "changed")} limit ${APPLICATIONS_LIMIT}
  `);

  // Query 4: questions waiting, per person, oldest first.
  type W = { uid: string; name: string; n: number; oldest: number; days: number };
  const waiting = await rows<W>(sql`
    select q.user_id as uid, ${NAME} as name, count(*)::int as n, ${ms(sql.raw("min(q.created_at)"))} as oldest,
      floor(extract(epoch from (now() - min(q.created_at))) / 86400)::int as days
    from questions q left join users u on u.id = q.user_id
    where q.status in (${lit(WAITING_QUESTION_LIST)})
    group by q.user_id, u.username order by min(q.created_at) asc limit 200
  `);

  return {
    byStage: Object.fromEntries(stages.map((s) => [s.status, s.n])),
    total: c.total,
    staleTotal: c.stale,
    rows: list.map((r) => ({ id: r.id, who: r.who, userId: r.user_id ?? undefined, company: r.company, title: r.title, url: r.url, status: r.status, changed: at(r.changed)!, age: r.age, stale: r.stale })),
    waitingTotal: c.waiting,
    waiting: waiting.map((w) => ({ uid: w.uid, name: w.name, n: w.n, oldest: at(w.oldest)!, days: w.days })),
  };
}

// ---- growth ------------------------------------------------------------------------------

export type Growth = {
  keys: string[];
  signups: number;
  referredSignups: number;
  users: number;
  referrals: number;
  referrers: number;
  friendsDeployed: number;
  waitlistTotal: number;
  waitlistVerified: number;
  converted: number;
  series: { organic: number[]; referred: number[] };
  topReferrers: { id: string; name: string; code: string | null; n: number }[];
  referralRows: { id: string; createdAt: Date; friendId: string; friend: string; referrerId: string; referrer: string; status: string; deployed: boolean; spent: number }[];
  byCountry: [string, number][];
  byRole: [string, number][];
  waitlist: { id: string; createdAt: Date; name: string | null; email: string; country: string | null; roleArea: string | null; verified: boolean; referredBy: string | null; user: { id: string; name: string; createdAt: Date } | null }[];
};

export const growth = (days: number) => memo(`growth:${days}`, TTL, () => loadGrowth(days));

async function loadGrowth(days: number): Promise<Growth> {
  const since = daysAgo(days);
  const keys = dayKeys(days);

  // Query 1: the tiles. "Converted" means a waitlist email that is now an account's email.
  const s = await one<{ users: number; signups: number; referred: number; referrals: number; referrers: number; friends_deployed: number; waitlist: number; verified: number; converted: number }>(sql`
    select
      (select count(*) from users)::int as users,
      (select count(*) from users where created_at >= ${ts(since)})::int as signups,
      (select count(*) from users where created_at >= ${ts(since)} and nullif(referred_by, '') is not null)::int as referred,
      (select count(*) from referrals)::int as referrals,
      (select count(distinct referrer_id) from referrals)::int as referrers,
      (select count(*) from referrals r where exists (select 1 from profiles p where p.user_id = r.referred_id and p.mind_id is not null))::int as friends_deployed,
      (select count(*) from waitlist)::int as waitlist,
      (select count(verified_at) from waitlist)::int as verified,
      (select count(*) from waitlist w where exists (select 1 from users u where lower(u.email) = lower(w.email)))::int as converted
  `);

  // Query 2: the breakdowns: signups per day (organic vs referred), waitlist by country and
  // role area, and friends per referrer.
  type F = { kind: string; key: string; label: string | null; sub: string | null; n: number };
  const facets = await rows<F>(sql`
    select 'organic' as kind, ${dayOf(sql.raw("created_at"))} as key, null::text as label, null::text as sub, count(*)::int as n from users where created_at >= ${ts(since)} and nullif(referred_by, '') is null group by 2
    union all select 'referred', ${dayOf(sql.raw("created_at"))}, null, null, count(*)::int from users where created_at >= ${ts(since)} and nullif(referred_by, '') is not null group by 2
    union all select 'country', coalesce(country, 'unknown'), null, null, count(*)::int from waitlist group by 2
    union all select 'role', coalesce(role_area, 'unknown'), null, null, count(*)::int from waitlist group by 2
    union all select 'referrer', r.referrer_id::text, coalesce(u.username, '(no name yet)'), u.referral_code, count(*)::int from referrals r left join users u on u.id = r.referrer_id group by 2, 3, 4
  `);
  const of = (kind: string) => facets.filter((f) => f.kind === kind);

  // Query 3: every friend who joined through a link, newest first, with what they did since.
  type R = { id: string; created: number; friend_id: string; friend: string; referrer_id: string; referrer: string; status: string; deployed: boolean; spent: number };
  const refs = await rows<R>(sql`
    select r.id, ${ms(sql.raw("r.created_at"))} as created, r.referred_id as friend_id, coalesce(f.username, '(no name yet)') as friend, r.referrer_id, coalesce(u.username, '(no name yet)') as referrer, r.status,
      exists (select 1 from profiles p where p.user_id = r.referred_id and p.mind_id is not null) as deployed,
      round(coalesce((select sum(s.cognition_used) from searches s join profiles p on p.id = s.profile_id where p.user_id = r.referred_id), 0))::int as spent
    from referrals r left join users f on f.id = r.referred_id left join users u on u.id = r.referrer_id
    order by r.created_at desc limit 200
  `);

  // Query 4: the waitlist, newest first, each with the account that later used the same email.
  type W = { id: string; created: number; name: string | null; email: string; country: string | null; role_area: string | null; verified: boolean; referred_by: string | null; su_id: string | null; su_name: string | null; su_created: number | null };
  const wl = await rows<W>(sql`
    select w.id, ${ms(sql.raw("w.created_at"))} as created, w.name, w.email, w.country, w.role_area, w.verified_at is not null as verified, w.referred_by,
      su.id as su_id, coalesce(su.username, '(no name yet)') as su_name, ${ms(sql.raw("su.created_at"))} as su_created
    from waitlist w
    left join lateral (select u.id, u.username, u.created_at from users u where lower(u.email) = lower(w.email) order by u.created_at desc limit 1) su on true
    order by w.created_at desc limit 200
  `);

  return {
    keys,
    signups: s.signups,
    referredSignups: s.referred,
    users: s.users,
    referrals: s.referrals,
    referrers: s.referrers,
    friendsDeployed: s.friends_deployed,
    waitlistTotal: s.waitlist,
    waitlistVerified: s.verified,
    converted: s.converted,
    series: { organic: fill(keys, of("organic").map((f) => ({ key: f.key, v: f.n }))), referred: fill(keys, of("referred").map((f) => ({ key: f.key, v: f.n }))) },
    topReferrers: of("referrer").map((f) => ({ id: f.key, name: f.label ?? "?", code: f.sub, n: f.n })).sort((a, b) => b.n - a.n),
    referralRows: refs.map((r) => ({ id: r.id, createdAt: at(r.created)!, friendId: r.friend_id, friend: r.friend, referrerId: r.referrer_id, referrer: r.referrer, status: r.status, deployed: r.deployed, spent: r.spent })),
    byCountry: counts(of("country").map((f) => ({ key: f.key, n: f.n }))),
    byRole: counts(of("role").map((f) => ({ key: f.key, n: f.n }))),
    waitlist: wl.map((w) => ({
      id: w.id, createdAt: at(w.created)!, name: w.name, email: w.email, country: w.country, roleArea: w.role_area, verified: w.verified, referredBy: w.referred_by,
      user: w.su_id ? { id: w.su_id, name: w.su_name ?? "(no name yet)", createdAt: at(w.su_created)! } : null,
    })),
  };
}

// ---- costs -------------------------------------------------------------------------------

export type CostsParams = { days: number; sort: string; dir: Dir };
export type Costs = {
  keys: string[];
  searches: number;
  costed: number;
  cognition: number;
  jobs: number;
  perDay: number[];
  min: number | null;
  median: number | null;
  max: number | null;
  zeros: number;
  rows: { uid: string; name: string; searches: number; jobs: number; cognition: number; perJob: number | null; perSearch: number | null }[];
};

const COSTS_SORT: Record<string, SQL> = { name: text("name"), searches: sql.raw("searches"), jobs: sql.raw("jobs"), cognition: sql.raw("cognition"), perJob: sql.raw("per_job"), perSearch: sql.raw("per_search") };

export const costs = (params: CostsParams) => memo(`costs:${JSON.stringify(params)}`, TTL, () => loadCosts(params));

async function loadCosts(params: CostsParams): Promise<Costs> {
  const since = daysAgo(params.days);
  const keys = dayKeys(params.days);

  // Query 1: the tiles and the cost-per-search distribution, over searches started in the window.
  const s = await one<{ total: number; costed: number; cognition: number; jobs: number; min: number | null; median: number | null; max: number | null; zeros: number }>(sql`
    select count(*)::int as total, count(cognition_used)::int as costed, coalesce(sum(cognition_used), 0)::float8 as cognition, coalesce(sum(jobs_added), 0)::int as jobs,
      min(cognition_used)::float8 as min, (percentile_cont(0.5) within group (order by cognition_used))::float8 as median, max(cognition_used)::float8 as max,
      (count(*) filter (where cognition_used = 0))::int as zeros
    from searches where started_at >= ${ts(since)}
  `);

  // Query 2: cognition per day, by the day each search ended.
  const perDay = await rows<{ key: string; v: number }>(sql`
    select ${dayOf(sql.raw("coalesce(ended_at, started_at)"))} as key, sum(cognition_used)::float8 as v from searches where started_at >= ${ts(since)} and cognition_used is not null group by 1
  `);

  // Query 3: per user, sorted in SQL.
  type Row = { uid: string; name: string; searches: number; jobs: number; cognition: number; per_job: number | null; per_search: number | null };
  const list = await rows<Row>(sql`
    select * from (
      select p.user_id as uid, ${NAME} as name, count(*)::int as searches, coalesce(sum(s.jobs_added), 0)::int as jobs, round(coalesce(sum(s.cognition_used), 0))::int as cognition,
        (case when coalesce(sum(s.jobs_added), 0) > 0 then coalesce(sum(s.cognition_used), 0) / sum(s.jobs_added) end)::float8 as per_job,
        (coalesce(sum(s.cognition_used), 0) / count(*))::float8 as per_search
      from searches s join profiles p on p.id = s.profile_id join users u on u.id = p.user_id
      where s.started_at >= ${ts(since)} group by p.user_id, u.username
    ) t order by ${orderBy(COSTS_SORT, params.sort, params.dir, "cognition")} limit 200
  `);

  return {
    keys,
    searches: s.total,
    costed: s.costed,
    cognition: s.cognition,
    jobs: s.jobs,
    perDay: fill(keys, perDay),
    min: s.min,
    median: s.median,
    max: s.max,
    zeros: s.zeros,
    rows: list.map((r) => ({ uid: r.uid, name: r.name, searches: r.searches, jobs: r.jobs, cognition: r.cognition, perJob: r.per_job, perSearch: r.per_search })),
  };
}

// ---- system ------------------------------------------------------------------------------

export type Freshness = { at: Date | null; hours: number | null };
export type System = {
  sessions: number;
  tokens: number;
  questions: number;
  openSearches: number;
  logs24h: number;
  poolOpen: number;
  poolClosed: number;
  poolFresh: number;
  watchdog: { verified: Freshness; checked: Freshness; expired: Freshness };
  pool: { country: string | null; total: number; open: number }[];
  questionsByStatus: { status: string; n: number }[];
  tokensByUse: { last7: number; last30: number; older: number; never: number };
};

export const system = () => memo("system", TTL, loadSystem);

async function loadSystem(): Promise<System> {
  const now = daysAgo(0);
  // Query 1: every counter and the watchdog's newest timestamps, in one row.
  const s = await one<{
    sessions: number; tokens: number; questions: number; pool_open: number; pool_closed: number; pool_fresh: number; open_searches: number; logs_24h: number;
    verified_at: number | null; checked_at: number | null; expired_at: number | null; tok7: number; tok30: number; tok_never: number;
  }>(sql`
    select
      (select count(*) from sessions where expires_at >= now())::int as sessions,
      (select count(*) from extension_tokens)::int as tokens,
      (select count(*) from questions where status <> 'ignored')::int as questions,
      (select count(*) from postings where closed_at is null)::int as pool_open,
      (select count(*) from postings where closed_at is not null)::int as pool_closed,
      (select count(*) from postings where last_seen_at >= now() - interval '7 days')::int as pool_fresh,
      (select count(*) from profiles where search_started_at is not null and search_ended_at is null)::int as open_searches,
      (select count(*) from ingest_log where created_at >= now() - interval '1 day')::int as logs_24h,
      (select ${ms(sql.raw("max(last_verified_open_at)"))} from postings) as verified_at,
      (select ${ms(sql.raw("max(last_checked_at)"))} from postings) as checked_at,
      (select ${ms(sql.raw("max(status_changed_at)"))} from jobs where status = 'expired') as expired_at,
      (select count(*) from extension_tokens where last_used_at >= now() - interval '7 days')::int as tok7,
      (select count(*) from extension_tokens where last_used_at >= now() - interval '30 days' and last_used_at < now() - interval '7 days')::int as tok30,
      (select count(*) from extension_tokens where last_used_at is null)::int as tok_never
  `);

  // Query 2: the pool by country, top 10, open ones counted alongside.
  const pool = await db
    .select({ country: schema.postings.countryCode, total: sql<number>`count(*)`.mapWith(Number), open: sql<number>`count(*) filter (where ${schema.postings.closedAt} is null)`.mapWith(Number) })
    .from(schema.postings)
    .groupBy(schema.postings.countryCode)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // Query 3: questions by status.
  const qStatus = await db.select({ status: schema.questions.status, n: sql<number>`count(*)`.mapWith(Number) }).from(schema.questions).groupBy(schema.questions.status);

  const fresh = (v: number | null): Freshness => {
    const d = at(v);
    return { at: d, hours: d ? Math.round((now.getTime() - d.getTime()) / 3_600_000) : null };
  };
  return {
    sessions: s.sessions,
    tokens: s.tokens,
    questions: s.questions,
    openSearches: s.open_searches,
    logs24h: s.logs_24h,
    poolOpen: s.pool_open,
    poolClosed: s.pool_closed,
    poolFresh: s.pool_fresh,
    watchdog: { verified: fresh(s.verified_at), checked: fresh(s.checked_at), expired: fresh(s.expired_at) },
    pool,
    questionsByStatus: qStatus,
    tokensByUse: { last7: s.tok7, last30: s.tok30, older: Math.max(0, s.tokens - s.tok7 - s.tok30 - s.tok_never), never: s.tok_never },
  };
}
