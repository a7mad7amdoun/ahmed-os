CREATE TYPE "public"."prayer_name" AS ENUM('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');--> statement-breakpoint
CREATE TYPE "public"."prayer_status" AS ENUM('not_logged', 'on_time', 'late', 'missed');--> statement-breakpoint
CREATE TYPE "public"."review_scope" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'yearly');--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"made_on" date NOT NULL,
	"due_on" date,
	"area" text DEFAULT 'deen' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_on" date,
	"source_reset" integer
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"energy" integer,
	"top_priority" text,
	"top_priority_done" boolean,
	"deep_work_minutes" integer,
	"work_minutes" integer,
	"value_created" text,
	"avoided_task" text,
	"kept_promises" boolean,
	"was_honest" boolean,
	"made_excuses" boolean,
	"family_contact" boolean,
	"family_responsibility" boolean,
	"family_note" text,
	"movement" boolean,
	"hygiene" boolean,
	"learning_minutes" integer,
	"learning_applied" boolean,
	"unnecessary_spend" numeric(10, 2),
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"label_ar" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"key" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "prayers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"prayer" "prayer_name" NOT NULL,
	"status" "prayer_status" DEFAULT 'not_logged' NOT NULL,
	"prayed_at" timestamp with time zone,
	"jamaah" boolean DEFAULT false NOT NULL,
	"mosque" boolean DEFAULT false NOT NULL,
	"manual_override" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "quran_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"pages" numeric(5, 1) DEFAULT '0' NOT NULL,
	"surah" text,
	"from_ayah" text,
	"to_ayah" text,
	"reflection" text,
	"memorization" text
);
--> statement-breakpoint
CREATE TABLE "reflections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"scope" "review_scope" DEFAULT 'daily' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"trigger" text,
	"what_happened" text,
	"real_cause" text,
	"can_control" text,
	"smallest_action" text,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"city" text DEFAULT 'Tetouan' NOT NULL,
	"latitude" numeric(9, 6) DEFAULT '35.578500' NOT NULL,
	"longitude" numeric(9, 6) DEFAULT '-5.368400' NOT NULL,
	"timezone" text DEFAULT 'Africa/Casablanca' NOT NULL,
	"fajr_angle" numeric(4, 1) DEFAULT '19.0' NOT NULL,
	"isha_angle" numeric(4, 1) DEFAULT '17.0' NOT NULL,
	"madhab" text DEFAULT 'Shafi' NOT NULL,
	"on_time_window_minutes" integer DEFAULT 30 NOT NULL,
	"quran_goal_pages" numeric(5, 1) DEFAULT '1.0' NOT NULL,
	"sleep_goal_hours" numeric(3, 1) DEFAULT '7.0' NOT NULL,
	"weekly_review_weekday" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"slept_at" timestamp with time zone,
	"woke_at" timestamp with time zone,
	"duration_minutes" integer,
	"quality" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"passcode_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_defs" ADD CONSTRAINT "practice_defs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quran_entries" ADD CONSTRAINT "quran_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resets" ADD CONSTRAINT "resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_entries" ADD CONSTRAINT "sleep_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitments_user_status_idx" ON "commitments" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "days_user_date_idx" ON "days" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "days_date_idx" ON "days" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_defs_user_key_idx" ON "practice_defs" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "practices_user_date_key_idx" ON "practices" USING btree ("user_id","date","key");--> statement-breakpoint
CREATE UNIQUE INDEX "prayers_user_date_prayer_idx" ON "prayers" USING btree ("user_id","date","prayer");--> statement-breakpoint
CREATE INDEX "prayers_user_date_idx" ON "prayers" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "quran_user_date_idx" ON "quran_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "reflections_user_date_scope_idx" ON "reflections" USING btree ("user_id","date","scope");--> statement-breakpoint
CREATE INDEX "resets_user_date_idx" ON "resets" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_user_date_idx" ON "sleep_entries" USING btree ("user_id","date");