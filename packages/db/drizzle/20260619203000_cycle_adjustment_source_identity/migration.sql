ALTER TABLE "cycle_adjustments" ADD COLUMN "source_template_schedule_id" text;
ALTER TABLE "cycle_adjustments" ADD COLUMN "source_template_occurrence_key" text;
DROP INDEX IF EXISTS "cycle_adjustments_cycle_template_task_live_idx";
CREATE UNIQUE INDEX "cycle_adjustments_source_live_idx" ON "cycle_adjustments" USING btree ("cycle_id","source_template_schedule_id","template_task_id","source_template_occurrence_key") WHERE "cycle_adjustments"."deleted_at" IS NULL;
