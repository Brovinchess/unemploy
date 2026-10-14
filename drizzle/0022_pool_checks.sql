ALTER TABLE "postings" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "leads_posting_ref" ON "leads" USING btree ("posting_ref");