CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"kind" text DEFAULT 'task' NOT NULL,
	CONSTRAINT "drafts_kind_check" CHECK ("kind" IN ('task'))
);
--> statement-breakpoint
CREATE TABLE "task_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"title" text,
	"description" text,
	"team_id" text,
	"workflow_status_id" text,
	"assigned_user_id" text,
	"priority" text,
	"estimate" text,
	"label_ids" text DEFAULT '[]' NOT NULL,
	"due_date" text,
	"parent_task_id" text,
	CONSTRAINT "task_drafts_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "drafts_church_owner_updated_live_idx" ON "drafts" USING btree ("church_id","owner_user_id","updated_at") WHERE "drafts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_drafts_church_id_idx" ON "task_drafts" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_drafts_draft_id_live_idx" ON "task_drafts" USING btree ("draft_id") WHERE "task_drafts"."deleted_at" IS NULL;
