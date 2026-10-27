import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { FormQuestion, Profile, SearchOverrides } from "@/db/schema";
import { discoveryHints } from "./discovery";
import { fetchFormQuestions } from "./forms";
import { sendSearchDoneEmail, unsubscribeLink } from "./email";
import { referralCodeFor } from "./referrals";
import { minds } from "./minds/client";
import { SAME_ROLE_DAYS } from "./dedupe";
import { track } from "./analytics/server";
import { mindsConfig, topUpUrlFor } from "./minds/config";
import { searchOutcome } from "./outcome";
import { FACTS_RULE, factsText } from "./facts";
import { DROP_LABELS, dropAdvice } from "./dropped";
import { PACK_RULES } from "./brief";
import { rotateKey } from "./keys";
import { postingAgeDays } from "./preferences";
import { gapsOf } from "./match";
import { trustsStaged } from "./minds/balance";
import type { DropReason } from "@/db/schema";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
// The brief tells the Mind to stop at two hours; the app gives it half an hour of slack.
export const SEARCH_TIMEOUT_MS = 2.5 * 60 * 60 * 1000;
// Resume text sent in messages is cut here; a page and a half of plain text covers any resume.
export const RESUME_TEXT_MAX = 9000;

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
// Hosts that are whole job systems. One page there that would not load says nothing about the
// rest, so they never go on the blocked list (an "ashby skipped" line once killed a whole rung).
const JOB_SYSTEM_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com", "myworkdayjobs.com", "workday.com", "bamboohr.com", "jobvite.com", "icims.com", "recruitee.com", "personio.de", "personio.com", "teamtailor.com", "breezy.hr", "applytojob.com", "rippling.com", "linkedin.com", "indeed.com", "glassdoor.com", "wellfound.com"];
const isJobSystem = (host: string) => JOB_SYSTEM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

