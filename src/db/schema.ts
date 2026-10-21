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
  type AnyPgColumn,
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
  // Verified address for notifications (Hello Minds sign-in doesn't share one).
  email: text("email"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailOnSearchDone: boolean("email_on_search_done").notNull().default(true),
  // The search coach's pop-up before a search, after a slow one. Off when the person ticked "don't remind me".
  coachReminders: boolean("coach_reminders").notNull().default(true),
  // Friend referrals: the code this person shares (?ref=…) and the code they signed up with.
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  hmReferralUrl: text("hm_referral_url"), // their Hello Minds "refer a friend" link, pasted in once
  // What the Chrome extension types into application forms.
  applicant: jsonb("applicant").$type<ApplicantDetails>(),
  // Answers the person typed into application forms, reused on later forms.
  savedAnswers: jsonb("saved_answers").$type<SavedAnswer[]>(),
  // The retired personal Mind (a second Mind that answered form questions until Oct 2026).
  // Kept so existing ones can be switched off; nothing uses them now.
  personalMindId: text("personal_mind_id"),
  personalMindName: text("personal_mind_name"),
  personalAlias: text("personal_alias"),
  personalKeyHash: text("personal_key_hash").unique(),
  personalBriefedAt: timestamp("personal_briefed_at", { withTimezone: true }),
  personalSyncedAt: timestamp("personal_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
}).enableRLS();

export type ApplicantDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  workAuthorization?: string; // e.g. "Malaysian citizen, no sponsorship needed"
  noticePeriod?: string;
  salaryExpectation?: string;
  currentCompany?: string; // as it should appear on forms, e.g. "Animoca Brands"
  currentTitle?: string;
};

// `field` is set when the answer was promoted into application details (it stays here for
// the extension's matcher, but the list hides it).
export type SavedAnswer = { question: string; answer: string; updatedAt: string; field?: string };

// The Chrome extension's link to an account: a random token, stored hashed.
export const extensionTokens = pgTable(
  "extension_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("extension_tokens_user").on(t.userId)],
).enableRLS();

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

// Setup order: resume, then preferences, then launch and top up the Mind (money last).
export type ProfileStatus =
  | "draft" // legacy: named, nothing else yet (treated like needs_resume)
  | "needs_resume"
  | "needs_preferences"
  | "needs_topup" // preferences saved; Mind not launched yet, or launched and waiting for cognition
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
    prefsChangedAt: timestamp("prefs_changed_at", { withTimezone: true }),
    resumeChangedAt: timestamp("resume_changed_at", { withTimezone: true }),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    // Which version of the brief text this headhunter has; a lower number than BRIEF_VERSION
    // means the next search request carries the full new brief.
    briefVersion: integer("brief_version").notNull().default(0),
    // The Mind is on, outside a search, because packs were asked for; cleared when they land.
    packRequestedAt: timestamp("pack_requested_at", { withTimezone: true }),
    // Searches run only when the user asks. A search is active while started and not ended;
    // the Mind is switched off between searches.
    searchStartedAt: timestamp("search_started_at", { withTimezone: true }),
    searchEndedAt: timestamp("search_ended_at", { withTimezone: true }),
    // Last balance read from Hello Minds, so pages don't wait on that call; the live poll keeps it fresh.
    balanceCache: real("balance_cache"),
    balanceCachedAt: timestamp("balance_cached_at", { withTimezone: true }),
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
  | "skipped"
  | "expired"; // the posting closed before the user acted on it (daily recheck)

// A requirement from the posting and whether the resume shows it.
export type MustHave = { requirement: string; met: boolean };

export type WorkSetting = "onsite" | "hybrid" | "remote";

