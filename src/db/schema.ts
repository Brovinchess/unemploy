import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Preferences } from "@/lib/preferences";

// Row Level Security is enabled on every table with no policies: the app connects as the
// database owner (which bypasses RLS), while Supabase's public Data API sees nothing.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Hello Minds OAuth `sub` (a user id, not the Builder humanId).
  hmUserId: text("hm_user_id").notNull().unique(),
  username: text("username"),
  timezone: text("timezone"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: createdAt(),
}).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id").on(t.userId)],
).enableRLS();

export type ProfileStatus =
  | "draft" // named, no Mind yet
  | "needs_topup" // Mind awakened, waiting for cognition
  | "needs_resume"
  | "needs_preferences"
  | "hunting"
  | "paused";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    status: text("status").$type<ProfileStatus>().notNull().default("draft"),
    mindId: text("mind_id"),
    mindName: text("mind_name"),
    conversationAlias: text("conversation_alias"),
    // SHA-256 of the secret the Mind sends with every push.
    ingestKeyHash: text("ingest_key_hash").unique(),
    resumeFileName: text("resume_file_name"),
    resumeMime: text("resume_mime"),
    resumeData: text("resume_data"), // base64
    resumeText: text("resume_text"),
    preferences: jsonb("preferences").$type<Preferences>(),
    briefedAt: timestamp("briefed_at", { withTimezone: true }),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("profiles_user_id").on(t.userId), index("profiles_conversation_alias").on(t.conversationAlias)],
).enableRLS();

export type JobStatus =
  | "new"
  | "saved"
  | "applied"
  | "heard_back"
  | "interview"
  | "offer"
  | "rejected"
  | "skipped";

export type WorkSetting = "onsite" | "hybrid" | "remote";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    city: text("city"),
    country: text("country"),
    workSetting: text("work_setting").$type<WorkSetting>().notNull(),
    jobType: text("job_type"),
    level: text("level"),
    salary: text("salary"),
    postedAt: text("posted_at"),
    matchScore: real("match_score").notNull(),
    whyFit: text("why_fit").notNull(),
    gaps: jsonb("gaps").$type<string[]>().notNull(),
    companyNotes: text("company_notes"),
    status: text("status").$type<JobStatus>().notNull().default("new"),
    skipReason: text("skip_reason"),
    demo: boolean("demo").notNull().default(false),
    createdAt: createdAt(),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("jobs_profile_url").on(t.profileId, t.url),
    index("jobs_profile_created").on(t.profileId, t.createdAt),
    index("jobs_profile_status").on(t.profileId, t.status),
  ],
).enableRLS();

export type PackAnswer = { question: string; answer: string };
export type PackClaim = { claim: string; evidence: string };

export const packs = pgTable("packs", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  coverLetter: text("cover_letter").notNull(),
  aboutMe: text("about_me").notNull(),
  answers: jsonb("answers").$type<PackAnswer[]>().notNull(),
  claims: jsonb("claims").$type<PackClaim[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// Every push the Mind makes, accepted or not — the first place to look when a headhunter goes quiet.
export const ingestLog = pgTable(
  "ingest_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accepted: integer("accepted").notNull(),
    rejected: integer("rejected").notNull(),
    detail: jsonb("detail"),
    dryRun: boolean("dry_run").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ingest_log_profile_created").on(t.profileId, t.createdAt)],
).enableRLS();

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Pack = typeof packs.$inferSelect;

// Pre-launch waitlist. referral_code is shared as ?ref=…; referred_by is the code a signup came in with.
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    referralCode: text("referral_code").notNull().unique(),
    referredBy: text("referred_by"),
    roleArea: text("role_area"),
    country: text("country"),
    source: text("source"), // utm_source, if any
    name: text("name"),
    birthdate: date("birthdate"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }), // email confirmed with a code
    createdAt: createdAt(),
  },
  (t) => [index("waitlist_created").on(t.createdAt), index("waitlist_referred_by").on(t.referredBy)],
).enableRLS();

// One-time email codes. Only a hash of the code is stored; a verified row is the "ticket"
// that lets the same person finish signing up (name, birthdate) within a short window.
export const emailCodes = pgTable(
  "email_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    referredBy: text("referred_by"),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [index("email_codes_email_created").on(t.email, t.createdAt)],
).enableRLS();

export type WaitlistEntry = typeof waitlist.$inferSelect;