export async function blockedHosts(profileId: string) {
  const rows = await db
    .selectDistinct({ url: schema.leads.url })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, profileId), eq(schema.leads.reason, "unreachable"), gte(schema.leads.createdAt, new Date(Date.now() - 7 * 86_400_000)), isNotNull(schema.leads.url)));
  const hosts = new Set<string>();
  for (const r of rows) {
    try {
      const host = new URL(r.url!).hostname.replace(/^www\./, "");
      if (!isJobSystem(host)) hosts.add(host);
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
  employers?: string[]; // companies near the person that post their kind of role, from the pool
  lastTime?: string;
  maxAgeDays?: number;
  resumeChanged?: boolean;
  facts?: string;
  resumeText?: string; // the resume as text, sent with every request so no file is ever read
  budget?: { searches: number; opened: number }; // this search's cap, when it differs from the brief
  firstSearch?: string; // one line on the wider net a first search (or a same-day follow-up) casts
}) {
  const { username, jobs, n, focus, skip = [], blocked = [], employers = [], lastTime = "", maxAgeDays, resumeChanged = false, facts = "", resumeText = "", budget, firstSearch = "" } = args;
  const base = mindsConfig.ingestUrl;
  const resume = resumeText
    ? `${resumeChanged ? "My resume changed; the new text is at the end of this message and replaces the old one." : "My resume's full text is at the end of this message."} Quote from it; do not open any file for it.`
    : resumeChanged
      ? "My resume changed: the new file is attached. Read it once, replace the copy in your memory with its full text, and quote only this one from now on."
      : "My resume is attached in case you need it. Use the copy already in your memory; only if you no longer have its text, read the attached file once and keep it. Never stop to ask me for it.";
  return [
    `SEARCH REQUEST #${n} from ${username}. ${resume}`,
    `Find up to ${jobs} jobs now. Follow THE LADDER in your brief, rung by rung, and widen only when a rung is dry. Every check in the brief applies.`,
    `Rung 0, check first: GET ${base}/api/leads with header "x-unemploy-key" (your key from the brief). It lists postings seen open recently that may fit me. Confirm each is still open and passes every check before sending; none is pre-approved.`,
    `POST each job to ${base}/api/ingest as soon as it passes (use this address even if your brief says another). Format: GET ${base}/api/ingest?brief=1 once if you are unsure of the fields. Dry-run at most once, then POST directly. Cards only: no cover letter, answers or form questions during the search. I ask for packs separately, for the jobs I keep.`,
    `Progress notes: one line, only when something changes. Dropped leads go in "dropped" on your next POST, one short line each, with "posting" on every poor_fit, not_eligible, work_setting or duplicate drop whose page you saw (step 5 of your brief). Keep to the BUDGET in your brief: at most ${budget?.searches ?? 12} web searches and ${budget?.opened ?? 40} opened postings${budget ? " (these numbers replace the ones in your brief, for this search only)" : ""}.`,
    firstSearch,
    employers.length ? `Employers near me that post my kind of role: ${employers.join(", ")}. In rung 1, open each one's careers page before searching the web; a careers page lists every open role at once.` : "",
    maxAgeDays ? `Posting age for this search: up to ${maxAgeDays} days old (this replaces the number in your brief).` : "",
    focus ? `For this search only, focus on: ${focus}. Every check in the brief still applies.` : "",
    lastTime,
    blocked.length ? `These hosts blocked you recently; skip them this search: ${blocked.join(", ")}.` : "",
    skip.length ? `SKIP LIST, already judged, do not open again:\n${skip.join("\n")}` : "",
    facts ? `${facts}\n${FACTS_RULE} This replaces anything in your brief that says such questions are not yours to answer.` : "",
    resumeText ? `MY RESUME, full text.\n${resumeText}` : "",
    `When you have stopped for good, POST {"jobs":[],"final":true,"note":"<one line on how it went>"}. "final" closes the search, so never put it on a mid-search push. If you can't reach ${base}, reply once to say so, then stop. Then wait for my next request. (${new Date().toISOString()})`,
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

export type PackJob = { title: string; company: string; url: string; questions?: FormQuestion[] | null };

// One job's lines in a pack request. When the app could read the form, its questions are listed
// and the Mind must not open the form at all; otherwise the Mind reads the form as before.
function packJobText(j: PackJob, i: number) {
  const head = `${i + 1}. ${j.title} at ${j.company}: ${j.url}`;
  if (!j.questions) return `${head}\n   Form questions: not read by the app. Open the application form once, copy its questions into "formQuestions", and answer them.`;
  if (!j.questions.length) return `${head}\n   Form questions: none beyond name, contact details and resume. Do not open the form. Send "formQuestions": [].`;
  const qs = j.questions.map((q) => `   - ${q.question}${q.options?.length ? ` (choose one: ${q.options.slice(0, 12).join(" / ")}${q.options.length > 12 ? " / …" : ""})` : ""}${q.required ? " (required)" : ""}`).join("\n");
  return `${head}\n   Form questions, read by the app from the form itself. Do not open the form, do not run code; answer from this list and send it back as "formQuestions":\n${qs}`;
}

export function packRequestText(username: string, jobs: PackJob[], facts: string, resumeText = "", key = "") {
  const base = mindsConfig.ingestUrl;
  return [
    `PACK REQUEST from ${username}. I kept ${jobs.length === 1 ? "this job" : `these ${jobs.length} jobs`}; write the application pack for ${jobs.length === 1 ? "it" : "each"} now.`,
    jobs.map(packJobText).join("\n\n"),
    `For each: open the posting itself once for the job's wording, then write the pack in English: cover letter, a short "about me", an answer for every form question about the job, the company or why I fit it, and "claims" quoting my resume. Skip questions about gender, ethnicity, disability or veteran status. POST {"packs":[{"url","formQuestions","pack"}]} to ${base}/api/ingest with your key, one pack per push is fine, as soon as each is written. Never run code. Do not search for new jobs now; packs only.`,
    key ? `Your key for the x-unemploy-key header, for this and every later request: ${key}` : "",
    `WRITING RULES\n${PACK_RULES}`,
    `${facts ? `${facts}\n` : ""}${FACTS_RULE}`,
    resumeText ? `MY RESUME, full text. Quote from this; do not open any file.\n${resumeText}` : "",
    `Reply with one line when all are sent. (${new Date().toISOString()})`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// What one pack costs on the ledger once the app hands over the form questions: a page read for
// the posting and the writing. Asking for packs the Mind can't pay for only drives the balance
// below zero, which Hello Minds allows.
export const PACK_COGNITION = 15;

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
  const balance = await api.getBalance(profile.mindId, trustsStaged(profile)).catch(() => null);
  if (balance != null && balance < PACK_COGNITION * claimed.length) {
    // Not enough to write them. Release the claim so the next visit, after a top-up, asks again.
    await db.update(schema.jobs).set({ packRequestedAt: null }).where(inArray(schema.jobs.id, claimed.map((j) => j.id)));
    track(profile.userId, "packs_unaffordable", { jobs: claimed.length, balance: Math.round(balance) });
    return;
  }
  // The form's questions, read from the job system here so the Mind doesn't open the form.
  const jobs: PackJob[] = await Promise.all(
    claimed.map(async (j) => {
      const questions = await fetchFormQuestions(j.url);
      if (questions) await db.update(schema.jobs).set({ formQuestions: questions }).where(eq(schema.jobs.id, j.id));
      return { ...j, questions };
    }),
  );
  await api.setEnabled(profile.mindId, true);
  await api.sendMessage(profile.conversationAlias, packRequestText(user.username ?? "me", jobs, factsText(user), profile.resumeText?.slice(0, RESUME_TEXT_MAX) ?? "", await rotateKey(profile.id)));
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
  // Nothing arrived in 25 minutes. One common reason is a key the Mind no longer has right, which
  // turns every push into a 401 it may not mention. A fresh key rides along with the nudge.
  const key = await rotateKey(profile.id);
  await minds(user)
    .sendMessage(
      profile.conversationAlias,
      `${user.username} here, about the search you're running: please POST the jobs that have already passed every check to ` +
        `${mindsConfig.ingestUrl}/api/ingest now, without "final", so I can start on them. Then keep searching and send each ` +
        `new job as soon as it's checked. Mark the end with {"jobs":[],"final":true}. ` +
        `From now on use this key in the x-unemploy-key header, for every request, in place of the one in your brief: ${key} (${new Date().toISOString()})`,
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
export type EndReason = "finished" | "stopped" | "timeout" | "no_cognition";

export async function endSearch(profile: Profile, reason: EndReason = "finished", note?: string) {
  const ended = await db
    .update(schema.profiles)
    .set({ searchEndedAt: new Date() })
    .where(and(eq(schema.profiles.id, profile.id), isNull(schema.profiles.searchEndedAt)))
    .returning({ id: schema.profiles.id });
  if (!ended.length) return;
  // The row is closed; the copy in hand must say so too, or the email's "what to do next" card
  // thinks the search is still running and falls back to the old one-liner.
  profile = { ...profile, searchEndedAt: new Date() };
  await switchOff(profile);
  await recordEnd(profile, reason, note).catch((e) => console.error("[search] record failed", profile.id, e));
  if (reason !== "stopped") await emailResults(profile, reason).catch((e) => console.error("[search] email failed", profile.id, e));
  // Jobs kept during the search still need their packs; that wakes the Mind again briefly.
  await requestPacks(profile.id).catch((e) => console.error("[search] pack request failed", profile.id, e));
}

export type ToolUsage = Record<string, { calls: number; cognition: number }>;
export function usageByTool(ledger: { tool: string; calls: number; cognition: number }[]): ToolUsage {
  const out: ToolUsage = {};
  for (const u of ledger) {
    const t = (out[u.tool] ??= { calls: 0, cognition: 0 });
    t.calls += u.calls;
    t.cognition += u.cognition;
  }
  for (const t of Object.values(out)) t.cognition = Math.round(t.cognition);
  return out;
}

// Closes the search's history row: when, why, jobs added, what it opened, the balance after,
// and one line about how it went that the next request carries back to the Mind.
async function recordEnd(profile: Profile, reason: EndReason, note?: string) {
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
    `, ended: ${reason}` +
    (note ? `, note: ${note.replace(/\s+/g, " ").slice(0, 200)}` : "");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  const api = user ? minds(user) : null;
  const balanceEnd = api && profile.mindId ? await api.getBalance(profile.mindId, trustsStaged(profile)).catch(() => null) : null;
  // The ledger is bucketed by the hour, so read from the start of the hour the search began in.
  const since = new Date(row.startedAt);
  since.setUTCMinutes(0, 0, 0);
  const ledger = api && profile.mindId ? await api.toolUsage(profile.mindId, since).catch(() => null) : null;
  const fromLedger = ledger ? Math.round(ledger.reduce((a, u) => a + u.cognition, 0)) : null;
  // Where it went, per tool: web searches, pages opened, files, thinking. Admin shows it.
  const toolUsage = ledger ? usageByTool(ledger) : null;
  const fromBalance = row.balanceStart != null && balanceEnd != null ? Math.max(0, Math.round(row.balanceStart - balanceEnd)) : null;
  const cognitionUsed = fromLedger ?? fromBalance;
  await db
    .update(schema.searches)
    .set({ endedAt: new Date(), endReason: reason, jobsAdded: n, opened, summary, balanceEnd, cognitionUsed, toolUsage })
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

async function emailResults(profile: Profile, reason: EndReason) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return;
  const since = profile.searchStartedAt ?? new Date(Date.now() - SEARCH_TIMEOUT_MS);
  const jobs = await db.query.jobs.findMany({
    where: and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, since), inArray(schema.jobs.status, ["new", "saved"])),
    orderBy: desc(schema.jobs.matchScore),
  });
  const search = await db.query.searches.findFirst({ where: eq(schema.searches.profileId, profile.id), orderBy: desc(schema.searches.startedAt) });
  // A morning search that found nothing sends no email of its own: the follow-up may still
  // deliver, and the day's one email (see lib/morning) says what to change if it does not.
  if ((search?.via === "morning" || search?.via === "followup") && jobs.length === 0) return;
  const outcome = search && (search.jobsAdded ?? 0) < search.jobsWanted ? await searchOutcome(profile, { topUpUrl: topUpUrlFor(profile.mindId) }).catch(() => null) : null;
  const short = outcome ? `${outcome.headline} ${outcome.body}` : search && (search.jobsAdded ?? 0) < search.jobsWanted ? await shortLine(profile, search) : undefined;
  await sendSearchDoneEmail({
    to: user.email,
    mindName: profile.mindName ?? "Your headhunter",
    label: profile.label,
    timedOut: reason === "timeout",
    noCognition: reason === "no_cognition",
    short,
    share: `${mindsConfig.appUrl}/r/${await referralCodeFor(user.id)}`,
    unsubscribe: unsubscribeLink(user.id),
    link: `${mindsConfig.appUrl}/app?profile=${profile.id}`,
    jobs: jobs.map((j) => ({
      title: j.title,
      company: j.company,
      matchScore: j.matchScore,
      gaps: gapsOf(j.mustHaves),
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


// ---- When the Mind's pushes never arrive -------------------------------------------------
// The Mind can finish a search and tell us so in chat while every push it made was refused (a
// key it no longer has right). The app reads the chat: a report of "final" with nothing received
// gets a fresh key and one request to resend; a second quiet spell closes the search with the
// reason on record, so the person sees a card instead of a search that never ends.

const DONE_WORDS = /\b(final push|posting (the )?final|posted (the )?final|final is posted|closed and posted|is finished|have finished|search (is )?(closed|complete|done)|all rungs? (swept|exhausted))\b/i;
const RESEND_WAIT_MS = 15 * 60 * 1000;

export async function sendFreshKey(profile: Profile, why: string) {
  if (!profile.conversationAlias || !profile.mindId) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  const key = await rotateKey(profile.id);
  await minds(user).sendMessage(
    profile.conversationAlias,
    `${user.username ?? "me"} here. ${why} Use this key in the x-unemploy-key header for every request from now on: ${key}. ` +
      `If you have jobs or dropped leads from the current search that never got through, POST them to ${mindsConfig.ingestUrl}/api/ingest again now, then your final. (${new Date().toISOString()})`,
  );
}

export async function reconcileFromChat(profile: Profile): Promise<"none" | "resend_asked" | "closed"> {
  if (!profile.searchStartedAt || profile.searchEndedAt || !profile.conversationAlias) return "none";
  const since = profile.searchStartedAt.getTime();
  const pushed = await db.query.ingestLog.findFirst({ where: and(eq(schema.ingestLog.profileId, profile.id), eq(schema.ingestLog.dryRun, false), gte(schema.ingestLog.createdAt, profile.searchStartedAt)), columns: { id: true } });
  if (pushed) return "none";
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return "none";
  const replies = (await minds(user).history(profile.conversationAlias, 20).catch(() => [])).filter((m) => m.fromMind && m.at.getTime() >= since);
  const done = replies.find((m) => DONE_WORDS.test(m.text));
  if (!done) return "none";
  const open = await db.query.searches.findFirst({ where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)), columns: { id: true, nudgedAt: true } });
  if (!open) return "none";
  if (!open.nudgedAt) {
    await db.update(schema.searches).set({ nudgedAt: new Date() }).where(eq(schema.searches.id, open.id));
    await sendFreshKey(profile, "You said this search is finished, but nothing you sent reached the app, which usually means the key was refused.");
    return "resend_asked";
  }
  if (Date.now() - open.nudgedAt.getTime() < RESEND_WAIT_MS) return "none";
  await endSearch(profile, "finished", "the headhunter reported finishing but nothing it sent reached the app");
  return "closed";
}


// ---- An early "final" ----------------------------------------------------------------------
// The person asked for N and paid for a budget. A Mind that posts final with the quota unmet and
// most of the budget unspent is told to carry on, once, within that same budget: wider titles,
// job-board results as leads to the employer's page, and near-misses as low-scored cards.

const CONTINUE_BELOW = 0.6; // share of the search budget used; under this, an early final is refused

export async function continueIfEarly(profile: Profile, search: { id: string; startedAt: Date; overrides: SearchOverrides | null }, remaining: number, wanted: number): Promise<string | null> {
  if (remaining <= 0 || !profile.mindId || !profile.conversationAlias || search.overrides?.continued) return null;
  const budget = search.overrides?.budget?.searches ?? 12;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return null;
  const since = new Date(search.startedAt);
  since.setUTCMinutes(0, 0, 0);
  const used = (await minds(user).toolUsage(profile.mindId, since).catch(() => []))
    .filter((u) => u.tool === "SEARCH_Web")
    .reduce((a, u) => a + u.calls, 0);
  if (used >= budget * CONTINUE_BELOW) return null;
  const left = Math.max(2, budget - used);
  const { titles } = discoveryHints(profile.preferences?.targetRoles ?? "");
  const wider = titles.slice(1, 7).join(", ");
  const note =
    `Not final yet. I asked for ${wanted} and have ${wanted - remaining}, and you have about ${left} web searches left in this search's budget. Keep going before you send final: ` +
    `search the wider title family (${wider || "the same role one level up or down"}); use job-board results as leads and open the employer's own page for each; ` +
    `and send near-misses that meet most requirements as cards with matchScore 55 or lower and every gap listed in mustHaves, so I can decide. Send final when the budget is spent or nothing new turns up.`;
  await db.update(schema.searches).set({ overrides: { ...(search.overrides ?? {}), continued: true } }).where(eq(schema.searches.id, search.id));
  await minds(user).sendMessage(profile.conversationAlias, `${user.username ?? "me"} here. ${note} (${new Date().toISOString()})`).catch((e) => console.error("[search] continue message failed", profile.id, e));
  track(profile.userId, "search_continued", { had: wanted - remaining, wanted, used, budget });
  return note;
}
