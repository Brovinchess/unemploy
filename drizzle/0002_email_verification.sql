CREATE TABLE "email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"referred_by" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "birthdate" date;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "email_codes_email_created" ON "email_codes" USING btree ("email","created_at");