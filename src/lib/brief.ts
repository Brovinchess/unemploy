import type { Preferences } from "./preferences";
import { ladderText } from "./discovery";
import { FACTS_RULE } from "./facts";
import { checkRoles } from "./job-titles";
import { avoidList, MAX_POSTING_AGE_DAYS, postingAgeDays, REMOTE_SCOPES, workSettingLabel } from "./preferences";

// Bump when the brief's wording changes in a way every existing headhunter should get: the next
// search request then carries the full new brief (profiles.brief_version < BRIEF_VERSION).
export const BRIEF_VERSION = 7;

// "Crypto" or "manager" is a field, not a title: say so, and name titles to search instead.
function rolesNote(roles: string) {
  const c = checkRoles(roles);
  if (c.ok) return "";
  return ` (${c.vague.map((v) => `"${v}"`).join(", ")} is a field, not a job title: search real titles within it, such as ${c.suggestions.join(", ")}, and judge fit by the work, not the word)`;
}

// How to write a cover letter and answers. Sent with each PACK REQUEST, not in the brief: the
// headhunter needs it only when writing, and a shorter brief makes every search turn cheaper.
export const PACK_RULES = `- Write like a person, not a brochure: short plain sentences, commas and full stops only. No dashes (— or –), no bullet points, no headings, no bold, no semicolons, no clichés like "I am excited to" or "passionate about".
- Every fact about me in the cover letter, about me and answers must come from a "claims" entry whose "evidence" quotes my resume word for word. If you can't quote it, leave it out. No flourishes ("senior scope", "API-first is native to me").
- Keep each fact with the job, company and project it belongs to on my resume. Don't move numbers or duties between roles.
- The cover letter, 150 to 220 words, three short paragraphs, written as me:
  1. Open with the job itself, not with me: one line on the specific problem or product this role owns (from the posting), then the one thing from my resume that matches it best. Never open with "I am writing to apply" or "I am excited".
  2. Two or three proofs, each one sentence: a result from my resume with its number, tied to a requirement the posting names, using the posting's own words for the skill. Pick the proofs that answer that posting's top requirements, so no two letters share a paragraph.
  3. Close with one plain line on what I'd do in the first weeks there, or the one question I'd want to answer for them, then "Thanks," and my name. No "I look forward to hearing from you".
  Address it "Hello [Company] team," unless the posting names a person. No exclamation marks, no adjectives about myself ("driven", "results-oriented"), no restating my job titles in order; the resume does that.`;

