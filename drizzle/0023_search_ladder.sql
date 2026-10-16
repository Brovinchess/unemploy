ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "search_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "from_pool" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "pool_hits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "opened" integer;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "summary" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "brief_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_search_id" ON "jobs" USING btree ("search_id");
