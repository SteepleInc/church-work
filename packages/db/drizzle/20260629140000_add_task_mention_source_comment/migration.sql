ALTER TABLE "task_mentions" ADD COLUMN "source_comment_id" text;

CREATE INDEX "task_mentions_source_comment_idx" ON "task_mentions" USING btree ("church_id", "source_comment_id");

-- Re-scope the live-edge uniqueness per source body. Mentions authored in a
-- comment carry that comment's id; description mentions leave it NULL, coalesced
-- to '' so Postgres does not treat distinct NULLs as separate rows (which would
-- let a single description re-insert duplicate live edges).
DROP INDEX "task_mentions_user_edge_live_idx";
DROP INDEX "task_mentions_task_edge_live_idx";

CREATE UNIQUE INDEX "task_mentions_user_edge_live_idx" ON "task_mentions" USING btree ("church_id", "source_task_id", COALESCE("source_comment_id", ''), "target_user_id") WHERE "task_mentions"."deleted_at" IS NULL AND "task_mentions"."target_user_id" IS NOT NULL;
CREATE UNIQUE INDEX "task_mentions_task_edge_live_idx" ON "task_mentions" USING btree ("church_id", "source_task_id", COALESCE("source_comment_id", ''), "target_task_id") WHERE "task_mentions"."deleted_at" IS NULL AND "task_mentions"."target_task_id" IS NOT NULL;
