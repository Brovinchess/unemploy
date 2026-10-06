import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ApplicantDetails, SavedAnswer } from "@/db/schema";
import { detailFieldFor, usableAsDetail, withDetail } from "./answers";
import { hashKey } from "./keys";

// The Chrome extension authenticates with a token the signed-in web app hands it.
export async function createExtensionToken(userId: string) {
  const token = `cx_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hashKey(token) });
  return token;
}

export async function extensionUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("cx_")) return null;
  const row = await db.query.extensionTokens.findFirst({ where: eq(schema.extensionTokens.tokenHash, hashKey(token)) });
  if (!row) return null;
  await db.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, row.id));
  return db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
}

export const REQUIRED_DETAILS: (keyof ApplicantDetails)[] = ["firstName", "lastName", "email", "phone", "location"];
export const detailsComplete = (d: ApplicantDetails | null | undefined) => !!d && REQUIRED_DETAILS.every((k) => !!d[k]?.trim());

// Where the application form lives for each job system the extension supports.
export function applyUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "jobs.lever.co" && !u.pathname.endsWith("/apply")) u.pathname = u.pathname.replace(/\/$/, "") + "/apply";
    if (u.hostname === "jobs.ashbyhq.com" && !u.pathname.endsWith("/application")) u.pathname = u.pathname.replace(/\/$/, "") + "/application";
    return u.toString();
  } catch {
    return url;
  }
}

export const SUPPORTED_HOSTS = ["greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com"];
export const isSupported = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return SUPPORTED_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
  } catch {
    return false;
  }
};

// ---------- Saved answers ----------


const MAX_SAVED = 200;
export const questionKey = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Demographic and identity questions are never stored, even if the person answered them.
const SENSITIVE = /gender|sex\b|pronoun|race|ethnic|hispanic|latino|veteran|disab|sexual orientation|religio|marital|age\b|date of birth|birthday|social security|passport|national id|password/i;
export const sensitiveQuestion = (q: string) => SENSITIVE.test(q);

// Newer answers replace older ones to the same question.
export function mergeAnswers(existing: SavedAnswer[], incoming: { question: string; answer: string }[]) {
  const now = new Date().toISOString();
  const byKey = new Map(existing.map((a) => [questionKey(a.question), a]));
  for (const a of incoming) {
    const question = a.question.trim().slice(0, 300);
    const answer = a.answer.trim().slice(0, 1000);
    if (question.length < 3 || !answer || sensitiveQuestion(question)) continue;
    const field = detailFieldFor(question);
    byKey.set(questionKey(question), { question, answer, updatedAt: now, ...(field && usableAsDetail(field, answer) ? { field } : {}) });
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SAVED);
}

// Saves answers for a user: into the list, and the common ones (notice period, salary,
// right to work) into their application details too, so those fields fill themselves.
export async function saveAnswers(user: { id: string; savedAnswers: SavedAnswer[] | null; applicant: ApplicantDetails | null }, incoming: { question: string; answer: string }[]) {
  const savedAnswers = mergeAnswers(user.savedAnswers ?? [], incoming);
  let applicant = user.applicant ?? null;
  for (const a of incoming) {
    const field = detailFieldFor(a.question);
    if (field && usableAsDetail(field, a.answer)) applicant = withDetail(applicant, field, a.answer.trim().slice(0, 200));
  }
  await db.update(schema.users).set({ savedAnswers, applicant }).where(eq(schema.users.id, user.id));
  return savedAnswers;
}
