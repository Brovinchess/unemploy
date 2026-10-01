CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"key" text NOT NULL,
	"options" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"answer" text,
	"note" text,
	"company" text,
	"asked_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "form_questions" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_mind_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_mind_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_alias" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_key_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_briefed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_user_key" ON "questions" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "questions_user_status" ON "questions" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_personal_key_hash_unique" UNIQUE("personal_key_hash");