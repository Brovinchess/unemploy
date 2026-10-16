ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "pack_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "pack_requested_at" timestamp with time zone;
