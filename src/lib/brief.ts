import type { Preferences } from "./preferences";
import { avoidList, MAX_POSTING_AGE_DAYS, REMOTE_SCOPES, workSettingLabel } from "./preferences";

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
1. Find up to ${prefs.jobsPerDay} open jobs that pass EVERY check below. Quality over quantity: send fewer, or none, rather than pad the list.
2. For each, write an application pack in English: cover letter, a short "about me", answers to likely form questions.
3. POST them to ${appUrl}/api/ingest with header "x-unemploy-key: ${ingestKey}". Test first with ?dry_run=1.
Then stop until tomorrow.

WHAT I WANT
- Roles: ${prefs.targetRoles}
- I live in: ${place}. Work setting: ${prefs.workSettings.map(workSettingLabel).join(", ")}. ${remote}
- Job type: ${prefs.jobTypes.join(", ")}. Level: ${prefs.levels.join(", ")}.
- Minimum salary: ${prefs.minSalary || "not set"}. Visa sponsorship: ${prefs.needsVisa ? "needed" : "not needed"}.
- Avoid: ${avoidList(prefs.avoidCompanies).join(", ") || "none"}.

CHECK EVERY JOB BEFORE SENDING (the endpoint enforces these and refuses jobs that fail)
1. Source: open the posting on the employer's own careers page or job system (Greenhouse, Lever, Ashby, Workable, Workday, SmartRecruiters, Teamtailor…). Never send a job board copy (RemoteOK, LinkedIn reposts, beBee, startup.jobs, Jobgether…).
2. Open today: you saw it accepting applications today. Send "verifiedOpenAt" = today. Skip anything that says closed or filled, or was posted over ${MAX_POSTING_AGE_DAYS} days ago.
3. I can apply from ${prefs.country}: copy the posting's own location or eligibility line into "locationText", word for word. "Remote" alone is not enough; it must name ${prefs.country}, my region, or anywhere/worldwide. If it names only other countries (e.g. "U.S. Remote"), skip it.
4. Exact facts: title, company and job type exactly as the posting says. A contract is not full-time. If the posting shows pay, copy it into "salary". If it's clearly below my minimum, skip it.
5. Must-haves: list the posting's hard requirements (years, domain, skills, hours overlap) in "mustHaves", each marked met or not met from my resume. Skip jobs where I miss most of them. If I miss any, matchScore is 55 or lower.
6. At most 2 roles per company per day. Look at the company's other openings and pick the one that fits me best.

WRITING RULES
- Every fact about me in the cover letter, about me and answers must come from a "claims" entry whose "evidence" quotes my resume word for word. If you can't quote it, leave it out. No flourishes ("senior scope", "API-first is native to me").
- Keep each fact with the job, company and project it belongs to on my resume. Don't move numbers or duties between roles.
- Tailor each letter to that posting's own requirements; don't reuse the same paragraph for every job.
- Write whyFit, gaps and companyNotes to me as "you". Company notes only from the posting or the company's own site; if unsure, leave it out.
- Say honestly in "gaps" where I fall short, including years of experience and time-zone overlap.

The endpoint's reply says what it accepted, refused and adjusted, and why. Fix what it says and resend only those.
Full format: GET ${appUrl}/api/ingest?brief=1

Please reply with one line confirming you've got this, then send today's jobs.`;
}

export function buildContract(appUrl: string) {
  return `CAREER NINJA INGEST CONTRACT

POST ${appUrl}/api/ingest            (add ?dry_run=1 to validate without saving)
Header: x-unemploy-key: <the key from your brief>
Body: {"jobs":[JOB, ...]}  (1–50 jobs)

JOB fields
  url           required  the employer's own posting (careers page or ATS), never a job board copy
  title         required
  company       required
  city          optional
  country       required unless the job is remote and the user accepts remote from anywhere; full country name
  workSetting   required  "onsite" | "hybrid" | "remote"
  jobType       optional  e.g. "Full-time"
  level         optional  e.g. "Mid-Senior"
  salary        required when the posting shows pay; as posted, with currency
  postedAt      ISO date from the posting; required when shown. Over ${MAX_POSTING_AGE_DAYS} days old is refused
  matchScore    required  0–100, how well the user fits; 55 or lower if any must-have is not met
  whyFit        required  2–3 plain sentences
  gaps          optional  list of honest shortfalls
  companyNotes  optional  2–3 sentences from the posting or the company's own site
  locationText  required  the posting's location/eligibility line, copied word for word
  mustHaves     required  [{"requirement":"5+ years of product management","met":false}, ...]
                          the posting's hard requirements, checked against the resume
  verifiedOpenAt required ISO date you last saw the posting open (today)
  pack          required
    coverLetter required  under 350 words
    aboutMe     required  2–3 sentences for "tell us about yourself"
    answers     optional  [{"question":"...","answer":"..."}]
    claims      required  [{"claim":"...","evidence":"<exact words from the resume>"}]
                          one entry per fact about the user used in the pack

REPLY
  {"accepted":n,"rejected":[{"url","code","hint"}],"adjusted":[{"url","note"}],"remainingToday":n,"skippedRecently":[{"title","company","reason"}]}
  codes: bad_job, not_employer_link, not_verified, not_eligible, poor_fit, work_setting_not_wanted,
         wrong_country, company_avoided, claim_not_in_resume, stale_posting, duplicate,
         found_by_other_headhunter, company_limit, daily_limit, job_closed, bad_url, paused
  Fix what each hint says. Do not resend accepted jobs.
  skippedRecently lists jobs the user skipped and why. Avoid similar jobs.

When remainingToday is 0, you are done for the day.`;
}
