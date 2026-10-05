import "server-only";
import { after } from "next/server";
import { and, desc, eq, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { FormQuestion, PackAnswer, User } from "@/db/schema";
import { mergeAnswers, questionKey, sensitiveQuestion } from "./extension";
import { minds } from "./minds/client";
import { mindsConfig } from "./minds/config";
import { ingestReachable } from "./search";

// The personal Mind is a second Mind that only learns about the person. The headhunter
// reads each job's application form and sends its questions; the ones about the person
// (not the job) are batched here and sent to the personal Mind after each search. Its
// answers are checked once by the person, then saved for the extension to fill.

const MAX_PER_BATCH = 40;
export const ASK_TIMEOUT_MS = 6 * 60 * 60 * 1000;

// Questions the extension already fills from the person's details or the job's pack.
const HANDLED =
  /first name|last name|full name|^name$|legal name|preferred name|e-?mail|phone|mobile|resume|\bcv\b|cover letter|linkedin|github|portfolio|website|personal (site|url)/i;
// Questions about the job or company, which the headhunter answers in each pack.
const ABOUT_THE_JOB = /why (do you|are you|would you)|why .*\b(us|company|here|join|role|position|team)\b|interest(ed)? in (this|the|our)|what excites you|about (this|the) (role|company)/i;

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
function coveredByDetails(q: string, user: User) {
  const a = user.applicant;
  if (!a) return false;
  if (/sponsor|authori[sz]ed|right to work|eligible to work|work permit|visa/i.test(q)) return !!a.workAuthorization;
  if (/notice period|start date|when can you start|available to start/i.test(q)) return !!a.noticePeriod;
  if (/salary|compensation|pay expectation|expected pay|desired pay/i.test(q)) return !!a.salaryExpectation;
  if (/where are you (based|located)|current (city|location)|country of residence/i.test(q)) return !!a.location;
  return false;
}

// Adds a job's form questions to the person's queue, skipping ones already handled.
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
    if (q.length < 3 || HANDLED.test(q) || ABOUT_THE_JOB.test(q) || sensitiveQuestion(q) || coveredByDetails(q, user)) continue;
    if (packAnswers.some((p) => similarity(q, p.question) >= SAME)) continue;
    if (known.some((k) => similarity(q, k) >= SAME)) continue;
    const options = (f.options ?? []).map((o) => o.trim().slice(0, 120)).filter(Boolean).slice(0, 30);
    const rows = await db
      .insert(schema.questions)
      .values({ userId, question: q, key: questionKey(q), options: options.length ? options : null, company })
      .onConflictDoNothing()
      .returning({ id: schema.questions.id });
    if (rows.length) {
      known.push(q);
      added++;
    }
  }
  return added;
}

export const personalReady = (u: User) => !!u.personalMindId && !!u.personalAlias && !!u.personalBriefedAt;

