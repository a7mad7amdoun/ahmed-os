CREATE TABLE "category_score_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"raw_points" numeric(6, 2) NOT NULL,
	"max_points" numeric(6, 2) NOT NULL,
	"cap_applied" integer,
	"uncapped_score" integer NOT NULL,
	"final_score" integer NOT NULL,
	"status" text NOT NULL,
	"breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direction_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"horizon" text NOT NULL,
	"text" text NOT NULL,
	"written_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"area" text NOT NULL,
	"rating" integer NOT NULL,
	"recorded_on" date NOT NULL,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "category_score_log" ADD CONSTRAINT "category_score_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direction_notes" ADD CONSTRAINT "direction_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_ratings" ADD CONSTRAINT "life_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "score_log_user_date_cat_idx" ON "category_score_log" USING btree ("user_id","date","category");--> statement-breakpoint
CREATE INDEX "score_log_user_date_idx" ON "category_score_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "direction_user_horizon_idx" ON "direction_notes" USING btree ("user_id","horizon");--> statement-breakpoint
CREATE INDEX "life_ratings_user_area_idx" ON "life_ratings" USING btree ("user_id","area");