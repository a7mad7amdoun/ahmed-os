ALTER TABLE "days" ADD COLUMN "excuses_logged" integer;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "avoidance_flags" integer;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "scheduled_events" integer;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "on_time_events" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "target_wake_time" text DEFAULT '06:00' NOT NULL;