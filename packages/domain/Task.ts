import { Schema } from "effect";

export const TaskStatusSchema = Schema.Literal("todo", "in_progress", "done", "canceled");
export const RestorableTaskStatusSchema = Schema.Literal("todo", "in_progress", "done");

export const TaskTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.String,
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskStatusSchema,
  // Board Order: fractional-indexing key ordering Tasks within a Board Column
  // (see docs/adr/0012-fractional-board-order.md). Compared as a plain string.
  boardOrder: Schema.String,
  finishedAt: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export const TaskSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.String,
  // Convex's built-in document creation time (epoch ms). Surfaced from
  // `_creationTime` by the task serializers so clients can show "Created …".
  createdAt: Schema.Number,
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskStatusSchema,
  boardOrder: Schema.String,
  finishedAt: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export type Task = typeof TaskSchema.Type;
export type TaskStatus = typeof TaskStatusSchema.Type;
export type RestorableTaskStatus = typeof RestorableTaskStatusSchema.Type;
