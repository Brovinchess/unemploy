import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DropReason, Profile } from "@/db/schema";
import { checkRoles } from "./job-titles";
import { estimateSearchCost, postingAgeDays, REMOTE_SCOPES, workSettingLabel, type Preferences } from "./preferences";
import { isSearching } from "./search";

// What the person sees when a search came back with less than asked: one card, one next move.
// Seven kinds, each a thing the person can do; the reason is one line in the body. The wording
// follows the "Empty search messages" doc: the headline is the next move, never a verdict.

export type Fix =
  | { type: "roles"; roles: string }
  | { type: "workSettings"; add: Preferences["workSettings"] }
  | { type: "remoteScope"; scope: "region" | "anywhere" }
  | { type: "postingAge"; days: 60 | 90 }
  | { type: "wholeCountry" };

// A fix applied to the preferences. Pure, so it can be checked without a signed-in user.
export function applyFix(prefs: Preferences, fix: Fix): Preferences {
  switch (fix.type) {
    case "roles":
      return { ...prefs, targetRoles: String(fix.roles).slice(0, 300) };
    case "workSettings":
      return { ...prefs, workSettings: [...new Set([...prefs.workSettings, ...fix.add])] };
    case "remoteScope":
      return { ...prefs, remoteScope: fix.scope, workSettings: prefs.workSettings.includes("remote") ? prefs.workSettings : [...prefs.workSettings, "remote"] };
    case "postingAge":
      return { ...prefs, maxPostingAgeDays: fix.days };
    case "wholeCountry":
      return { ...prefs, city: "" };
  }
}

export type OutcomeKind = "title" | "resume" | "widen" | "later" | "keep_going" | "top_up" | "partial";

export type Outcome = {
  kind: OutcomeKind;
  searchId: string;
  found: number;
  wanted: number;
  headline: string;
  body: string;
  // One of: a settings change the card applies itself, a link, or nothing (just "Find new jobs").
  button?: { label: string; fix?: Fix; href?: string };
  mood: "sad" | "thinking" | "sleeping";
};

const ROLE_NOTE = /different role|wrong role|not a .{0,20}role|other function|unrelated|not the role/i;
const YEARS_NOTE = /\byears?\b|experience|senior|junior|level/i;
// Leads with nothing to verify: agency posts that hide the employer, board copies, LinkedIn-only.
const AGENCY_NOTE = /agenc|recruit|staffing|headhunt|linkedin|mirror|aggregat|job board|directory|client unnamed|unnamed client|no employer page|no page|employer not named/i;
// A city state: the city and the country are the same place, so "widen to the country" is no change.
const cityIsCountry = (p: Preferences) => !p.city || p.city.trim().toLowerCase() === p.country.trim().toLowerCase();

const or_ = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join("");

