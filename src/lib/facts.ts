import type { User } from "@/db/schema";

// What the headhunter may use to answer the personal questions on application forms: the
// person's application details and the answers they have given before. Sent with the brief
// and with every search request, so a headhunter briefed earlier still gets it.
const MAX_ANSWERS = 40;
const MAX_ANSWER_CHARS = 300;

export function factsText(user: Pick<User, "applicant" | "savedAnswers">) {
  const a = user.applicant;
  const details = a
    ? [
        a.location && `- Lives in: ${a.location}`,
        a.workAuthorization && `- Right to work: ${a.workAuthorization}`,
        a.noticePeriod && `- Notice period: ${a.noticePeriod}`,
        a.salaryExpectation && `- Salary expectation: ${a.salaryExpectation}`,
        a.currentCompany && `- Current company (write it exactly like this): ${a.currentCompany}`,
        a.currentTitle && `- Current title: ${a.currentTitle}`,
      ].filter(Boolean)
    : [];
  // Answers promoted into the details above are skipped; they would repeat.
  // One line each: a multi-line answer would break the list the Mind reads.
  const line = (s: string) => s.replace(/\s+/g, " ").trim();
  const saved = (user.savedAnswers ?? [])
    .filter((s) => !s.field)
    .slice(0, MAX_ANSWERS)
    .map((s) => {
      const a = line(s.answer);
      return `- Q: ${line(s.question)}\n  A: ${a.length > MAX_ANSWER_CHARS ? `${a.slice(0, MAX_ANSWER_CHARS)}…` : a}`;
    });
  if (!details.length && !saved.length) return "";
  return `ABOUT ME, for form questions about me (not the job)\n${[...details, ...saved].join("\n")}`;
}

// The rule that goes with the block, in the brief and in each request.
export const FACTS_RULE =
  'Form questions about me you answer from two places only, each under the form\'s exact wording in "answers": ABOUT ME (notice period, relocation, right to work, salary, licences, anything personal), and my resume for what it states (education and university, past employers and industries, years in a role or with a tool, current title and company, employment status, experience level), with a "claims" entry quoting the resume. Referral, "worked here before" and "related to an employee" questions are "No" unless ABOUT ME says otherwise. If neither covers a question, leave it out: never guess a fact about me; I\'ll answer it myself in the app. Answers taken from ABOUT ME need no "claims" entry.';
