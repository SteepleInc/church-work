CREATE TABLE "template_schedules" (
	"id" text PRIMARY KEY,
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
	"kind" text NOT NULL,
	"recurrence" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"rule" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_template_schedule_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_template_occurrence_key" text;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD COLUMN "placement_cycle_offset" integer;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD COLUMN "placement_weekday" integer;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "placement_shape" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_template_schedule_occurrence_task_live_idx" ON "tasks" ("source_template_schedule_id","source_template_task_id","source_template_occurrence_key") WHERE "deleted_at" IS NULL AND "source_template_schedule_id" IS NOT NULL AND "source_template_task_id" IS NOT NULL AND "source_template_occurrence_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "template_schedules_church_id_idx" ON "template_schedules" ("church_id");--> statement-breakpoint
CREATE INDEX "template_schedules_template_id_idx" ON "template_schedules" ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_schedules_template_key_live_idx" ON "template_schedules" ("template_id","key") WHERE "deleted_at" IS NULL;
