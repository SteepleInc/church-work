CREATE TABLE "labels" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"team_id" text,
	"name" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text DEFAULT 'teammembership' NOT NULL,
	"church_id" text NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"name" text NOT NULL,
	"identifier" text NOT NULL,
	"previous_identifiers" text DEFAULT '[]' NOT NULL,
	"color" text NOT NULL,
	"sort_order" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"task_state" text NOT NULL,
	"sort_order" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "labels_church_id_idx" ON "labels" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "labels_team_id_idx" ON "labels" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_church_scope_name_live_idx" ON "labels" USING btree ("church_id",lower("name")) WHERE "labels"."team_id" IS NULL AND "labels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_team_scope_name_live_idx" ON "labels" USING btree ("team_id",lower("name")) WHERE "labels"."team_id" IS NOT NULL AND "labels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "team_memberships_church_id_idx" ON "team_memberships" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "team_memberships_team_id_idx" ON "team_memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_memberships_team_user_idx" ON "team_memberships" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "teams_church_id_idx" ON "teams" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_church_identifier_live_idx" ON "teams" USING btree ("church_id","identifier") WHERE "teams"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workflow_statuses_church_id_idx" ON "workflow_statuses" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "workflow_statuses_workflow_id_idx" ON "workflow_statuses" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_statuses_workflow_key_live_idx" ON "workflow_statuses" USING btree ("workflow_id","key") WHERE "workflow_statuses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workflows_church_id_idx" ON "workflows" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "workflows_team_id_idx" ON "workflows" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_team_live_idx" ON "workflows" USING btree ("team_id") WHERE "workflows"."deleted_at" IS NULL;