// A question from the job's application form, as the headhunter read it.
export type FormQuestion = { question: string; options?: string[]; required?: boolean };

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
    // Company facts for the job card: website (for the logo), stage, size, industry, perks.
    companyDomain: text("company_domain"),
    companyStage: text("company_stage"),
    companySize: text("company_size"),
    industry: text("industry"),
    perks: jsonb("perks").$type<string[]>(),
    // Two short "why you" lines for the card, and whether the pay is the Mind's estimate.
    highlights: jsonb("highlights").$type<string[]>(),
    // One line on what the job actually is, in plain words ("Own the onboarding flow for…").
    summary: text("summary"),
    formQuestions: jsonb("form_questions").$type<FormQuestion[]>(),
    salaryEstimated: boolean("salary_estimated").notNull().default(false),
    // Quality evidence from the Mind: the posting's own location/eligibility line, its
    // must-have requirements checked against the resume, and when it last saw it open.
    locationText: text("location_text"),
    mustHaves: jsonb("must_haves").$type<MustHave[]>(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    status: text("status").$type<JobStatus>().notNull().default("new"),
    skipReason: text("skip_reason"),
    // When the headhunter was last asked to write this job's application pack (packs are
    // written only for jobs the person keeps).
    packRequestedAt: timestamp("pack_requested_at", { withTimezone: true }),
    demo: boolean("demo").notNull().default(false),
    // Clean values beside the free text (see lib/normalise): the same posting's key in the
    // shared postings table, and filterable country, type, level and date.
    postingKey: text("posting_key"),
    countryCode: text("country_code"),
    jobTypeKey: text("job_type_key"),
    levelKey: text("level_key"),
    postedOn: date("posted_on"),
    // The search that delivered it, and whether it came from the shared pool rather than the web.
    searchId: uuid("search_id").references((): AnyPgColumn => searches.id, { onDelete: "set null" }),
    fromPool: boolean("from_pool").notNull().default(false),
    createdAt: createdAt(),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("jobs_profile_url").on(t.profileId, t.url),
    index("jobs_profile_created").on(t.profileId, t.createdAt),
    index("jobs_profile_status").on(t.profileId, t.status),
    index("jobs_posting_key").on(t.postingKey),
    index("jobs_search_id").on(t.searchId),
  ],
).enableRLS();

// Every posting any headhunter opened, as facts about the posting only: no user, no fit, no
// pack, no finder. One row per posting (keyed by lib/dedupe jobKey), kept fresh by the daily
// watchdog and retired after 60 days. The pool a Mind will check before searching.
export type PostingSource = "accepted" | "quota_refused" | "dropped_lead";

