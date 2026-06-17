CREATE TABLE "cycle_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"cycle_id" text NOT NULL,
	"template_task_id" text NOT NULL,
	"lifecycle" text NOT NULL,
	"overrides" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"church_time_zone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"template_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"anchor_date" text,
	"key_date_id" text
);
--> statement-breakpoint
CREATE TABLE "key_date_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"key_date_id" text NOT NULL,
	"local_date" text NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "key_dates" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"schedule" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"template_id" text NOT NULL,
	"template_team_id" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"parent_template_task_id" text,
	"scheduling_rule" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"template_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"mapped_team_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"recurrence" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cycle_adjustments_church_id_idx" ON "cycle_adjustments" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "cycle_adjustments_church_cycle_id_idx" ON "cycle_adjustments" USING btree ("church_id","cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_adjustments_cycle_template_task_live_idx" ON "cycle_adjustments" USING btree ("cycle_id","template_task_id") WHERE "cycle_adjustments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "cycles_church_id_idx" ON "cycles" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_church_start_date_live_idx" ON "cycles" USING btree ("church_id","start_date") WHERE "cycles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "focus_windows_church_id_idx" ON "focus_windows" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "focus_windows_template_id_idx" ON "focus_windows" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_windows_template_key_live_idx" ON "focus_windows" USING btree ("template_id","key") WHERE "focus_windows"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "key_date_occurrences_church_id_idx" ON "key_date_occurrences" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "key_date_occurrences_key_date_id_idx" ON "key_date_occurrences" USING btree ("key_date_id");--> statement-breakpoint
CREATE UNIQUE INDEX "key_date_occurrences_key_date_local_date_live_idx" ON "key_date_occurrences" USING btree ("key_date_id","local_date") WHERE "key_date_occurrences"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "key_dates_church_id_idx" ON "key_dates" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "key_dates_church_key_live_idx" ON "key_dates" USING btree ("church_id","key") WHERE "key_dates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "template_tasks_church_id_idx" ON "template_tasks" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "template_tasks_template_id_idx" ON "template_tasks" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_tasks_template_team_id_idx" ON "template_tasks" USING btree ("template_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_tasks_template_key_live_idx" ON "template_tasks" USING btree ("template_id","key") WHERE "template_tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "template_teams_church_id_idx" ON "template_teams" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "template_teams_template_id_idx" ON "template_teams" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_teams_mapped_team_id_idx" ON "template_teams" USING btree ("mapped_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_teams_template_key_live_idx" ON "template_teams" USING btree ("template_id","key") WHERE "template_teams"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "templates_church_id_idx" ON "templates" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_church_key_live_idx" ON "templates" USING btree ("church_id","key") WHERE "templates"."deleted_at" IS NULL;