import type { Preferences } from "./preferences";
import { discoveryText } from "./discovery";
import { floorOf } from "./pay";
import { avoidList, MAX_POSTING_AGE_DAYS, REMOTE_SCOPES, salaryLabel, workSettingLabel } from "./preferences";

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
  const { ownerName, profileLabel, prefs, appUrl, ingestKey } = args;
  const place = [prefs.city, prefs.country].filter(Boolean).join(", ");
  const remote = prefs.workSettings.includes("remote")
    ? `Remote jobs: ${REMOTE_SCOPES.find((r) => r.value === prefs.remoteScope)?.label.toLowerCase()}.`
    : "No remote jobs.";

  return `${ownerName} here. You are my headhunter for "${profileLabel}" jobs. My resume is attached: read it once now and save its full text in your memory, then work from that saved copy. Don't open the file again unless I send you a new resume.

HOW WE WORK
- You search ONLY when I send a message starting "SEARCH REQUEST". Never search, schedule wake-ups or book calendar tasks on your own. If you booked any, cancel them now. Between requests, do nothing.
- For each request:
  1. Find up to ${prefs.jobsPerDay} open jobs that pass EVERY check below. Quality over quantity: send fewer, or none, rather than pad the list.
  2. For each, open its application form and copy every question into "formQuestions" (skip name, email, phone, resume and cover letter). Write an application pack in English: cover letter, a short "about me", and an answer for every form question that is about the job, the company, or why I fit it (e.g. "Why us?", "What experience makes you a good fit for this position?"), each under the form's exact wording. Questions about my personal facts (notice period, licence, years with a tool) are not yours to answer; my personal Mind and I handle those.
  3. POST each job to ${appUrl}/api/ingest with header "x-unemploy-key: ${ingestKey}" as soon as it passes every check, one at a time if you like, so I see it right away. Don't save them up for the end. Use ?dry_run=1 at most once per search, for the first job only; after that POST directly (the reply tells you if anything's wrong).
  5. Progress notes: one line, only when something changes (a job sent, a job dropped and why, or a problem). No long updates; they cost cognition.
  4. When you're done, POST {"jobs":[],"final":true} (or mark your last push "final": true). Then stop.

WHAT I WANT
- Roles: ${prefs.targetRoles}
- I live in: ${place}. Work setting: ${prefs.workSettings.map(workSettingLabel).join(", ")}. ${remote}
- Job type: ${prefs.jobTypes.join(", ")}. Level: ${prefs.levels.join(", ")}.
- Pay: ${floorOf(prefs) ? `at least ${salaryLabel(floorOf(prefs)!)}. It's a floor, not a target: a posted range passes if its top reaches it (e.g. 4,000–6,000 passes 5,000+). Skip jobs whose whole posted range is below it. Jobs that don't show pay are fine.` : prefs.minSalary ? `at least ${prefs.minSalary}` : "no minimum"}. Visa sponsorship: ${prefs.needsVisa ? "needed" : "not needed"}.
- Avoid: ${avoidList(prefs.avoidCompanies).join(", ") || "none"}.

WHERE TO LOOK
- ${discoveryText(prefs.targetRoles, prefs.country)}

HOW TO SPEND MY COGNITION
- Work cheaply: for each lead, check the posting date and the location line first (from the search result, the listing's summary or its JSON-LD) and drop it before opening the full posting or form if it fails. Only read the full posting and form for leads that pass those two. For a job you verified on an earlier search, just confirm the posting is still open; don't rebuild its pack. Stop rule: if 12 leads in a row fail, or 90 minutes pass without sending a job, stop, POST {"jobs":[],"final":true} and say so in one line.

CHECK EVERY JOB BEFORE SENDING (the endpoint enforces these and refuses jobs that fail)
1. Source: open the posting on the employer's own careers page or job system (Greenhouse, Lever, Ashby, Workable, Workday, SmartRecruiters, Teamtailor…). Never send a job board copy (RemoteOK, LinkedIn reposts, beBee, startup.jobs, Jobgether…).
2. Open today: you saw it accepting applications today. Send "verifiedOpenAt" = today. Skip anything that says closed or filled, or was posted over ${MAX_POSTING_AGE_DAYS} days ago.
3. I can apply from ${prefs.country}: copy the posting's own location or eligibility line into "locationText", word for word. "Remote" alone is not enough; it must name ${prefs.country}, my region, or anywhere/worldwide. If it names only other countries (e.g. "U.S. Remote"), skip it.
4. Exact facts: title, company and job type exactly as the posting says. A contract is not full-time. If the posting shows pay, copy it into "salary" with currency and period (e.g. "MYR 6,000–8,000 a month"). If its whole range is below my pay floor, skip it.
5. Must-haves: list the posting's hard requirements (years, domain, skills, hours overlap) in "mustHaves", each marked met or not met from my resume. Skip jobs where I miss most of them. If I miss any, matchScore is 55 or lower.
6. At most 2 roles per company per day. Look at the company's other openings and pick the one that fits me best.

WRITING RULES
- Write like a person, not a brochure: short plain sentences, commas and full stops only. No dashes (— or –), no bullet points, no headings, no bold, no semicolons, no clichés like "I am excited to" or "passionate about".
- Every fact about me in the cover letter, about me and answers must come from a "claims" entry whose "evidence" quotes my resume word for word. If you can't quote it, leave it out. No flourishes ("senior scope", "API-first is native to me").
- Keep each fact with the job, company and project it belongs to on my resume. Don't move numbers or duties between roles.
- Tailor each letter to that posting's own requirements; don't reuse the same paragraph for every job.
- For the job card: a one-line "summary" of what the job actually is, the company's own website ("companyWebsite"), its stage and size, industry and perks when you can find them, and 2 short "highlights" on why I fit (under 15 words each, never naming the company: they show before the company is revealed). If the posting shows no pay you may estimate it from reliable sources; set "salaryEstimated": true.
- Write whyFit, gaps and companyNotes to me as "you". Company notes only from the posting or the company's own site; if unsure, leave it out.
- Say honestly in "gaps" where I fall short, including years of experience and time-zone overlap.

The endpoint's reply says what it accepted, refused and adjusted, and why. Fix what it says and resend only those.
Full format: GET ${appUrl}/api/ingest?brief=1

Please reply with one line confirming you've got this. Don't search now; wait for my first SEARCH REQUEST.`;
}