export const postings = pgTable(
  "postings",
  {
    postingKey: text("posting_key").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    companyKey: text("company_key").notNull(),
    city: text("city"),
    country: text("country"),
    countryCode: text("country_code"),
    workSetting: text("work_setting").$type<WorkSetting>(),
    jobType: text("job_type"),
    jobTypeKey: text("job_type_key"),
    level: text("level"),
    levelKey: text("level_key"),
    salary: text("salary"),
    salaryEstimated: boolean("salary_estimated").notNull().default(false),
    postedAt: text("posted_at"),
    postedOn: date("posted_on"),
    locationText: text("location_text"),
    summary: text("summary"),
    mustHaves: jsonb("must_haves").$type<string[]>(),
    companyDomain: text("company_domain"),
    companyStage: text("company_stage"),
    companySize: text("company_size"),
    industry: text("industry"),
    perks: jsonb("perks").$type<string[]>(),
    source: text("source").$type<PostingSource>().notNull(),
    demo: boolean("demo").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedOpenAt: timestamp("last_verified_open_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("postings_country_seen").on(t.countryCode, t.lastSeenAt), index("postings_company_key").on(t.companyKey)],
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

// Form questions waiting on an answer about the person. Once approved, an answer moves to
// users.savedAnswers (which the extension fills from) and the row is removed.
export type QuestionStatus =
  | "review" // the headhunter answered it from the person's facts; the person checks it once
  | "needs_you" // the headhunter couldn't; the person answers
  | "ignored" // the person chose not to answer
  | "new" // legacy (waiting for the retired personal Mind); treated as needs_you
  | "asked"; // legacy; treated as needs_you

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    key: text("key").notNull(),
    options: jsonb("options").$type<string[]>(),
    status: text("status").$type<QuestionStatus>().notNull().default("new"), // column default unchanged; inserts always set it
    answer: text("answer"),
    note: text("note"),
    // Where it was first seen, for context ("asked by Acme").
    company: text("company"),
    askedAt: timestamp("asked_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("questions_user_key").on(t.userId, t.key), index("questions_user_status").on(t.userId, t.status)],
).enableRLS();

export type Question = typeof questions.$inferSelect;

// Every push the Mind makes, accepted or not — the first place to look when a headhunter goes quiet.
// One row per search the user asked for, for the headhunter's history.
export type SearchOverrides = { maxPostingAgeDays?: number; remoteScope?: "region" | "anywhere"; budget?: { searches: number; opened: number }; first?: boolean };

export const searches = pgTable(
  "searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobsWanted: integer("jobs_wanted").notNull(),
    focus: text("focus"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason").$type<"finished" | "stopped" | "timeout" | "no_cognition">(),
    // When the app asked the headhunter to send what it had so far (at most once per search).
    nudgedAt: timestamp("nudged_at", { withTimezone: true }),
    jobsAdded: integer("jobs_added"),
    balanceStart: real("balance_start"),
    balanceEnd: real("balance_end"),
    // From Hello Minds' ledger, so a top-up during the search doesn't distort it.
    cognitionUsed: real("cognition_used"),
    // Jobs that came from the shared pool, postings opened in total, and the one-line summary
    // the app writes at the end ("opened 52, sent 2, most drops were ...") for the next request.
    poolHits: integer("pool_hits").notNull().default(0),
    opened: integer("opened"),
    summary: text("summary"),
    // Cognition per tool from the Hello Minds ledger, filled when the search ends.
    toolUsage: jsonb("tool_usage").$type<Record<string, { calls: number; cognition: number }>>(),
    // Settings this one search ran with when they differ from the person's own: the first search
    // casts a wider net (older postings, remote from the region, a bigger budget).
    overrides: jsonb("overrides").$type<SearchOverrides>(),
  },
  (t) => [index("searches_profile_started").on(t.profileId, t.startedAt)],
).enableRLS();

// Leads the headhunter considered and dropped, with its reason: shows the user why a search
// came back light, and keeps the next search from re-checking the same postings.
// "pay" is no longer offered to the Mind; rows from before still carry it.
export type DropReason = "not_eligible" | "too_old" | "closed" | "poor_fit" | "duplicate" | "work_setting" | "unreachable" | "other" | "pay";

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    searchId: uuid("search_id").references(() => searches.id, { onDelete: "set null" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    reason: text("reason").$type<DropReason>().notNull(),
    note: text("note"),
    // Same key as the postings table; the reference is set only when the Mind sent full facts.
    postingKey: text("posting_key"),
    postingRef: text("posting_ref").references(() => postings.postingKey, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("leads_profile_created").on(t.profileId, t.createdAt), index("leads_posting_ref").on(t.postingRef)],
).enableRLS();

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

// One row per friend who signed up through someone's link. "qualified" once the friend's first
// headhunter is running; "rewarded" once the referrer's cognition has been topped up (by hand).
export type ReferralStatus = "joined" | "qualified" | "rewarded";
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredId: uuid("referred_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<ReferralStatus>().notNull().default("joined"),
    reward: integer("reward").notNull().default(0), // cognition promised to the referrer
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
  },
  (t) => [index("referrals_referrer").on(t.referrerId)],
);
export type Referral = typeof referrals.$inferSelect;

// Pre-launch waitlist. referral_code is shared as ?ref=…; referred_by is the code a signup came in with.
// What people send from the feedback button: a bug, an idea, or anything else, with the page.
export type FeedbackKind = "bug" | "idea" | "other";
// One row per email the app sent on its own: the day-after setup reminder, the Monday digest.
// Keeps each from going twice and shows what reached whom.
export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("notices_user_kind").on(t.userId, t.kind, t.sentAt)],
).enableRLS();

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<FeedbackKind>().notNull(),
    message: text("message").notNull(),
    page: text("page"),
    status: text("status").$type<"new" | "done">().notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_created").on(t.createdAt)],
).enableRLS();

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
