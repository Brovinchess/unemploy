import type { Preferences } from "./preferences";
import { REMOTE_SCOPES, workSettingLabel } from "./preferences";

// The brief is the one text the Mind keeps re-reading, so it stays short and concrete.
// The full contract lives at GET /api/ingest?brief=1 and is linked, never pasted.
export function buildBrief(args: {
  ownerName: string;
  profileLabel: string;
  prefs: Preferences;
  timezone: string;
  appUrl: string;
  ingestKey: string;
}) {
  const { ownerName, profileLabel, prefs, timezone, appUrl, ingestKey } = args;
  const place = [prefs.city, prefs.country].filter(Boolean).join(", ");
  const remote = prefs.workSettings.includes("remote")
    ? `Remote jobs: ${REMOTE_SCOPES.find((r) => r.value === prefs.remoteScope)?.label.toLowerCase()}.`
    : "No remote jobs.";

  return `${ownerName} here. You are my headhunter for "${profileLabel}" jobs. My resume is attached.

YOUR JOB, once a day around 08:00 (${timezone}):
1. Find ${prefs.jobsPerDay} open jobs that fit me best. Only real postings with a working link.
2. For each, write an application pack in English: cover letter, a short "about me", answers to likely form questions.
3. POST them to ${appUrl}/api/ingest with header "x-unemploy-key: ${ingestKey}". Test first with ?dry_run=1.
Then stop until tomorrow. If today's jobs are all sent, do nothing more.

WHAT I WANT
- Roles: ${prefs.targetRoles}
- Location: ${place}. Work setting: ${prefs.workSettings.map(workSettingLabel).join(", ")}. ${remote}
- Job type: ${prefs.jobTypes.join(", ")}. Level: ${prefs.levels.join(", ")}.
- Minimum salary: ${prefs.minSalary || "not set"}. Visa sponsorship: ${prefs.needsVisa ? "needed" : "not needed"}.
- Avoid: ${prefs.avoidCompanies || "none"}.

RULES
- Never invent anything about me. Every claim in a pack must quote my resume word for word in "evidence", or leave it out.
- Say honestly where I fall short in "gaps".
- The endpoint's reply tells you what was accepted and why anything was refused. Fix what it says and resend only those.
- Full format and examples: GET ${appUrl}/api/ingest?brief=1

Please reply with one line confirming you've got this, then send today's jobs.`;
}

export function buildContract(appUrl: string) {
  return `UNEMPLOY INGEST CONTRACT

POST ${appUrl}/api/ingest            (add ?dry_run=1 to validate without saving)
Header: x-unemploy-key: <the key from your brief>
Body: {"jobs":[JOB, ...]}  (1–50 jobs)

JOB fields
  url           required  live link to the original posting
  title         required
  company       required
  city          optional
  country       required unless the job is remote and the user accepts remote from anywhere; full country name
  workSetting   required  "onsite" | "hybrid" | "remote"
  jobType       optional  e.g. "Full-time"
  level         optional  e.g. "Mid-Senior"
  salary        optional  as posted, with currency
  postedAt      optional  ISO date
  matchScore    required  0–100, how well the user fits
  whyFit        required  2–3 plain sentences
  gaps          optional  list of honest shortfalls
  companyNotes  optional  2–3 sentences on the company
  pack          required
    coverLetter required  under 350 words
    aboutMe     required  2–3 sentences for "tell us about yourself"
    answers     optional  [{"question":"...","answer":"..."}]
    claims      required  [{"claim":"...","evidence":"<exact words from the resume>"}]
                          one entry per fact about the user used in the pack

REPLY
  {"accepted":n,"rejected":[{"url","code","hint"}],"remainingToday":n,"skippedRecently":[{"title","company","reason"}]}
  codes: bad_job, work_setting_not_wanted, wrong_country, company_avoided,
         claim_not_in_resume, duplicate, daily_limit, job_link_dead, paused
  Fix what each hint says. Do not resend accepted jobs.
  skippedRecently lists jobs the user skipped and why. Avoid similar jobs.

When remainingToday is 0, you are done for the day.`;
}
