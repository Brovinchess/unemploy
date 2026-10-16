import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import type { JobStatus, QuestionStatus } from "@/db/schema";
import { mindsConfig } from "./minds/config";
import { getCurrentUser } from "./session";

// Who may open admin.careerninja.app. Usernames, comma separated, in ADMIN_USERS; the owner by default.
const ADMINS = new Set((process.env.ADMIN_USERS ?? "rovinc").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isAdmin = (username: string | null | undefined) => !!username && ADMINS.has(username.toLowerCase());

// Signed-out visitors go to the main site to sign in (the session cookie covers the admin
// subdomain, so they can come back); signed-in non-admins see a 404, not a hint.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect(`${mindsConfig.appUrl}/auth/login`);
  if (!isAdmin(user.username)) notFound();
  return user;
}

// ---- time ------------------------------------------------------------------------------

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
export const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);
export const when = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const mins = (a: Date, b: Date | null) => (b ? Math.max(1, Math.round((b.getTime() - a.getTime()) / 60_000)) : null);
// Whole days between two moments, for "7 days ago" style cells.
export const daysBetween = (a: Date, b: Date) => Math.floor(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
// Sessions store only when they expire; they live 30 days, so creation is expiry minus that.
export const SESSION_TTL_MS = 30 * 86_400_000;
export const sessionCreatedAt = (expiresAt: Date) => new Date(expiresAt.getTime() - SESSION_TTL_MS);

// Morning, afternoon or evening in the admin's own timezone (UTC when none is set): the
// sidebar's Mochi caption. Computed here so no component reads the clock itself.
export type TimeOfDay = "morning" | "afternoon" | "evening";
export function timeOfDay(timeZone: string | null | undefined, now = new Date()): TimeOfDay {
  let hour = now.getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timeZone || "UTC" }).format(now)) % 24;
  } catch {
    // Unknown timezone string: fall back to UTC.
  }
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
export const MOCHI_CAPTION: Record<TimeOfDay, string> = {
  morning: "Mochi is still waking up.",
  afternoon: "Mochi is napping between searches.",
  evening: "Mochi has clocked off for the day.",
};

// ---- counting --------------------------------------------------------------------------

export function tally<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
export const sum = <T>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
export const ratio = (a: number, b: number, digits = 1) => (b ? (a / b).toFixed(digits) : "–");
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Buckets for the per-day charts: one key per calendar day (UTC) from the start of the
// window to today, oldest first. The window starts at `since`, which may fall on the day
// before the first full day, so there are days + 1 buckets.
export function dayKeys(days: number): string[] {
  const keys: string[] = [];
  for (let i = days; i >= 0; i--) keys.push(day(daysAgo(i)));
  return keys;
}
export function perDay<T>(rows: T[], keys: string[], at: (r: T) => Date | null | undefined, value: (r: T) => number = () => 1): number[] {
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map(() => 0);
  for (const r of rows) {
    const i = idx.get(day(at(r)));
    if (i != null) out[i] += value(r);
  }
  return out;
}

// ---- job stages -------------------------------------------------------------------------

// Plain words for the job statuses, used the same way on every admin page.
export const STAGE_LABEL: Record<JobStatus, string> = {
  new: "New",
  saved: "To apply",
  applied: "Applied",
  heard_back: "Heard back",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  skipped: "Dismissed",
  expired: "Closed",
};
export const stageLabel = (s: string) => STAGE_LABEL[s as JobStatus] ?? s;
export const STAGE_ORDER: JobStatus[] = ["new", "saved", "applied", "heard_back", "interview", "offer", "rejected", "skipped", "expired"];
// "Kept": the person saved it or went further. "Applied+": applied or anything after.
export const KEPT = new Set<string>(["saved", "applied", "heard_back", "interview", "offer"]);
export const APPLIED_PLUS_LIST: JobStatus[] = ["applied", "heard_back", "interview", "offer"];
export const APPLIED_PLUS = new Set<string>(APPLIED_PLUS_LIST);
export const PIPELINE: JobStatus[] = ["saved", "applied", "heard_back", "interview", "offer", "rejected"];

// Questions still waiting on the person (the two legacy statuses count as needs_you).
export const WAITING_QUESTION_LIST: QuestionStatus[] = ["needs_you", "new", "asked"];
export const WAITING_QUESTION = new Set<string>(WAITING_QUESTION_LIST);

// ---- query params, sorting ------------------------------------------------------------

