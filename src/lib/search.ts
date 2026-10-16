import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { sendSearchDoneEmail } from "./email";
import { minds } from "./minds/client";
import { SAME_ROLE_DAYS } from "./dedupe";
import { track } from "./analytics/server";
import { mindsConfig } from "./minds/config";
import { FACTS_RULE, factsText } from "./facts";
import { DROP_LABELS, dropAdvice } from "./dropped";
import { postingAgeDays } from "./preferences";
import type { DropReason } from "@/db/schema";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
// The brief tells the Mind to stop at two hours; the app gives it half an hour of slack.
export const SEARCH_TIMEOUT_MS = 2.5 * 60 * 60 * 1000;

type SearchFields = Pick<Profile, "searchStartedAt" | "searchEndedAt">;

export function isSearching(p: SearchFields, now = Date.now()) {
  return !!p.searchStartedAt && !p.searchEndedAt && now - p.searchStartedAt.getTime() < SEARCH_TIMEOUT_MS;
}

// Links the Mind has already judged for this person: the user's jobs (any headhunter) and this
// headhunter's dropped leads, newest first. One line each so the Mind can match them by eye.
export async function skipLinks(userId: string, profileId: string, limit = 150) {
  const since = new Date(Date.now() - SAME_ROLE_DAYS * 86_400_000);
  const sent = await db
    .select({ url: schema.jobs.url, at: schema.jobs.createdAt })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.jobs.profileId, schema.profiles.id))
    .where(and(eq(schema.profiles.userId, userId), gte(schema.jobs.createdAt, since)))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit);
  const dropped = await db
    .select({ url: schema.leads.url, at: schema.leads.createdAt })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, profileId), gte(schema.leads.createdAt, since), isNotNull(schema.leads.url)))
    .orderBy(desc(schema.leads.createdAt))
    .limit(limit);
  const seen = new Set<string>();
  return [...sent, ...dropped]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .map((r) => r.url!)
    .filter((u) => u && !seen.has(u) && seen.add(u))
    .slice(0, limit);
}

// Hosts that blocked the Mind in the last week, so it doesn't burn time on them again.
export async function blockedHosts(profileId: string) {
  const rows = await db
    .selectDistinct({ url: schema.leads.url })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, profileId), eq(schema.leads.reason, "unreachable"), gte(schema.leads.createdAt, new Date(Date.now() - 7 * 86_400_000)), isNotNull(schema.leads.url)));
  const hosts = new Set<string>();
  for (const r of rows) {
    try {
      hosts.add(new URL(r.url!).hostname.replace(/^www\./, ""));
    } catch {}
  }
  return [...hosts].slice(0, 30);
}

// One line about the previous search, from the summary the app wrote when it ended.
export async function lastSearchLine(profileId: string) {
  const row = await db.query.searches.findFirst({
    where: and(eq(schema.searches.profileId, profileId), isNotNull(schema.searches.endedAt)),
    orderBy: desc(schema.searches.startedAt),
    columns: { summary: true },
  });
  return row?.summary ? `Last time: ${row.summary}` : "";
}

