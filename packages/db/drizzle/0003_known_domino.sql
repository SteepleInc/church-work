CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"team_id" text NOT NULL,
	"number" integer NOT NULL,
	"previous_identifiers" text DEFAULT '[]' NOT NULL,
	"assigned_user_id" text,
	"created_by_user_id" text,
	"cycle_id" text,
	"due_date" text,
	"parent_task_id" text,
	"label_ids" text DEFAULT '[]' NOT NULL,
	"workflow_id" text NOT NULL,
	"workflow_status_id" text NOT NULL,
	"task_state" text NOT NULL,
	"estimate" text,
	"board_order" text NOT NULL,
	"finished_at" timestamp with time zone,
	"source_template_id" text,
	"source_template_task_id" text,
	"source_template_cycle_id" text,
	"source_template_sync_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "next_task_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_church_id_idx" ON "tasks" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "tasks_team_id_idx" ON "tasks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tasks_workflow_status_id_idx" ON "tasks" USING btree ("workflow_status_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_team_number_live_idx" ON "tasks" USING btree ("team_id","number") WHERE "tasks"."deleted_at" IS NULL;