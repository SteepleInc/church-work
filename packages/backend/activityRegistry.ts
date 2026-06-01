import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";
import { Schema } from "effect";

import type { DataModel, Id } from "./convex/_generated/dataModel";

export const ActivityEntityType = Schema.Union(
  Schema.Literal("task"),
  Schema.Literal("template"),
  Schema.Literal("cycle"),
  Schema.Literal("team"),
  Schema.Literal("workflow"),
  Schema.Literal("keyDate"),
  Schema.Literal("church"),
);

export const ActivityActorType = Schema.Union(
  Schema.Literal("user"),
  Schema.Literal("system"),
  Schema.Literal("better_auth"),
);

export const TaskState = Schema.Union(
  Schema.Literal("todo"),
  Schema.Literal("in_progress"),
  Schema.Literal("done"),
  Schema.Literal("canceled"),
);

const EmptyMetadata = Schema.Struct({});

export const ActivityMetadataByEventType = {
  "task.created": EmptyMetadata,
  "task.canceled": Schema.Struct({
    previousTaskState: Schema.Union(
      Schema.Literal("todo"),
      Schema.Literal("in_progress"),
      Schema.Literal("done"),
    ),
    previousWorkflowStatusId: Schema.String,
    previousWorkflowStatusName: Schema.Union(Schema.String, Schema.Null),
  }),
  "task.reopened": Schema.Struct({
    restoredTaskState: Schema.Union(
      Schema.Literal("todo"),
      Schema.Literal("in_progress"),
      Schema.Literal("done"),
    ),
    restoredWorkflowStatusId: Schema.String,
    cancelActivityId: Schema.String,
  }),
  "task.rolled_over": Schema.Struct({
    fromCycleId: Schema.String,
    toCycleId: Schema.String,
    previousTaskState: Schema.Union(Schema.Literal("todo"), Schema.Literal("in_progress")),
    previousWorkflowStatusId: Schema.String,
    previousWorkflowStatusName: Schema.Union(Schema.String, Schema.Null),
  }),
  "task.template_synced": Schema.Struct({
    templateId: Schema.String,
    templateTaskId: Schema.String,
    sourceTemplateCycleId: Schema.String,
    updatedFields: Schema.Array(Schema.String),
  }),
  "template.updated": Schema.Struct({
    templateTaskIds: Schema.Array(Schema.String),
    syncedTaskIds: Schema.Array(Schema.String),
  }),
  "cycle.created": Schema.Struct({
    startDate: Schema.String,
    endDate: Schema.String,
    churchTimeZone: Schema.String,
  }),
  "workflow.created": Schema.Struct({
    name: Schema.String,
    isDefault: Schema.Boolean,
  }),
  "workflow.status.created": Schema.Struct({
    workflowId: Schema.String,
    name: Schema.String,
    taskState: TaskState,
  }),
  "workflow.status.archived": Schema.Struct({
    workflowId: Schema.String,
    name: Schema.String,
    taskState: TaskState,
  }),
  "task.team.changed": Schema.Struct({
    fromTeamId: Schema.Union(Schema.String, Schema.Null),
    toTeamId: Schema.String,
    fromWorkflowId: Schema.String,
    toWorkflowId: Schema.String,
    previousWorkflowStatusId: Schema.String,
    restoredWorkflowStatusId: Schema.String,
  }),
  "church.created": Schema.Struct({
    name: Schema.String,
    slug: Schema.Union(Schema.String, Schema.Null),
    churchTimeZone: Schema.Union(Schema.String, Schema.Null),
  }),
  "church.updated": Schema.Struct({
    name: Schema.Union(Schema.String, Schema.Null),
    slug: Schema.Union(Schema.String, Schema.Null),
  }),
  "church.deleted": Schema.Struct({
    name: Schema.String,
    slug: Schema.Union(Schema.String, Schema.Null),
  }),
  "church.member.added": Schema.Struct({
    memberUserId: Schema.String,
    role: Schema.String,
  }),
  "church.member.removed": Schema.Struct({
    memberUserId: Schema.String,
    role: Schema.String,
  }),
  "church.member.role_updated": Schema.Struct({
    memberUserId: Schema.String,
    previousRole: Schema.String,
    role: Schema.String,
  }),
  "church.invitation.created": Schema.Struct({
    invitationId: Schema.String,
    email: Schema.String,
    role: Schema.String,
    teamId: Schema.Union(Schema.String, Schema.Null),
  }),
  "church.invitation.accepted": Schema.Struct({
    invitationId: Schema.String,
    memberUserId: Schema.String,
    role: Schema.String,
  }),
  "church.invitation.rejected": Schema.Struct({
    invitationId: Schema.String,
    email: Schema.String,
    role: Schema.String,
  }),
  "church.invitation.canceled": Schema.Struct({
    invitationId: Schema.String,
    email: Schema.String,
    role: Schema.String,
  }),
  "team.created": Schema.Struct({
    name: Schema.String,
  }),
  "team.member.added": Schema.Struct({
    memberUserId: Schema.String,
  }),
  "team.member.removed": Schema.Struct({
    memberUserId: Schema.String,
  }),
} as const;

