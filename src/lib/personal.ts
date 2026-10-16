import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { FormQuestion, PackAnswer, User } from "@/db/schema";
import { questionKey, saveAnswers, sensitiveQuestion } from "./extension";
import { humanise } from "./text";

// Form questions about the person (not the job). The headhunter reads each job's form and
// answers what it can from the person's details and saved answers; those answers are checked
// once here. What it couldn't answer is asked of the person directly. Either way the result
// becomes a saved answer the extension fills from.

// Questions the extension already fills from the person's details or the job's pack.
const HANDLED =
  /first name|last name|full name|^name$|legal name|preferred name|e-?mail|phone|mobile|resume|\bcv\b|cover letter|linkedin|github|portfolio|website|personal (site|url)|twitter|\bx\.com|instagram|facebook|dribbble|behance|other (url|link)/i;
// Consent boxes and acknowledgements are ticked on the form, never asked or remembered.
const CONSENT =
  /i (agree|accept|acknowledge|consent|certify|confirm)|terms (and|&) conditions|privacy (policy|notice)|data (protection|processing)|by (submitting|checking)|confirm that (the|all) (information|details)|information (provided|given|above) is (true|accurate|correct)|certify that|acknowledge that/i;
// Questions whose honest answer is almost always "No": prefilled for the person to confirm.
const USUALLY_NO = /referred you|been referred|referral (from|by)|worked (for|at|with) .{0,40}before|previously (worked|been employed)|former employee|related to|personal relationship|family member|relative (of|who)|conflict of interest/i;
// Questions about the job or company, or about how the person fits it: the headhunter
// answers those in each pack, because only it has read the posting.
export const ABOUT_THE_JOB =
  /why (do you|are you|would you|should we)|why .*\b(us|company|here|join|role|position|team)\b|interest(ed)? in (this|the|our)|what excites you|(about|know of|heard of) (this|the|our) (role|company|position|team|job)|(this|the) (position|role|job|opportunity) (appeal|interest|excite|attract)|good fit|right fit|makes you (a|the)|qualif(y|ied|ications) (you )?for|suited (to|for)|what (would|will|can) you bring|relevant experience|experience (do you have )?that/i;
// "for this role" on its own is not a job question: "Are you willing to relocate for this role?" is about the person.
export const isAboutTheJob = (q: string) => ABOUT_THE_JOB.test(q);

const words = (s: string) => new Set(questionKey(s).split(" ").filter((w) => w.length > 2));
// Share of the shorter question's words found in the other (same measure as the extension).
export function similarity(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.min(A.size, B.size);
}
const SAME = 0.7;

// What the person's application details already cover, so those aren't asked again.
export function coveredByDetails(q: string, user: Pick<User, "applicant">) {
  const a = user.applicant;
  if (!a) return false;
  if (/sponsor|authori[sz]ed|right to work|eligible to work|work permit|visa|legally (able|allowed|permitted)/i.test(q)) return !!a.workAuthorization;
  if (/notice period|start date|when can you start|availab(le|ility) to start|earliest start/i.test(q)) return !!a.noticePeriod;
  if (/salary|compensation|pay expectation|expected pay|desired pay/i.test(q)) return !!a.salaryExpectation;
  if (/current (company|employer)|(company|employer) (you )?(currently )?work|present employer|most recent (company|employer)/i.test(q)) return !!a.currentCompany;
  if (/current (job )?title|current (role|position)|most recent (title|role|position)|job title|employment status/i.test(q)) return !!a.currentTitle;
  if (/where (are you|do you) (currently )?(based|located|live|reside)|current(ly)? (city|location|located)|country of residence|what location|location do you|plan to work from|time ?zone are you/i.test(q)) return !!a.location;
  return false;
}

// Adds a job's form questions to the person's queue, skipping ones already handled. A question
// the headhunter answered from the person's facts is queued for a check with that answer
// prefilled; one it left unanswered is queued for the person to answer.
export async function queueQuestions(userId: string, company: string, formQuestions: FormQuestion[], packAnswers: PackAnswer[]) {
  if (!formQuestions.length) return 0;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return 0;
  const known = [
    ...(user.savedAnswers ?? []).map((a) => a.question),
    ...(await db.select({ q: schema.questions.question }).from(schema.questions).where(eq(schema.questions.userId, userId))).map((r) => r.q),
  ];
  let added = 0;
  for (const f of formQuestions) {
    const q = f.question.replace(/\s+/g, " ").trim().slice(0, 300);
    if (q.length < 3 || HANDLED.test(q) || CONSENT.test(q) || ABOUT_THE_JOB.test(q) || sensitiveQuestion(q) || coveredByDetails(q, user)) continue;
    if (known.some((k) => similarity(q, k) >= SAME)) continue;
    const options = (f.options ?? []).map((o) => o.trim().slice(0, 120)).filter(Boolean).slice(0, 30);
    const guess = packAnswers.find((p) => similarity(q, p.question) >= SAME)?.answer.trim() || (USUALLY_NO.test(q) ? "No" : null);
    // A choice must be one of the form's own ("Yes." still counts as "Yes"); otherwise the person picks.
    const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const answer = !guess ? null : options.length ? (options.find((o) => plain(o) === plain(guess)) ?? null) : humanise(guess).slice(0, 1000);
    const rows = await db
      .insert(schema.questions)
      .values({
        userId,
        question: q,
        key: questionKey(q),
        options: options.length ? options : null,
        company,
        status: answer ? "review" : "needs_you",
        answer,
        note: answer ? (USUALLY_NO.test(q) && !packAnswers.some((p) => similarity(q, p.question) >= SAME) ? "Usually No. Change it if that's not right." : "Your headhunter's answer, from your details") : null,
        answeredAt: answer ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.questions.id });
    if (rows.length) {
      known.push(q);
      added++;
    }
  }
  return added;
}

// The person confirms (or writes) an answer: it becomes a saved answer the extension fills.
export async function settleQuestion(user: User, id: string, answer: string) {
  const row = await db.query.questions.findFirst({ where: and(eq(schema.questions.id, id), eq(schema.questions.userId, user.id)) });
  if (!row) return;
  await saveAnswers(user, [{ question: row.question, answer }]);
  await db.delete(schema.questions).where(eq(schema.questions.id, row.id));
}

export async function questionCounts(userId: string) {
  const rows = await db
    .select({ status: schema.questions.status })
    .from(schema.questions)
    .where(and(eq(schema.questions.userId, userId), ne(schema.questions.status, "ignored")));
  // "new" and "asked" are from before the headhunter answered these itself; they need the person too.
  const c = { review: 0, needs_you: 0 };
  for (const r of rows) c[r.status === "review" ? "review" : "needs_you"]++;
  return { ...c, forYou: c.review + c.needs_you };
}
