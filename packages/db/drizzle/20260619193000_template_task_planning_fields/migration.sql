ALTER TABLE "template_tasks" ADD COLUMN "description" text;
ALTER TABLE "template_tasks" ADD COLUMN "assigned_user_id" text;
ALTER TABLE "template_tasks" ADD COLUMN "label_ids" text DEFAULT '[]' NOT NULL;
ALTER TABLE "template_tasks" ADD COLUMN "estimate" text;