export function personalBrief(args: { username: string; ingestUrl: string; key: string; user: User }) {
  const { username, ingestUrl, key, user } = args;
  const a = user.applicant;
  const details = a
    ? [
        `- Name: ${a.firstName} ${a.lastName}`,
        `- Lives in: ${a.location}`,
        a.workAuthorization && `- Work authorisation: ${a.workAuthorization}`,
        a.noticePeriod && `- Notice period: ${a.noticePeriod}`,
        a.salaryExpectation && `- Salary expectation: ${a.salaryExpectation}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "- (none yet)";
  const saved = (user.savedAnswers ?? []).slice(0, 100).map((s) => `- Q: ${s.question}\n  A: ${s.answer}`).join("\n");

  return `${username} here. You are my personal Mind. Your only job is to know me well and answer the questions job application forms ask about me. My resume is attached.

WHAT YOU KNOW ABOUT ME SO FAR
${details}
${saved ? `\nAnswers I've given on forms:\n${saved}` : ""}

HOW WE WORK
- I message you only when I need something. Never search, schedule wake-ups or book calendar tasks on your own. Between my messages, do nothing.
- "REMEMBER" lines in my messages are new facts about me. Keep them; a newer fact replaces an older one.
- "QUESTIONS" lists form questions, each with an id, the form's wording and sometimes its choices. For each:
  - Answer only from my resume, the facts above and what I've told you since. Don't search the web.
  - Never guess. If you aren't sure, send "answer": null. I'll answer it myself and you'll learn it next time.
  - If it has choices, answer with one choice exactly as written.
  - Write as me, short, the way I'd type it into the form.
- POST all the answers in one go to ${ingestUrl}/api/personal with header "x-unemploy-key: ${key}":
  {"answers":[{"id":"<id>","answer":"<text>" or null,"note":"<where you got it, optional>"}]}
  The reply says what was saved. Then stop and wait for my next message.

Please reply with one line confirming you've got this. Nothing else to do now.`;
}

function questionsText(username: string, teach: { question: string; answer: string }[], qs: { id: string; question: string; options: string[] | null }[]) {
  const remember = teach.length ? `REMEMBER (new facts I've confirmed):\n${teach.map((t) => `- Q: ${t.question}\n  A: ${t.answer}`).join("\n")}\n\n` : "";
  const list = qs.length
    ? `QUESTIONS from job application forms:\n${qs
        .map((q) => `- id ${q.id}: ${q.question}${q.options?.length ? `\n  choices: ${q.options.map((o) => `"${o}"`).join(", ")}` : ""}`)
        .join("\n")}\n\nAnswer them as your brief says (null when unsure) and POST to ${mindsConfig.ingestUrl}/api/personal with your key (use this address even if your brief says another). If you can't reach it, reply once to say so and stop; don't keep retrying. Then stop.`
    : "No questions this time. Just remember the above, then stop.";
  return `${username} here.\n\n${remember}${list} (${new Date().toISOString()})`;
}

// Sends waiting questions, plus anything new the person has taught, in one message.
// Wakes the personal Mind; it is switched off again once it has replied.
export async function askPersonalMind(userId: string, opts: { teachOnly?: boolean } = {}) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || !personalReady(user)) return { sent: 0 };
  const outstanding = await db.query.questions.findFirst({
    where: and(eq(schema.questions.userId, userId), eq(schema.questions.status, "asked")),
  });
  if (outstanding) return { sent: 0, busy: true };

  const qs = opts.teachOnly
    ? []
    : await db.query.questions.findMany({
        where: and(eq(schema.questions.userId, userId), eq(schema.questions.status, "new")),
        orderBy: desc(schema.questions.createdAt),
        limit: MAX_PER_BATCH,
      });
  const since = user.personalSyncedAt?.toISOString() ?? "";
  const teach = (user.savedAnswers ?? []).filter((s) => s.updatedAt > since).slice(0, 60);
  if (!qs.length && !teach.length) return { sent: 0 };

  if (mindsConfig.ingestUrl.startsWith("https://") && !(await ingestReachable())) return { sent: 0, unreachable: true };
  const api = minds(user);
  const now = new Date();
  if (qs.length) {
    await db
      .update(schema.questions)
      .set({ status: "asked", askedAt: now })
      .where(inArray(schema.questions.id, qs.map((q) => q.id)));
  }
  try {
    await api.setEnabled(user.personalMindId!, true);
    await api.sendMessage(user.personalAlias!, questionsText(user.username ?? "Me", teach, qs));
  } catch (e) {
    if (qs.length) await db.update(schema.questions).set({ status: "new", askedAt: null }).where(inArray(schema.questions.id, qs.map((q) => q.id)));
    throw e;
  }
  await db.update(schema.users).set({ personalSyncedAt: now }).where(eq(schema.users.id, userId));
  // Nothing to reply to: give it a couple of minutes to take the facts in, then switch off.
  if (!qs.length) switchOffLater(userId);
  return { sent: qs.length, taught: teach.length };
}

export function switchOffLater(userId: string, ms = 120_000) {
  after(async () => {
    await new Promise((r) => setTimeout(r, ms));
    const asked = await db.query.questions.findFirst({
      where: and(eq(schema.questions.userId, userId), eq(schema.questions.status, "asked")),
    });
    if (!asked) await switchOffPersonal(userId);
  });
}

