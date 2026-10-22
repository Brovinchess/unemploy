ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "prev_ingest_key_hash" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ingest_key_hint" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_key_hint" ON "profiles" USING btree ("ingest_key_hint");
