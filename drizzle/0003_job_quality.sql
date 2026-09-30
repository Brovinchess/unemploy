ALTER TABLE "jobs" ADD COLUMN "location_text" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "must_haves" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_checked_at" timestamp with time zone;