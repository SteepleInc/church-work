CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"read_by" text,
	"snoozed_until" timestamp with time zone,
	"activity_id" text,
	"task_id" text,
	"task_comment_id" text,
	"task_comment_thread_id" text,
	"actor_user_id" text,
	"display_title" text NOT NULL,
	"display_body" text,
	"display_metadata" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_church_recipient_idx" ON "notifications" USING btree ("church_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "notifications_task_idx" ON "notifications" USING btree ("church_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_idempotency_live_idx" ON "notifications" USING btree ("church_id","recipient_user_id","idempotency_key") WHERE "notifications"."deleted_at" IS NULL;
