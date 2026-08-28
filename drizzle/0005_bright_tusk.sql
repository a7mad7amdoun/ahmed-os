CREATE TABLE "habit_score_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"sub_habit_key" text NOT NULL,
	"input_type" text NOT NULL,
	"raw_value" text,
	"points" integer NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "major_score_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"foundation" integer NOT NULL,
	"responsibility" integer NOT NULL,
	"growth" integer NOT NULL,
	"overall_status" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habit_score_log" ADD CONSTRAINT "habit_score_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "major_score_log" ADD CONSTRAINT "major_score_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "habit_log_user_date_sub_idx" ON "habit_score_log" USING btree ("user_id","date","sub_habit_key");--> statement-breakpoint
CREATE INDEX "habit_log_user_date_idx" ON "habit_score_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "major_log_user_date_idx" ON "major_score_log" USING btree ("user_id","date");