export function searchRequestText(args: {
  username: string;
  jobs: number;
  n: number;
  focus?: string;
  skip?: string[];
  blocked?: string[];
  lastTime?: string;
  maxAgeDays?: number;
  resumeChanged?: boolean;
  facts?: string;
}) {
  const { username, jobs, n, focus, skip = [], blocked = [], lastTime = "", maxAgeDays, resumeChanged = false, facts = "" } = args;
  const base = mindsConfig.ingestUrl;
  const resume = resumeChanged
    ? "My resume changed: the new file is attached. Read it once, replace the copy in your memory with its full text, and quote only this one from now on."
    : "Use the copy of my resume you already saved; don't re-read the file.";
  return [
    `SEARCH REQUEST #${n} from ${username}. ${resume}`,
    `Find up to ${jobs} jobs now. Follow THE LADDER in your brief, rung by rung, and widen only when a rung is dry. Every check in the brief applies.`,
    `Rung 0, check first: GET ${base}/api/leads with header "x-unemploy-key" (your key from the brief). It lists postings seen open recently that may fit me. Confirm each is still open and passes every check before sending; none is pre-approved.`,
    `POST each job to ${base}/api/ingest as soon as it passes (use this address even if your brief says another). Format: GET ${base}/api/ingest?brief=1 once if you are unsure of the fields. Dry-run at most once, then POST directly. Cards only: no cover letter, answers or form questions during the search. I ask for packs separately, for the jobs I keep.`,
    `Progress notes: one line, only when something changes. Dropped leads go in "dropped" on your next POST, with "posting" attached whenever you opened the page.`,
    maxAgeDays ? `Posting age for this search: up to ${maxAgeDays} days old (this replaces the number in your brief).` : "",
    focus ? `For this search only, focus on: ${focus}. Every check in the brief still applies.` : "",
    lastTime,
    blocked.length ? `These hosts blocked you recently; skip them this search: ${blocked.join(", ")}.` : "",
    skip.length ? `SKIP LIST, already judged, do not open again:\n${skip.join("\n")}` : "",
    facts ? `${facts}\n${FACTS_RULE} This replaces anything in your brief that says such questions are not yours to answer.` : "",
    `When you have stopped for good, POST {"jobs":[],"final":true} with one line on how it went. "final" closes the search, so never put it on a mid-search push. If you can't reach ${base}, reply once to say so, then stop. Then wait for my next request. (${new Date().toISOString()})`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---- Application packs, written on request ---------------------------------------------
// A search delivers cards only. When the person keeps a job, the headhunter is asked to open
// its application form and write the pack. The Mind is switched on for that and off again when
// the packs land (or after PACK_TIMEOUT_MS, from the live poll's housekeeping).

const PACK_RETRY_MS = 45 * 60_000; // ask again for a pack this old and still missing
const PACK_TIMEOUT_MS = 40 * 60_000;

// Kept jobs with no pack yet.
export async function jobsNeedingPacks(profileId: string) {
  return db
    .select({ id: schema.jobs.id, url: schema.jobs.url, title: schema.jobs.title, company: schema.jobs.company, packRequestedAt: schema.jobs.packRequestedAt })
    .from(schema.jobs)
    .leftJoin(schema.packs, eq(schema.packs.jobId, schema.jobs.id))
    .where(and(eq(schema.jobs.profileId, profileId), eq(schema.jobs.status, "saved"), isNull(schema.packs.jobId)))
    .orderBy(desc(schema.jobs.statusChangedAt))
    .limit(30);
}

export function packRequestText(username: string, jobs: { title: string; company: string; url: string }[], facts: string) {
  const base = mindsConfig.ingestUrl;
  return [
    `PACK REQUEST from ${username}. I kept ${jobs.length === 1 ? "this job" : `these ${jobs.length} jobs`}; write the application pack for ${jobs.length === 1 ? "it" : "each"} now.`,
    jobs.map((j, i) => `${i + 1}. ${j.title} at ${j.company}: ${j.url}`).join("\n"),
    `For each: open the posting and its application form, copy every question into "formQuestions" (skip name, email, phone, resume and cover letter), and write the pack in English as your brief's WRITING RULES say: cover letter, a short "about me", an answer for every form question about the job, the company or why I fit it, and "claims" quoting my resume. POST {"packs":[{"url","formQuestions","pack"}]} to ${base}/api/ingest with your key, one pack per push is fine, as soon as each is written. Do not search for new jobs now; packs only.`,
    facts ? `${facts}\n${FACTS_RULE}` : "",
    `Reply with one line when all are sent. (${new Date().toISOString()})`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Asks the headhunter for the packs of kept jobs that have none. Safe to call often: each job
// is claimed before the message goes out, so two swipes close together send one request.
export async function requestPacks(profileId: string) {
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
  if (!profile?.mindId || !profile.conversationAlias || profile.status !== "hunting") return;
  if (isSearching(profile)) return; // the end of the search asks for them
  const due = (await jobsNeedingPacks(profile.id)).filter((j) => !j.packRequestedAt || Date.now() - j.packRequestedAt.getTime() > PACK_RETRY_MS);
  if (!due.length) return;
  const claimed = await db
    .update(schema.jobs)
    .set({ packRequestedAt: new Date() })
    .where(and(inArray(schema.jobs.id, due.map((j) => j.id)), or(isNull(schema.jobs.packRequestedAt), lt(schema.jobs.packRequestedAt, new Date(Date.now() - PACK_RETRY_MS)))))
    .returning({ id: schema.jobs.id, url: schema.jobs.url, title: schema.jobs.title, company: schema.jobs.company });
  if (!claimed.length) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  const api = minds(user);
  await api.setEnabled(profile.mindId, true);
  await api.sendMessage(profile.conversationAlias, packRequestText(user.username ?? "me", claimed, factsText(user)));
  await db.update(schema.profiles).set({ packRequestedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  track(profile.userId, "packs_requested", { jobs: claimed.length });
}

// Housekeeping from the live poll: a Mind left on for packs goes off once they have landed,
// or after the timeout, so nothing keeps spending.
export async function sleepIfPacksDone(profile: Profile) {
  if (!profile.packRequestedAt || isSearching(profile)) return;
  const pending = await jobsNeedingPacks(profile.id);
  if (pending.length && Date.now() - profile.packRequestedAt.getTime() < PACK_TIMEOUT_MS) return;
  await switchOff(profile);
  await db.update(schema.profiles).set({ packRequestedAt: null }).where(eq(schema.profiles.id, profile.id));
}

// If a search has run this long with nothing delivered, the headhunter is asked once to send
// the jobs it has already checked. Runs in the background (activity polls and the watchdog).
const NUDGE_AFTER_MS = 25 * 60 * 1000;

export async function nudgeIfQuiet(profile: Profile) {
  if (!isSearching(profile) || !profile.conversationAlias || !profile.searchStartedAt) return;
  if (Date.now() - profile.searchStartedAt.getTime() < NUDGE_AFTER_MS) return;
  const delivered = await db.query.ingestLog.findFirst({
    where: and(eq(schema.ingestLog.profileId, profile.id), eq(schema.ingestLog.dryRun, false), gte(schema.ingestLog.createdAt, profile.searchStartedAt)),
  });
  if (delivered) return;
  // Claim the nudge first so concurrent polls send it only once.
  const claimed = await db
    .update(schema.searches)
    .set({ nudgedAt: new Date() })
    .where(and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt), isNull(schema.searches.nudgedAt)))
    .returning({ id: schema.searches.id });
  if (!claimed.length) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  await minds(user)
    .sendMessage(
      profile.conversationAlias,
      `${user.username} here, about the search you're running: please POST the jobs that have already passed every check to ` +
        `${mindsConfig.ingestUrl}/api/ingest now, without "final", so I can start on them. Then keep searching and send each ` +
        `new job as soon as it's checked. Mark the end with {"jobs":[],"final":true}. (${new Date().toISOString()})`,
    )
    .catch((e) => console.error("[search] nudge failed", profile.id, e));
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
  // Jobs kept during the search still need their packs; that wakes the Mind again briefly.
  await requestPacks(profile.id).catch((e) => console.error("[search] pack request failed", profile.id, e));
}

// Closes the search's history row: when, why, jobs added, what it opened, the balance after,
// and one line about how it went that the next request carries back to the Mind.
async function recordEnd(profile: Profile, reason: "finished" | "stopped" | "timeout") {
  const row = await db.query.searches.findFirst({
    where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)),
    orderBy: desc(schema.searches.startedAt),
  });
  if (!row) return;
  // Jobs are tied to the search since October 2026; older rows fall back to the time window.
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profile.id), or(eq(schema.jobs.searchId, row.id), and(isNull(schema.jobs.searchId), gte(schema.jobs.createdAt, row.startedAt)))));
  const drops = await db
    .select({ reason: schema.leads.reason, n: count() })
    .from(schema.leads)
    .where(eq(schema.leads.searchId, row.id))
    .groupBy(schema.leads.reason);
  const droppedTotal = drops.reduce((a, r) => a + r.n, 0);
  const top = [...drops].sort((x, y) => y.n - x.n)[0];
  const opened = n + droppedTotal;
  const summary =
    `opened ${opened}, sent ${n} of ${row.jobsWanted}` +
    (top && droppedTotal ? `, most drops were ${DROP_LABELS[top.reason as DropReason] ?? top.reason} (${top.n})` : "") +
    (row.poolHits ? `, ${row.poolHits} from the check-first list` : "") +
    `, ended: ${reason}`;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  const api = user ? minds(user) : null;
  const balanceEnd = api && profile.mindId ? await api.getBalance(profile.mindId).catch(() => null) : null;
  // The ledger is bucketed by the hour, so read from the start of the hour the search began in.
  const since = new Date(row.startedAt);
  since.setUTCMinutes(0, 0, 0);
  const ledger = api && profile.mindId ? await api.toolUsage(profile.mindId, since).catch(() => null) : null;
  const fromLedger = ledger ? Math.round(ledger.reduce((a, u) => a + u.cognition, 0)) : null;
  const fromBalance = row.balanceStart != null && balanceEnd != null ? Math.max(0, Math.round(row.balanceStart - balanceEnd)) : null;
  const cognitionUsed = fromLedger ?? fromBalance;
  await db
    .update(schema.searches)
    .set({ endedAt: new Date(), endReason: reason, jobsAdded: n, opened, summary, balanceEnd, cognitionUsed })
    .where(eq(schema.searches.id, row.id));
  // Cognition burn, per search: what it cost, what it found, how long it took, what's left.
  track(profile.userId, "search_finished", {
    reason,
    jobs_found: n,
    jobs_wanted: row.jobsWanted,
    opened,
    pool_hits: row.poolHits,
    cognition_used: cognitionUsed,
    cognition_per_job: cognitionUsed != null && n > 0 ? Math.round(cognitionUsed / n) : null,
    balance_after: balanceEnd,
    minutes: Math.round((Date.now() - row.startedAt.getTime()) / 60_000),
  });
}