export async function searchOutcome(profile: Profile, opts: { topUpUrl: string }): Promise<Outcome | null> {
  if (isSearching(profile) || !profile.preferences) return null;
  const prefs = profile.preferences;
  const search = await db.query.searches.findFirst({ where: and(eq(schema.searches.profileId, profile.id), isNotNull(schema.searches.endedAt)), orderBy: desc(schema.searches.startedAt) });
  if (!search) return null;
  const found = search.jobsAdded ?? 0;
  const wanted = search.jobsWanted;
  if (found >= wanted) return null;
  const base = { searchId: search.id, found, wanted };
  const role = prefs.targetRoles.split(/,|\/| or /i)[0]?.trim() || "these";
  const place = prefs.city || prefs.country;

  // The drops, with the poor-fit ones split by what the note says.
  const leads = await db.query.leads.findMany({
    where: and(eq(schema.leads.profileId, profile.id), or(eq(schema.leads.searchId, search.id), and(isNull(schema.leads.searchId), gte(schema.leads.createdAt, search.startedAt)))),
    columns: { reason: true, note: true },
  });
  const counts = new Map<DropReason, number>();
  let roleDrops = 0;
  let yearsDrops = 0;
  let agencyDrops = 0;
  for (const l of leads) {
    const r: DropReason = l.reason === "pay" ? "other" : l.reason;
    counts.set(r, (counts.get(r) ?? 0) + 1);
    if ((r === "other" || r === "unreachable") && AGENCY_NOTE.test(l.note ?? "")) agencyDrops++;
    if (r === "poor_fit") {
      if (ROLE_NOTE.test(l.note ?? "")) roleDrops++;
      else if (YEARS_NOTE.test(l.note ?? "")) yearsDrops++;
    }
  }
  const total = leads.length;
  const opened = search.opened ?? found + total;
  const top = [...counts.entries()].filter(([r]) => r !== "other").sort((a, b) => b[1] - a[1])[0];
  const dominant = top && total >= 5 && top[1] / total >= 0.3 ? top[0] : null;
  const share = top ? Math.round((top[1] / Math.max(1, total)) * 100) : 0;

  // 1. Ran out of cognition: nothing else matters until there is some.
  if (search.endReason === "no_cognition") {
    const need = estimateSearchCost(Math.max(1, wanted - found)).cognition;
    return {
      ...base,
      kind: "top_up",
      mood: "sleeping",
      headline: "Top up to let your headhunter finish this search.",
      body: `It found ${found} ${found === 1 ? "job" : "jobs"} before its cognition ran out. The rest needs about ${need} more. Top up and the next search carries on without checking the same postings again.`,
      button: { label: "Top up on Hello Minds", href: opts.topUpUrl },
    };
  }

  // 2. The search tool failed: the headhunter's own final line says so, or it searched and opened nothing.
  const webCalls = search.toolUsage?.SEARCH_Web?.calls ?? 0;
  const toolDown = /search tool/i.test(search.summary ?? "") || (found === 0 && opened === 0 && webCalls >= 3);
  if (toolDown) {
    return {
      ...base,
      kind: "keep_going",
      mood: "thinking",
      headline: "Sit tight, then try again: our search tool failed during this search.",
      body: "Your headhunter could not run web searches for most of it, so it found almost nothing. Nothing is wrong with your settings or resume. Run it again in a little while.",
    };
  }

  // 3. A role title employers don't post. Checked on the settings, not the drops.
  const roles = checkRoles(prefs.targetRoles);
  if (!roles.ok && roles.suggestions[0]) {
    const keep = prefs.targetRoles
      .split(/,|\/| or /i)
      .map((s) => s.trim())
      .filter((s) => s && !roles.vague.includes(s));
    const next = [...keep, roles.suggestions[0]].join(", ");
    return {
      ...base,
      kind: "title",
      mood: "thinking",
      headline: "Revamp your job title for a better search.",
      body: `Your headhunter searched for "${roles.vague[0]}" and found no postings with that title. Employers use a small set of standard titles, and a search only finds what they call it. ${roles.suggestions[0]} is the closest one.`,
      button: { label: `Search as ${roles.suggestions[0]} instead`, fix: { type: "roles", roles: next } },
    };
  }

  // 4. Stopped by the person.
  if (search.endReason === "stopped") {
    return { ...base, kind: "keep_going", mood: "thinking", headline: "Pick up where you left off.", body: `You stopped this search with ${found} ${found === 1 ? "job" : "jobs"} found. The next one starts from where it stopped.` };
  }

  // 5. The dominant drop reason.
  if (dominant === "poor_fit") {
    if (roleDrops >= yearsDrops && roleDrops > 0) {
      return {
        ...base,
        kind: "title",
        mood: "thinking",
        headline: "Add a second title to sharpen your search.",
        body: `Your headhunter opened ${opened} postings called ${role} or close to it. Most turned out to be a different kind of job. One more specific title tells it what to keep.`,
        button: { label: "Add a second title", href: `/app/headhunters/${profile.id}#looks-for` },
      };
    }
    const thin = (profile.resumeText?.length ?? 0) < 1200;
    return {
      ...base,
      kind: "resume",
      mood: "thinking",
      headline: thin ? "Build out your resume to unlock more jobs." : `Add more of your experience to match ${role} postings.`,
      body: thin
        ? `Your headhunter checks every posting's requirements against your resume, and yours is short, so ${share}% of what it opened came up as asking for more than it shows. Two or three lines per past role, with tools and results, change that quickly.`
        : `Your headhunter opened ${opened} jobs. ${share}% asked for more experience than your resume shows. That gap is often smaller than it looks: a resume that leaves out a role, freelance work or a long internship reads as fewer years than you have.`,
      button: { label: "Review my resume", href: `/app/headhunters/${profile.id}#resume` },
    };
  }
  if (dominant === "not_eligible") {
    const remoteOnly = prefs.workSettings.length === 1 && prefs.workSettings[0] === "remote";
    const scope = REMOTE_SCOPES.find((r) => r.value === prefs.remoteScope)?.label.toLowerCase();
    return {
      ...base,
      kind: "widen",
      mood: "thinking",
      headline: `Widen your search to reach more jobs open in ${prefs.country}.`,
      body: `Your headhunter read the location line on ${opened} postings. ${share}% named a country or region you are not in. Remote jobs often hire in one country only, and it checks that before sending anything.${remoteOnly ? "" : ` Right now it takes remote jobs from ${scope}.`}`,
      button: remoteOnly
        ? { label: `Also look for on-site and hybrid jobs in ${prefs.country}`, fix: { type: "workSettings", add: ["onsite", "hybrid"] } }
        : prefs.remoteScope === "country"
          ? { label: "Include remote jobs from my region", fix: { type: "remoteScope", scope: "region" } }
          : { label: "Change where I'll work", href: `/app/headhunters/${profile.id}#looks-for` },
    };
  }
  if (dominant === "work_setting") {
    const missing = (["hybrid", "onsite", "remote"] as const).find((w) => !prefs.workSettings.includes(w));
    return {
      ...base,
      kind: "widen",
      mood: "thinking",
      headline: missing ? `Allow ${workSettingLabel(missing).toLowerCase()} work to unlock the ${role} jobs in ${place}.` : `Widen your search to reach more ${role} jobs.`,
      body: `Your headhunter found ${top![1]} postings that fit everything except the work setting. You asked for ${prefs.workSettings.map(workSettingLabel).join(" and ").toLowerCase()} only.`,
      button: missing ? { label: `Allow ${workSettingLabel(missing).toLowerCase()} too`, fix: { type: "workSettings", add: [missing] } } : undefined,
    };
  }
  if (dominant === "too_old" && postingAgeDays(prefs) < 90) {
    const days = postingAgeDays(prefs) < 60 ? 60 : 90;
    return {
      ...base,
      kind: "widen",
      mood: "thinking",
      headline: "Extend your posting age limit to catch the matches it found.",
      body: `Your headhunter found ${top![1]} jobs that fit but were older than your ${postingAgeDays(prefs)}-day limit. Older postings are often still open, especially at smaller companies that leave a listing up until it is filled.`,
      button: { label: `Allow postings up to ${days} days old`, fix: { type: "postingAge", days } },
    };
  }
  if (dominant === "unreachable") {
    return {
      ...base,
      kind: "widen",
      mood: "thinking",
      headline: `Widen your area to find ${role} jobs your headhunter can read.`,
      body: `Most listings it found were on job boards that block automated visitors, so it could not check whether they are open or who can apply. Employers' own career pages are readable, and a wider area brings more of those in.`,
      button: !cityIsCountry(prefs) ? { label: `Widen the area to all of ${prefs.country}`, fix: { type: "wholeCountry" } } : prefs.remoteScope === "country" ? { label: "Include remote jobs from my region", fix: { type: "remoteScope", scope: "region" } } : { label: "Add a second title", href: `/app/headhunters/${profile.id}#looks-for` },
    };
  }
  if (dominant === "closed" || dominant === "duplicate") {
    return {
      ...base,
      kind: "later",
      mood: "sleeping",
      headline: `Check back in a few days for fresh ${role} postings.`,
      body: dominant === "closed" ? `Your headhunter found ${opened} ${role} postings in ${place} and opened each one. ${share}% were already closed or filled. New ones appear every week, and the next search starts from fresh listings.` : `Your headhunter already judged every ${role} posting it could find in ${place}, and it never sends the same job twice. New postings appear every week.`,
    };
  }

  // 6. Nothing to verify: most leads were agency posts with no employer named, or board copies
  //    with no employer page. Common for senior titles. A neighbouring title brings in direct postings.
  if (found === 0 && total >= 3 && agencyDrops / total >= 0.4) {
    const pct = Math.round((agencyDrops / total) * 100);
    return {
      ...base,
      kind: "title",
      mood: "thinking",
      headline: `Add a second title to reach ${role} jobs your headhunter can verify.`,
      body: `Your headhunter opened ${opened} ${role} postings in ${place}. ${pct}% were agency listings that do not name the employer, or copies on job boards and LinkedIn with no employer page, so it could not check whether they are open or who can apply. Senior roles are often posted under a neighbouring title. Adding one brings in direct postings it can check.`,
      button: { label: "Add a second title", href: `/app/headhunters/${profile.id}#looks-for` },
    };
  }

  // 7. Few postings at all: a small market.
  if (opened < 10 && found === 0) {
    return {
      ...base,
      kind: "widen",
      mood: "thinking",
      headline: `Widen your search: few ${role} jobs are posted in ${place} right now.`,
      body: `Your headhunter searched ${place}, then the whole country, then wider titles, and found ${opened} postings in total. That is the market this month, not a problem with your profile.`,
      button: !cityIsCountry(prefs) ? { label: `Widen the area to all of ${prefs.country}`, fix: { type: "wholeCountry" } } : prefs.remoteScope === "country" && prefs.workSettings.includes("remote") ? { label: "Include remote jobs from my region", fix: { type: "remoteScope", scope: "region" } } : { label: "Try a neighbouring title", href: `/app/headhunters/${profile.id}#looks-for` },
    };
  }

  // 8. Ran out of time.
  if (search.endReason === "timeout") {
    return { ...base, kind: "keep_going", mood: "thinking", headline: `Keep going: your search hit the time limit with ${found} ${found === 1 ? "job" : "jobs"} found.`, body: "Everything it found is here. The next search starts where this one stopped." };
  }

  // 9. Found some, not all: a line, not a card.
  if (found > 0) {
    return { ...base, kind: "partial", mood: "thinking", headline: `Found ${found} of ${wanted}.`, body: or_(top && total ? `Most of the rest ${labelFor(top[0])}.` : "", " The next search starts from fresh listings.") };
  }

  return { ...base, kind: "later", mood: "sleeping", headline: "Try a fresh search.", body: `Your headhunter checked ${opened} postings and none passed every check. The next search starts from new listings.` };
}

function labelFor(r: DropReason) {
  switch (r) {
    case "poor_fit":
      return "asked for more than your resume shows";
    case "not_eligible":
      return "were only open to other countries";
    case "too_old":
      return "were posted too long ago";
    case "closed":
      return "had already closed";
    case "work_setting":
      return "had the wrong work setting";
    case "unreachable":
      return "sat on pages that would not open";
    case "duplicate":
      return "had already been sent";
    default:
      return "did not pass every check";
  }
}
