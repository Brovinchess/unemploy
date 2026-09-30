import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import type { Preferences } from "@/lib/preferences";

const now = () => new Date();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // Hello Minds OAuth `sub` (a user id, not the Builder humanId).
  hmUserId: text("hm_user_id").notNull().unique(),
  username: text("username"),
  timezone: text("timezone"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProfileStatus =
  | "draft" // named, no Mind yet
  | "needs_topup" // Mind awakened, waiting for cognition
  | "needs_resume"
  | "needs_preferences"
  | "hunting"
  | "paused";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  status: text("status").$type<ProfileStatus>().notNull().default("draft"),
  mindId: text("mind_id"),
  mindName: text("mind_name"),
  conversationAlias: text("conversation_alias"),
  // SHA-256 of the secret the Mind sends with every push.
  ingestKeyHash: text("ingest_key_hash"),
  resumeFileName: text("resume_file_name"),
  resumeMime: text("resume_mime"),
  resumeData: text("resume_data"), // base64
  resumeText: text("resume_text"),
  preferences: text("preferences", { mode: "json" }).$type<Preferences>(),
  briefedAt: integer("briefed_at", { mode: "timestamp_ms" }),
  lastDeliveryAt: integer("last_delivery_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

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

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
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
    gaps: text("gaps", { mode: "json" }).$type<string[]>().notNull(),
    companyNotes: text("company_notes"),
    status: text("status").$type<JobStatus>().notNull().default("new"),
    skipReason: text("skip_reason"),
    demo: integer("demo", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    statusChangedAt: integer("status_changed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("jobs_profile_url").on(t.profileId, t.url), index("jobs_profile_created").on(t.profileId, t.createdAt)],
);

export type PackAnswer = { question: string; answer: string };
export type PackClaim = { claim: string; evidence: string };

export const packs = sqliteTable("packs", {
  jobId: text("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }),
  coverLetter: text("cover_letter").notNull(),
  aboutMe: text("about_me").notNull(),
  answers: text("answers", { mode: "json" }).$type<PackAnswer[]>().notNull(),
  claims: text("claims", { mode: "json" }).$type<PackClaim[]>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

// Every push the Mind makes, accepted or not — the first place to look when a headhunter goes quiet.
export const ingestLog = sqliteTable("ingest_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  accepted: integer("accepted").notNull(),
  rejected: integer("rejected").notNull(),
  detail: text("detail", { mode: "json" }),
  dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Pack = typeof packs.$inferSelect;
