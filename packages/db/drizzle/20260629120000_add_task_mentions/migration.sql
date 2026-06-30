CREATE TABLE "task_mentions" (
  "id" text PRIMARY KEY NOT NULL,
  "_tag" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "deleted_at" timestamp with time zone,
  "deleted_by" text,
  "church_id" text NOT NULL,
  "source_task_id" text NOT NULL,
  "mention_kind" text NOT NULL,
  "target_user_id" text,
  "target_task_id" text
);

CREATE INDEX "task_mentions_source_idx" ON "task_mentions" USING btree ("church_id", "source_task_id");
CREATE INDEX "task_mentions_target_user_idx" ON "task_mentions" USING btree ("church_id", "target_user_id");
CREATE INDEX "task_mentions_target_task_idx" ON "task_mentions" USING btree ("church_id", "target_task_id");
CREATE UNIQUE INDEX "task_mentions_user_edge_live_idx" ON "task_mentions" USING btree ("church_id", "source_task_id", "target_user_id") WHERE "task_mentions"."deleted_at" IS NULL AND "task_mentions"."target_user_id" IS NOT NULL;
CREATE UNIQUE INDEX "task_mentions_task_edge_live_idx" ON "task_mentions" USING btree ("church_id", "source_task_id", "target_task_id") WHERE "task_mentions"."deleted_at" IS NULL AND "task_mentions"."target_task_id" IS NOT NULL;
