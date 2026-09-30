CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"role_area" text,
	"country" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "waitlist_created" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_referred_by" ON "waitlist" USING btree ("referred_by");