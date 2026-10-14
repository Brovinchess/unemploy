CREATE TABLE "postings" (
	"posting_key" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"company_key" text NOT NULL,
	"city" text,
	"country" text,
	"country_code" text,
	"work_setting" text,
	"job_type" text,
	"job_type_key" text,
	"level" text,
	"level_key" text,
	"salary" text,
	"salary_estimated" boolean DEFAULT false NOT NULL,
	"posted_at" text,
	"posted_on" date,
	"location_text" text,
	"summary" text,
	"must_haves" jsonb,
	"company_domain" text,
	"company_stage" text,
	"company_size" text,
	"industry" text,
	"perks" jsonb,
	"source" text NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_open_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "postings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "posting_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "job_type_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "level_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "posted_on" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "posting_key" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "posting_ref" text;--> statement-breakpoint
CREATE INDEX "postings_country_seen" ON "postings" USING btree ("country_code","last_seen_at");--> statement-breakpoint
CREATE INDEX "postings_company_key" ON "postings" USING btree ("company_key");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_posting_ref_postings_posting_key_fk" FOREIGN KEY ("posting_ref") REFERENCES "public"."postings"("posting_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_posting_key" ON "jobs" USING btree ("posting_key");