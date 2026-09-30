CREATE TABLE `ingest_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`accepted` integer NOT NULL,
	`rejected` integer NOT NULL,
	`detail` text,
	`dry_run` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`city` text,
	`country` text,
	`work_setting` text NOT NULL,
	`job_type` text,
	`level` text,
	`salary` text,
	`posted_at` text,
	`match_score` real NOT NULL,
	`why_fit` text NOT NULL,
	`gaps` text NOT NULL,
	`company_notes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`skip_reason` text,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`status_changed_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_profile_url` ON `jobs` (`profile_id`,`url`);--> statement-breakpoint
CREATE INDEX `jobs_profile_created` ON `jobs` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `packs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`cover_letter` text NOT NULL,
	`about_me` text NOT NULL,
	`answers` text NOT NULL,
	`claims` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`mind_id` text,
	`mind_name` text,
	`conversation_alias` text,
	`ingest_key_hash` text,
	`resume_file_name` text,
	`resume_mime` text,
	`resume_data` text,
	`resume_text` text,
	`preferences` text,
	`briefed_at` integer,
	`last_delivery_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`hm_user_id` text NOT NULL,
	`username` text,
	`timezone` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_hm_user_id_unique` ON `users` (`hm_user_id`);