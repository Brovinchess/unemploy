CREATE TABLE "ingest_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingest_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"profile_id" uuid NOT NULL,
	"accepted" integer NOT NULL,
	"rejected" integer NOT NULL,
	"detail" jsonb,
	"dry_run" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"city" text,
	"country" text,
	"work_setting" text NOT NULL,
	"job_type" text,
	"level" text,
	"salary" text,
	"posted_at" text,
	"match_score" real NOT NULL,
	"why_fit" text NOT NULL,
	"gaps" jsonb NOT NULL,
	"company_notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"skip_reason" text,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "packs" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"cover_letter" text NOT NULL,
	"about_me" text NOT NULL,
	"answers" jsonb NOT NULL,
	"claims" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"mind_id" text,
	"mind_name" text,
	"conversation_alias" text,
	"ingest_key_hash" text,
	"resume_file_name" text,
	"resume_mime" text,
	"resume_data" text,
	"resume_text" text,
	"preferences" jsonb,
	"briefed_at" timestamp with time zone,
	"last_delivery_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_ingest_key_hash_unique" UNIQUE("ingest_key_hash")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hm_user_id" text NOT NULL,
	"username" text,
	"timezone" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_hm_user_id_unique" UNIQUE("hm_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_log" ADD CONSTRAINT "ingest_log_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_log_profile_created" ON "ingest_log" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_profile_url" ON "jobs" USING btree ("profile_id","url");--> statement-breakpoint
CREATE INDEX "jobs_profile_created" ON "jobs" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_profile_status" ON "jobs" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "profiles_user_id" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_conversation_alias" ON "profiles" USING btree ("conversation_alias");--> statement-breakpoint
CREATE INDEX "sessions_user_id" ON "sessions" USING btree ("user_id");