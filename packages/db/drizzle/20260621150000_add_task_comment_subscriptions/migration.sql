CREATE TABLE "task_comment_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "_tag" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "deleted_at" timestamp with time zone,
  "deleted_by" text,
  "church_id" text NOT NULL,
  "task_id" text NOT NULL,
  "root_comment_id" text NOT NULL,
  "user_id" text NOT NULL
);

CREATE INDEX "task_comment_subscriptions_church_task_idx" ON "task_comment_subscriptions" USING btree ("church_id", "task_id");
CREATE UNIQUE INDEX "task_comment_subscriptions_user_thread_live_idx" ON "task_comment_subscriptions" USING btree ("church_id", "root_comment_id", "user_id") WHERE "task_comment_subscriptions"."deleted_at" IS NULL;