export type Query = Record<string, string | undefined>;

// A link to the same page with some params changed; empty values drop the param.
export function withParams(base: string, q: Query, patch: Query) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...q, ...patch })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export type Dir = "asc" | "desc";
export function sortParams(q: Query, defaultKey: string, defaultDir: Dir = "desc") {
  const key = q.sort || defaultKey;
  const dir: Dir = q.dir === "asc" || q.dir === "desc" ? q.dir : key === defaultKey ? defaultDir : "desc";
  return { key, dir };
}

type SortValue = string | number | Date | boolean | null | undefined;
// Sorts a copy of rows by one accessor. Empty values always sink to the bottom.
export function sortRows<T>(rows: T[], key: string, dir: Dir, accessors: Record<string, (r: T) => SortValue>): T[] {
  const get = accessors[key];
  if (!get) return rows;
  const norm = (v: SortValue) => (v instanceof Date ? v.getTime() : typeof v === "boolean" ? (v ? 1 : 0) : v);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = norm(get(a));
    const y = norm(get(b));
    const xe = x == null || x === "";
    const ye = y == null || y === "";
    if (xe && ye) return 0;
    if (xe) return 1;
    if (ye) return -1;
    if (typeof x === "string" || typeof y === "string") return sign * String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return sign * (Number(x) - Number(y));
  });
}

// ---- text ----------------------------------------------------------------------------------

export const host = (u: string | null | undefined) => {
  if (!u) return "";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
export const includes = (hay: string | null | undefined, needle: string) => (hay ?? "").toLowerCase().includes(needle.toLowerCase());
// a***@domain and the last three digits only: enough to recognise, not enough to copy.
export const maskEmail = (e: string | null | undefined) => {
  if (!e) return "";
  const [local, domain] = e.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
};
export const maskPhone = (p: string | null | undefined) => {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  return digits.length > 3 ? `***${digits.slice(-3)}` : "***";
};

// ---- shared lookups ----------------------------------------------------------------------

// Users and headhunters, with the lookups every page needs to put a name on a row.
export async function directory() {
  const users = await db.query.users.findMany({ columns: { id: true, username: true, email: true, emailVerifiedAt: true, referralCode: true, referredBy: true, createdAt: true } });
  const profiles = await db.query.profiles.findMany({
    columns: { id: true, userId: true, label: true, status: true, mindId: true, mindName: true, searchStartedAt: true, searchEndedAt: true, lastDeliveryAt: true },
  });
  const userName = new Map(users.map((u) => [u.id, u.username ?? "(no name yet)"]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const nameOf = (userId: string) => userName.get(userId) ?? "?";
  const who = (profileId: string) => {
    const p = profileById.get(profileId);
    return p ? `${nameOf(p.userId)} · ${p.label}` : "?";
  };
  const userOfProfile = (profileId: string) => profileById.get(profileId)?.userId;
  const userByName = (username: string | undefined) => (username ? users.find((u) => u.username?.toLowerCase() === username.trim().toLowerCase()) : undefined);
  const profileIdsOf = (userId: string) => new Set(profiles.filter((p) => p.userId === userId).map((p) => p.id));
  return { users, profiles, userName, profileById, nameOf, who, userOfProfile, userByName, profileIdsOf };
}
export type Directory = Awaited<ReturnType<typeof directory>>;

// A push's rejection details, as stored in ingest_log.detail.
export type PushDetail = { url?: string; code?: string; hint?: string };
export const pushDetails = (detail: unknown): PushDetail[] => (Array.isArray(detail) ? (detail as PushDetail[]) : []);
// Codes that mean the Mind did something its brief told it not to (vs. market facts like not_eligible).
export const MIND_MISTAKES = ["bad_job", "not_employer_link", "job_closed", "stale_posting", "duplicate", "no_search_requested"] as const;


// ---- queries ----------------------------------------------------------------------------

// Runs query thunks a few at a time. Admin pages ask for many tables at once; firing them all
// together exceeds the connection pool and the client then pipelines statements on shared
// connections, which Supabase's pooler stalls on. Two at a time keeps every statement on its own
// connection and is still fast at this data size.
export async function queue<T extends readonly (() => Promise<unknown>)[]>(fns: [...T], width = 2): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: unknown[] = new Array(fns.length);
  let next = 0;
  async function worker() {
    while (next < fns.length) {
      const i = next++;
      out[i] = await fns[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, fns.length) }, worker));
  return out as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
