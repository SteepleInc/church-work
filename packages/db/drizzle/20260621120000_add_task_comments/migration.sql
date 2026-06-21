CREATE TABLE "task_comments" (
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
  "parent_comment_id" text,
  "body" text NOT NULL,
  "authored_by_user_id" text NOT NULL
);
CREATE INDEX "task_comments_church_id_idx" ON "task_comments" USING btree ("church_id");
CREATE INDEX "task_comments_task_id_idx" ON "task_comments" USING btree ("church_id","task_id");
CREATE INDEX "task_comments_parent_idx" ON "task_comments" USING btree ("church_id","parent_comment_id");
