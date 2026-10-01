CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"jobs_wanted" integer NOT NULL,
	"focus" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"jobs_added" integer,
	"balance_start" real,
	"balance_end" real
);
--> statement-breakpoint
ALTER TABLE "searches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "searches_profile_started" ON "searches" USING btree ("profile_id","started_at");