export function buildContract(appUrl: string) {
  return `CAREER NINJA INGEST CONTRACT

POST ${appUrl}/api/ingest            (?dry_run=1 validates without saving: use it once per search at most)
Header: x-unemploy-key: <the key from your brief>
Body: {"jobs":[JOB, ...], "final": true|false}  (0–50 jobs; "final": true on the last push of a search)
Send each job as soon as it passes every check (one per push is fine) so the user sees it straight away. Don't hold jobs for one batch at the end.
Only send during a search the user requested (a "SEARCH REQUEST" message). Other pushes are refused.

JOB fields
  url           required  the employer's own posting (careers page or ATS), never a job board copy
  title         required
  company       required
  city          optional
  country       required unless the job is remote and the user accepts remote from anywhere; full country name
  workSetting   required  "onsite" | "hybrid" | "remote"
  jobType       optional  e.g. "Full-time"
  level         optional  e.g. "Mid-Senior"
  salary        required when the posting shows pay; as posted, with currency and period, e.g. "MYR 6,000–8,000 a month"
  postedAt      ISO date from the posting; required when shown. Over ${MAX_POSTING_AGE_DAYS} days old is refused
  matchScore    required  0–100, how well the user fits; 55 or lower if any must-have is not met
  whyFit        required  2–3 plain sentences
  gaps          optional  list of honest shortfalls
  companyNotes  optional  2–3 sentences from the posting or the company's own site
  companyWebsite required the company's own website, e.g. "acme.com" (used for its logo)
  companyStage  optional  e.g. "Series B", "Public", "Profitable, bootstrapped"
  companySize   optional  e.g. "~200 people"
  industry      optional  e.g. "Fintech · Payments"
  perks         optional  up to 6 short perks from the posting, e.g. ["Fully remote","Learning budget"]
  highlights    required  1–3 short reasons the user fits, each under 15 words
  summary       recommended one plain line on what the job is, from the posting, under 25 words
                          e.g. "Own the onboarding flow for a payments app used by 2M people"
  salaryEstimated optional true when "salary" is your estimate rather than the posting's
  locationText  required  the posting's location/eligibility line, copied word for word
  mustHaves     required  [{"requirement":"5+ years of product management","met":false}, ...]
                          the posting's hard requirements, checked against the resume
  verifiedOpenAt required ISO date you last saw the posting open (today)
  formQuestions optional  every question on the job's application form, exactly as worded:
                          [{"question":"Are you willing to relocate?","options":["Yes","No"],"required":true}, ...]
                          open the "Apply" form to read them; include "options" for choices.
                          Skip name, email, phone, resume and cover letter fields.
  pack          required
    coverLetter required  under 350 words
    aboutMe     required  2–3 sentences for "tell us about yourself"
    answers     required when the form asks about the job, company or fit: one entry per such
                          question, "question" copied exactly from the form; facts only from the resume
    claims      required  [{"claim":"...","evidence":"<exact words from the resume>"}]
                          one entry per fact about the user used in the pack

REPLY
  {"accepted":n,"rejected":[{"url","code","hint"}],"adjusted":[{"url","note"}],"remaining":n,"skippedRecently":[{"title","company","reason"}]}
  codes: bad_job, not_employer_link, not_verified, not_eligible, poor_fit, work_setting_not_wanted,
         wrong_country, company_avoided, claim_not_in_resume, stale_posting, duplicate,
         found_by_other_headhunter, company_limit, search_limit, job_closed, bad_url, paused, below_salary,
         no_search_requested
  Fix what each hint says. Do not resend accepted jobs.
  duplicate also covers the same posting under another link (tracking parameters, old and new
  job-board addresses) and the same title at the same company within 60 days.
  skippedRecently lists jobs the user skipped and why. Avoid similar jobs.

When remaining is 0, the search is complete: stop and wait for the next request.`;
}
