ALTER TABLE "jobs" ADD COLUMN "company_domain" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "company_stage" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "perks" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "highlights" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_estimated" boolean DEFAULT false NOT NULL;