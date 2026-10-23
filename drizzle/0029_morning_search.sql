ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_search_jobs" integer;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "via" text;
