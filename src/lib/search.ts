import "server-only";
import { and, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { sendSearchDoneEmail } from "./email";
import { minds } from "./minds/client";
import { SAME_ROLE_DAYS } from "./dedupe";
import { discoveryText } from "./discovery";
import { askPersonalMind } from "./personal";
import { mindsConfig } from "./minds/config";

// Headhunters search only when the user asks. A search is "active" from the request until
// the Mind sends its final batch, fills the quota, or this timeout passes. Between searches
// the Mind is switched off so it can't wake (and spend) on its own.
// Careful searches (opening every posting and its form) can run for several hours.
export const SEARCH_TIMEOUT_MS = 6 * 60 * 60 * 1000;

type SearchFields = Pick<Profile, "searchStartedAt" | "searchEndedAt">;

export function isSearching(p: SearchFields, now = Date.now()) {
  return !!p.searchStartedAt && !p.searchEndedAt && now - p.searchStartedAt.getTime() < SEARCH_TIMEOUT_MS;
}

// The user's recent jobs, so the Mind skips them instead of researching them again.
export async function alreadySentList(userId: string, limit = 80) {
  const rows = await db
    .select({ company: schema.jobs.company, title: schema.jobs.title })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.jobs.profileId, schema.profiles.id))
    .where(and(eq(schema.profiles.userId, userId), gte(schema.jobs.createdAt, new Date(Date.now() - SAME_ROLE_DAYS * 86_400_000))))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit);
  return rows.map((r) => `${r.company}: ${r.title}`);
}

// Leads dropped in recent searches, so the Mind skips them instead of re-checking.
export async function ruledOutList(profileId: string, limit = 60) {
  const rows = await db
    .select({ company: schema.leads.company, title: schema.leads.title, reason: schema.leads.reason })
    .from(schema.leads)
    .where(and(eq(schema.leads.profileId, profileId), gte(schema.leads.createdAt, new Date(Date.now() - SAME_ROLE_DAYS * 86_400_000))))
    .orderBy(desc(schema.leads.createdAt))
    .limit(limit);
  return rows.map((r) => `${r.company}: ${r.title} (${r.reason.replace("_", " ")})`);
}

export function searchRequestText(
  username: string,
  jobs: number,
  n: number,
  focus?: string,
  alreadySent: string[] = [],
  payFloor?: string,
  discovery?: { targetRoles: string; country: string },
  ruledOut: string[] = [],
  maxAgeDays?: number,
  resumeChanged = false,
) {
  const resume = resumeChanged
    ? "My resume changed: the new file is attached. Read it once, replace the copy in your memory with its full text, and quote only this one from now on."
    : "Use the copy of my resume you already saved; don't re-read the file (I'll tell you if it changes).";
  const age = maxAgeDays ? `Posting age for this search: up to ${maxAgeDays} days old is fine (this replaces the number in your brief). ` : "";
  const skipRuled = ruledOut.length ? `Already ruled out on earlier searches, don't re-check unless the posting changed: ${ruledOut.join("; ")}. ` : "";
  const wide = discovery ? discoveryText(discovery.targetRoles, discovery.country) + " " : "";
  const pay = payFloor
    ? `Pay floor: ${payFloor}. A posted range passes if its top reaches it; skip jobs whose whole posted range is below it; jobs without posted pay are fine. `
    : "";
  const skip = alreadySent.length
    ? `Skip these; I already have them (company: title): ${alreadySent.join("; ")}. `
    : "";
  return (
    `SEARCH REQUEST #${n} from ${username}. ${resume} Find up to ${jobs} jobs now, following every check in your brief, ` +
    `in the current format from GET ${mindsConfig.ingestUrl}/api/ingest?brief=1 (read it first; it may have new fields), ` +
    `and POST them to ${mindsConfig.ingestUrl}/api/ingest (use this address even if your brief says another; it can change). For each job, open its application form and list its questions in "formQuestions". ` +
    `Send each job AS SOON AS it passes every check, one job per POST is fine: I see it straight away and can start swiping while you keep searching. Don't hold jobs back for one big batch at the end. ` +
    `Dry-run (?dry_run=1) at most once this search, then POST directly. Progress notes: one line, only when something changes; no long updates. ` +
    `Work cheaply: for each lead, check what the job actually is first, from its summary or first lines, not just its title: titles vary, so judge by the scope of the work. If the day-to-day work is not what my target roles do (for example, a product manager owns a product or feature and decides what gets built and why; a job that is mainly marketing campaigns, account management or sales is not that, whatever it is called), drop it straight away as poor_fit with the note "different role" and don't go further. Then check the posting date and the location line (from the search result, the listing's summary or its JSON-LD) and drop it before opening the full posting or form if it fails. Only read the full posting and form for leads that pass those two. For a job you verified on an earlier search, just confirm the posting is still open; don't rebuild its pack. Stop rule: if 12 leads in a row fail, or 90 minutes pass without sending a job, stop, POST {\"jobs\":[],\"final\":true} and say so in one line. ` +
    `When you're done, POST {"jobs":[],"final":true} (or mark your last push "final": true). ` +
    wide +
    age +
    skipRuled +
    `Report every lead you drop in the "dropped" list of your next POST (reason + short note), instead of describing it in chat. ` +
    `Writing style for the cover letter and answers: Write like a person, not a brochure: short plain sentences, commas and full stops only. No dashes (— or –), no bullet points, no headings, no bold, no semicolons, no clichés like \\"I am excited to\\" or \\"passionate about\\". ` +
    pay +
    skip +
    (focus ? `For this search only, focus on: ${focus}. Every check in the brief still applies. ` : "") +
    `If you can't reach that address, reply once to say so, then stop: don't keep retrying or searching. ` +
    `Then stop and wait for my next request. (${new Date().toISOString()})`
  );
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
  // The search's form questions go to the personal Mind in one batch.
  await askPersonalMind(profile.userId).catch((e) => console.error("[search] personal Mind not asked", profile.id, e));
}

// Closes the search's history row: when, why, jobs added and the balance after.
async function recordEnd(profile: Profile, reason: "finished" | "stopped" | "timeout") {
  const row = await db.query.searches.findFirst({
    where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)),
    orderBy: desc(schema.searches.startedAt),
  });
  if (!row) return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, row.startedAt)));
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
    .set({ endedAt: new Date(), endReason: reason, jobsAdded: n, balanceEnd, cognitionUsed })
    .where(eq(schema.searches.id, row.id));
}

async function emailResults(profile: Profile, timedOut: boolean) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user?.email || !user.emailVerifiedAt || !user.emailOnSearchDone) return;
  const since = profile.searchStartedAt ?? new Date(Date.now() - SEARCH_TIMEOUT_MS);
  const jobs = await db.query.jobs.findMany({
    where: and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, since), inArray(schema.jobs.status, ["new", "saved"])),
    orderBy: desc(schema.jobs.matchScore),
  });
  await sendSearchDoneEmail({
    to: user.email,
    mindName: profile.mindName ?? "Your headhunter",
    label: profile.label,
    timedOut,
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

export async function switchOff(profile: Profile) {
  if (!profile.mindId) return;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return;
  await minds(user)
    .setEnabled(profile.mindId, false)
    .catch((e) => console.error("[search] couldn't switch the Mind off", profile.id, e));
}