export async function switchOffPersonal(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user?.personalMindId) return;
  await minds(user)
    .setEnabled(user.personalMindId, false)
    .catch((e) => console.error("[personal] couldn't switch off", userId, e));
}

const replySchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string().trim().max(64),
        answer: z.string().trim().max(1000).nullable().optional(),
        note: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .max(100),
});

// The personal Mind's reply. Known answers wait for the person to check them once;
// unknown ones are asked of the person directly.
export async function processAnswers(user: User, body: unknown) {
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return { ok: false as const, hint: `Body must be {"answers":[{"id":"...","answer":"..." or null,"note":"..."}]}. ${issues}` };
  }
  const ids = parsed.data.answers.map((a) => a.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const rows = ids.length
    ? await db.query.questions.findMany({ where: and(eq(schema.questions.userId, user.id), inArray(schema.questions.id, ids)) })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  let answered = 0, unknown = 0;
  const problems: { id: string; hint: string }[] = [];
  for (const a of parsed.data.answers) {
    const row = byId.get(a.id);
    if (!row) {
      problems.push({ id: a.id, hint: "Unknown id. Use the ids from my latest QUESTIONS message." });
      continue;
    }
    if (row.status !== "asked" && row.status !== "new") continue; // already handled
    let answer = a.answer?.trim() || null;
    if (answer && row.options?.length) {
      const match = row.options.find((o) => o.toLowerCase() === answer!.toLowerCase());
      if (!match) {
        problems.push({ id: a.id, hint: `Answer with one choice exactly as written: ${row.options.join(" / ")}. Treated as unknown.` });
        answer = null;
      } else answer = match;
    }
    await db
      .update(schema.questions)
      .set({ status: answer ? "review" : "needs_you", answer, note: a.note?.trim() || null, answeredAt: new Date() })
      .where(eq(schema.questions.id, row.id));
    if (answer) answered++;
    else unknown++;
  }
  const stillAsked = await db.query.questions.findFirst({
    where: and(eq(schema.questions.userId, user.id), eq(schema.questions.status, "asked")),
  });
  // A short grace period lets the Mind finish its turn before it's switched off.
  if (!stillAsked) switchOffLater(user.id, 30_000);
  return {
    ok: true as const,
    saved: answered,
    unknown,
    problems,
    waitingFor: stillAsked ? "Some questions from my last message are still unanswered. Send them too." : null,
  };
}

// The person confirms (or writes) an answer: it becomes a saved answer the extension fills.
export async function settleQuestion(user: User, id: string, answer: string) {
  const row = await db.query.questions.findFirst({ where: and(eq(schema.questions.id, id), eq(schema.questions.userId, user.id)) });
  if (!row) return;
  const saved = mergeAnswers(user.savedAnswers ?? [], [{ question: row.question, answer }]);
  await db.update(schema.users).set({ savedAnswers: saved }).where(eq(schema.users.id, user.id));
  await db.delete(schema.questions).where(eq(schema.questions.id, row.id));
}

// Questions sent long ago with no reply go back in the queue (watchdog).
export async function releaseStaleQuestions() {
  const stale = await db
    .update(schema.questions)
    .set({ status: "new", askedAt: null })
    .where(and(eq(schema.questions.status, "asked"), isNotNull(schema.questions.askedAt), lt(schema.questions.askedAt, new Date(Date.now() - ASK_TIMEOUT_MS))))
    .returning({ userId: schema.questions.userId });
  const users = [...new Set(stale.map((s) => s.userId))];
  for (const u of users) await switchOffPersonal(u);
  return stale.length;
}

export async function questionCounts(userId: string) {
  const rows = await db
    .select({ status: schema.questions.status })
    .from(schema.questions)
    .where(and(eq(schema.questions.userId, userId), ne(schema.questions.status, "ignored")));
  const c = { new: 0, asked: 0, review: 0, needs_you: 0 };
  for (const r of rows) if (r.status in c) c[r.status as keyof typeof c]++;
  return { ...c, forYou: c.review + c.needs_you };
}
