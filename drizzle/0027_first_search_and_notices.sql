ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "overrides" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "meta" jsonb
);--> statement-breakpoint
ALTER TABLE "notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notices" ADD CONSTRAINT "notices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_user_kind" ON "notices" USING btree ("user_id","kind","sent_at");
