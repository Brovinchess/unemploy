ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_search_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_search_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_search_noticed_at" timestamp with time zone;
