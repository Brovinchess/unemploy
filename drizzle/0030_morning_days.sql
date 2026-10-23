ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_search_days" text NOT NULL DEFAULT 'daily';
