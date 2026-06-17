CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"church_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"cycle_id" text,
	"metadata" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activities_church_id_idx" ON "activities" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "activities_entity_idx" ON "activities" USING btree ("church_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activities_occurred_at_idx" ON "activities" USING btree ("occurred_at");