async function emailResults(profile: Profile, timedOut: boolean) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return;
  const since = profile.searchStartedAt ?? new Date(Date.now() - SEARCH_TIMEOUT_MS);
  const jobs = await db.query.jobs.findMany({
    where: and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, since), inArray(schema.jobs.status, ["new", "saved"])),
    orderBy: desc(schema.jobs.matchScore),
  });
  const search = await db.query.searches.findFirst({ where: eq(schema.searches.profileId, profile.id), orderBy: desc(schema.searches.startedAt) });
  const short = search && (search.jobsAdded ?? 0) < search.jobsWanted ? await shortLine(profile, search) : undefined;
  await sendSearchDoneEmail({
    to: user.email,
    mindName: profile.mindName ?? "Your headhunter",
    label: profile.label,
    timedOut,
    short,
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

// Why the search came back short, and the one change most likely to help, as one sentence.
async function shortLine(profile: Profile, search: { id: string; jobsWanted: number; jobsAdded: number | null }) {
  if (!profile.preferences) return undefined;
  const drops = await db.select({ reason: schema.leads.reason, n: count() }).from(schema.leads).where(eq(schema.leads.searchId, search.id)).groupBy(schema.leads.reason);
  const counts = new Map(drops.map((r) => [r.reason as DropReason, r.n]));
  const total = drops.reduce((a, r) => a + r.n, 0);
  const p = profile.preferences;
  const top = [...drops].sort((x, y) => y.n - x.n)[0];
  const why = top && total ? ` Most of what it opened was ${DROP_LABELS[top.reason as DropReason] ?? top.reason}.` : "";
  const fix = dropAdvice(counts, total, p.country, p.workSettings.length === 1 && p.workSettings[0] === "remote", postingAgeDays(p));
  return `It looked for ${search.jobsWanted} and found ${search.jobsAdded ?? 0}.${why}${fix ? ` ${fix}` : ""}`;
}

export async function switchOff(profile: Profile) {
  if (!profile.mindId) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  await minds(user)
    .setEnabled(profile.mindId, false)
    .catch((e) => console.error("[search] couldn't switch the Mind off", profile.id, e));
}