export const ActivityEventType = Schema.Literal(
  "task.created",
  "task.canceled",
  "task.reopened",
  "task.rolled_over",
  "task.template_synced",
  "template.updated",
  "cycle.created",
  "workflow.created",
  "workflow.status.created",
  "workflow.status.archived",
  "task.team.changed",
  "church.created",
  "church.updated",
  "church.deleted",
  "church.member.added",
  "church.member.removed",
  "church.member.role_updated",
  "church.invitation.created",
  "church.invitation.accepted",
  "church.invitation.rejected",
  "church.invitation.canceled",
  "team.created",
  "team.member.added",
  "team.member.removed",
);

export const ActivityMetadata = Schema.Union(
  EmptyMetadata,
  ActivityMetadataByEventType["task.canceled"],
  ActivityMetadataByEventType["task.reopened"],
  ActivityMetadataByEventType["task.rolled_over"],
  ActivityMetadataByEventType["task.template_synced"],
  ActivityMetadataByEventType["template.updated"],
  ActivityMetadataByEventType["cycle.created"],
  ActivityMetadataByEventType["workflow.created"],
  ActivityMetadataByEventType["workflow.status.created"],
  ActivityMetadataByEventType["workflow.status.archived"],
  ActivityMetadataByEventType["task.team.changed"],
  ActivityMetadataByEventType["church.created"],
  ActivityMetadataByEventType["church.updated"],
  ActivityMetadataByEventType["church.deleted"],
  ActivityMetadataByEventType["church.member.added"],
  ActivityMetadataByEventType["church.member.removed"],
  ActivityMetadataByEventType["church.member.role_updated"],
  ActivityMetadataByEventType["church.invitation.created"],
  ActivityMetadataByEventType["church.invitation.accepted"],
  ActivityMetadataByEventType["church.invitation.rejected"],
  ActivityMetadataByEventType["church.invitation.canceled"],
  ActivityMetadataByEventType["team.created"],
  ActivityMetadataByEventType["team.member.added"],
  ActivityMetadataByEventType["team.member.removed"],
);

export const ActivityInput = Schema.Struct({
  churchId: Schema.String,
  entityType: ActivityEntityType,
  entityId: Schema.String,
  eventType: ActivityEventType,
  actorType: ActivityActorType,
  actorId: Schema.Union(Schema.String, Schema.Null),
  occurredAt: Schema.String,
  cycleId: Schema.Union(Schema.String, Schema.Null),
  metadata: Schema.Unknown,
});

export type ActivityInput = typeof ActivityInput.Type;
export type ActivityEventType = typeof ActivityEventType.Type;
type ActivityMetadata = typeof ActivityMetadata.Type;

type MutationCtx = GenericMutationCtx<DataModel>;

export function validateActivityMetadata(eventType: ActivityEventType, metadata: unknown) {
  const metadataSchema = ActivityMetadataByEventType[eventType] as Schema.Schema<unknown>;

  return Schema.decodeUnknownSync(metadataSchema)(metadata) as ActivityMetadata;
}

export function buildActivity(input: ActivityInput) {
  return {
    ...input,
    metadata: validateActivityMetadata(input.eventType, input.metadata),
  };
}

export async function writeActivity(ctx: MutationCtx, input: ActivityInput) {
  const activity = buildActivity(input);

  return await ctx.db.insert("activities", activity);
}

export async function listActivitiesForEntity(
  ctx: { readonly db: GenericDatabaseReader<DataModel> },
  args: {
    readonly churchId: string;
    readonly entityType: typeof ActivityEntityType.Type;
    readonly entityId: string;
  },
) {
  return await ctx.db
    .query("activities")
    .withIndex("by_churchId_and_entity", (q) =>
      q
        .eq("churchId", args.churchId)
        .eq("entityType", args.entityType)
        .eq("entityId", args.entityId),
    )
    .collect();
}

export function serializeActivity(
  activity: DataModel["activities"]["document"] & { _id: Id<"activities"> },
) {
  return {
    id: activity._id,
    churchId: activity.churchId,
    entityType: activity.entityType,
    entityId: activity.entityId,
    eventType: activity.eventType,
    actorType: activity.actorType,
    actorId: activity.actorId,
    occurredAt: activity.occurredAt,
    cycleId: activity.cycleId,
    metadata: activity.metadata,
  };
}
