ALTER TABLE "organization" ADD COLUMN "deleted_at" timestamp with time zone;
ALTER TABLE "organization" ADD COLUMN "deleted_by" text;