// The brief is the one text the Mind keeps re-reading, so it stays short and concrete.
// The full contract lives at GET /api/ingest?brief=1 and is linked, never pasted.
export function buildBrief(args: {
  ownerName: string;
  profileLabel: string;
  prefs: Preferences;
  resumeAttached?: boolean; // false when re-briefing without a new resume
  timezone: string;
  appUrl: string;
  ingestKey: string;
  facts?: string; // ABOUT ME block from factsText(); empty until the person fills in details
}) {
  const { ownerName, profileLabel, prefs, appUrl, ingestKey, resumeAttached = true, facts = "" } = args;
  const resumeLine = resumeAttached
    ? "My resume is attached: read it once now and save its full text in your memory, then work from that saved copy. Don't open the file again unless I send you a new resume."
    : "You already have my resume saved in your memory; keep working from that copy.";
  const place = [prefs.city, prefs.country].filter(Boolean).join(", ");
  const remote = prefs.workSettings.includes("remote")
    ? `Remote jobs: ${REMOTE_SCOPES.find((r) => r.value === prefs.remoteScope)?.label.toLowerCase()}.`
    : "No remote jobs.";

  return `${ownerName} here. You are my headhunter for "${profileLabel}" jobs. ${resumeLine}

HOW WE WORK
- You search ONLY when I send a message starting "SEARCH REQUEST". Never search, schedule wake-ups or book calendar tasks on your own. If you booked any, cancel them now. Between requests, do nothing.
- For each request:
  1. Find up to ${prefs.jobsPerDay} open jobs that pass EVERY check below. Quality over quantity: send fewer, or none, rather than pad the list.
  2. Send each one as a card the moment it passes: the job's facts, locationText, mustHaves, whyFit, gaps, highlights, summary and company details. No cover letter, no answers, no form questions during a search; those come later, only for the jobs I keep (step 7).
  3. POST each job to ${appUrl}/api/ingest with header "x-unemploy-key: ${ingestKey}" as soon as it passes every check, one at a time if you like, so I see it right away. Don't save them up for the end. Use ?dry_run=1 at most once per search, for the first job only; after that POST directly (the reply tells you if anything's wrong).
  4. Progress notes: one line, only when something changes. Dropped leads go in "dropped", not in chat. No long updates; they cost cognition.
  5. Every lead you drop goes in the same POST under "dropped": one line each, with a reason (not_eligible, too_old, closed, poor_fit, duplicate, work_setting, unreachable, other) and a note under ten words. Only when you opened a posting that is still open and dropped it as poor_fit, not_eligible, work_setting or duplicate, add a short "posting": url, title, company, city, country, workSetting, postedAt, locationText. Nothing more, and never for closed, too old or unreachable ones. Never open a posting just to fill this in.
  6. "final": true means you have stopped searching for good. Set it only on the very last push, after every search variant is exhausted or the time limit is up; never on a mid-search push, and never on a push that only reports dropped leads while you are still looking. Once you send final, the search is closed and later job pushes are refused.
  7. PACK REQUEST: when I keep a job, I send a message starting "PACK REQUEST" with its link. Only then open its application form, copy every question into "formQuestions" (skip name, email, phone, resume and cover letter), and write the pack in English: cover letter, a short "about me", and an answer for every form question that is about the job, the company, or why I fit it (e.g. "Why us?", "What experience makes you a good fit for this position?"), each under the form's exact wording. The writing rules come with each PACK REQUEST. ${FACTS_RULE} POST {"packs":[{"url","formQuestions","pack"}]} to the same address; one pack per push is fine, send each as soon as it is written. A pack push is taken any time, search or not. Never search for new jobs on a PACK REQUEST.

WHAT I WANT
- Roles: ${prefs.targetRoles}${rolesNote(prefs.targetRoles)}
- I live in: ${place}. Work setting: ${prefs.workSettings.map(workSettingLabel).join(", ")}. ${remote}
- Job type: ${prefs.jobTypes.join(", ")}. Level: ${prefs.levels.length ? prefs.levels.join(", ") : "match my resume: the level I'm at now and one above"}.
- Pay: not a filter. Never drop a job over pay; just copy what the posting shows onto the card. Visa sponsorship: ${prefs.needsVisa ? "needed" : "not needed"}.
- Avoid: ${avoidList(prefs.avoidCompanies).join(", ") || "none"}.
${facts ? `
${facts}
` : ""}
THE LADDER, EVERY SEARCH
${ladderText(prefs)}

KILL ON SIGHT (from the search result, without opening)
- Another function in the title (sales, support, engineering, design, finance, interns), unless my roles include it.
- Recruiter, staffing agency or job-board mirror as the source.
- A location naming only another country, with no mention of ${prefs.country}, my region or anywhere.
- A visible date past my posting age limit.
- Anything on the skip list in the search request.
Postings you kill on sight from the title are not leads: don't open them and don't report them. Not sure from the result? Open the first screen only (summary, date, location line) and decide there. Open the full posting and form only for leads that pass. Titles vary, so judge by the scope of the work: if the day-to-day is not what my roles do, drop it as poor_fit with the note "different role". Keep a scratch list of every link you opened this search and never open one twice. A job you verified on an earlier search only needs confirming open; do not rebuild its pack.

BUDGET (every search and every page you open costs me)
- Per search: at most 12 web searches and 40 opened postings in total, across all rungs. Count them. When you reach either, POST {"jobs":[],"final":true} with what you have.
- Open a posting only after it has passed KILL ON SIGHT. Never open a company's whole careers board.
- Write short: progress notes one line, dropped notes under ten words, postings only as step 5 says.

STOP
- Quota reached: POST {"jobs":[],"final":true} and stop.
- Every rung you are allowed is dry: POST {"jobs":[],"final":true} with one honest line in chat: "Opened X, sent Y, rungs 0 to N exhausted, most drops were ...". Do not widen past the last rung to make up the number.
- Two hours in, whatever the count: final, same one line.
Dropping most leads is normal. Never stop early because leads keep failing; move to the next rung instead.
- A search or page that is cancelled, times out or errors: try once more with a different query or source, then move on. Never wait on a tool and never stop to ask me a question mid-search. If something you need is missing, do your best with what you have and say so in your final line.

CHECK EVERY JOB BEFORE SENDING (the endpoint enforces these and refuses jobs that fail)
1. Source: open the posting on the employer's own careers page or job system (Greenhouse, Lever, Ashby, Workable, Workday, SmartRecruiters, Teamtailor…). Never send a job board copy (RemoteOK, LinkedIn reposts, beBee, startup.jobs, Jobgether…).
2. Open today: you saw it accepting applications today. Send "verifiedOpenAt" = today. Skip anything that says closed or filled, or was posted over ${postingAgeDays(prefs)} days ago.
3. I can apply from ${prefs.country}: copy the posting's own location or eligibility line into "locationText", word for word. "Remote" alone is not enough; it must name ${prefs.country}, my region, or anywhere/worldwide. If it names only other countries (e.g. "U.S. Remote"), skip it.
4. Exact facts: title, company and job type exactly as the posting says. A contract is not full-time. If the posting shows pay, copy it into "salary" with currency and period (e.g. "USD 120,000–150,000 a year").
5. Must-haves: list the posting's hard requirements (years, domain, skills, hours overlap) in "mustHaves", each marked met or not met from my resume. One missed requirement, including years of experience or a nice-to-have tool, is not a reason to drop: send the job with matchScore 55 or lower and the gap listed, and let me decide. Drop as poor_fit only when I miss most of them or the work itself is a different role.

CARD WRITING
- Write like a person: short plain sentences, no dashes, no bullet points, no clichés.
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
Body: {"jobs":[JOB, ...], "final": true|false, "dropped":[DROP, ...], "packs":[PACK, ...]}  (0–50 jobs, 0–50 packs)
  "final": true only when you have stopped searching for good. It closes the search; pushes after it are refused.
  Mid-search pushes, including ones that only carry "dropped", are "final": false (or leave it out).
DROP: {"company","title","url"(optional),"reason": not_eligible|too_old|closed|poor_fit|duplicate|work_setting|unreachable|other,"note"(short),"posting"(optional)}
  "posting": only for a lead you opened that is still open and dropped as poor_fit, not_eligible, work_setting or duplicate:
  url, title, company, city, country, workSetting, postedAt, locationText. Nothing else. Never for closed, too_old or unreachable.
  Every lead you looked at and dropped. Send them with the next push (or on their own with "jobs":[]).
  unreachable: the page blocked you or would not load. Hosts that blocked you are skipped for a week.
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
  postedAt      ISO date from the posting; required when shown. Older than the user's posting age limit (${MAX_POSTING_AGE_DAYS} days unless the brief or search request says otherwise) is refused
  matchScore    required  0–100, how well the user fits; 55 or lower if any must-have is not met
  whyFit        wanted    2–3 plain sentences (falls back to summary)
  gaps          optional  list of honest shortfalls
  companyNotes  optional  2–3 sentences from the posting or the company's own site
  companyWebsite wanted   the company's own website, e.g. "acme.com" (used for its logo)
  companyStage  optional  e.g. "Series B", "Public", "Profitable, bootstrapped"
  companySize   optional  e.g. "~200 people"
  industry      optional  e.g. "Fintech · Payments"
  perks         optional  up to 6 short perks from the posting, e.g. ["Fully remote","Learning budget"]
  highlights    required  1–3 short reasons the user fits, each under 15 words
  summary       recommended one plain line on what the job is, from the posting, under 25 words
                          e.g. "Own the onboarding flow for a payments app used by 2M people"
  salaryEstimated optional true when "salary" is your estimate rather than the posting's
  locationText  required  the posting's location/eligibility line, copied word for word
  mustHaves     wanted    [{"requirement":"5+ years of product management","met":false}, ...]
                          the posting's hard requirements, checked against the resume
  verifiedOpenAt wanted   ISO date you last saw the posting open (today)
  formQuestions optional  normally sent with the PACK, not the card (see PACK)
  pack          optional  normally sent later, with the PACK, after a PACK REQUEST; the fields are listed under PACK

PACK: {"url": the job's link exactly as you sent it, "formQuestions": [...], "pack": {...}}
  Sent in "packs" after the user keeps a job and a PACK REQUEST names it. Any time, search or not.
  formQuestions wanted    every question on the job's application form, exactly as worded:
                          [{"question":"Are you willing to relocate?","options":["Yes","No"],"required":true}, ...]
                          open the "Apply" form to read them; include "options" for choices.
                          Skip name, email, phone, resume and cover letter fields.
  pack          required
    coverLetter required  under 350 words
    aboutMe     required  2–3 sentences for "tell us about yourself"
    answers     one entry per form question you can answer, "question" copied exactly from the form:
                          questions about the job, company or fit (facts only from the resume) and
                          questions about the user answered only from the ABOUT ME block in the brief or
                          search request. Never guess a fact about the user; leave that question out.
    claims      wanted    [{"claim":"...","evidence":"<exact words from the resume>"}]; a claim without exact evidence is dropped
                          one entry per fact about the user used in the pack

REPLY
  {"accepted":n,"rejected":[{"url","code","hint"}],"adjusted":[{"url","note"}],"remaining":n,"skippedRecently":[{"title","company","reason"}],
   "packsAccepted":n,"packsRejected":[{"url","code","hint"}]}
  codes: bad_job, not_employer_link, not_eligible, poor_fit, work_setting_not_wanted,
         wrong_country, company_avoided, stale_posting, duplicate, found_by_other_headhunter,
         search_limit, job_closed, bad_url, paused, no_search_requested
  pack codes: bad_pack, unknown_job (the link matches no job on the board)
  Long text is cut to fit and claims without exact resume evidence are dropped from the pack;
  the job is still accepted and "adjusted" says what changed.
  Fix what each hint says. Do not resend accepted jobs.
  duplicate also covers the same posting under another link (tracking parameters, old and new
  job-board addresses) and the same title at the same company within 60 days.
  skippedRecently lists jobs the user skipped and why. Avoid similar jobs.

When remaining is 0, the search is complete: stop and wait for the next request.`;
}
