import { Schema } from "effect";

export const TaskStatusSchema = Schema.Literal("todo", "in_progress", "done", "canceled");
export const RestorableTaskStatusSchema = Schema.Literal("todo", "in_progress", "done");

export const TaskTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  title: Schema.String,
  // Free-form Task description. Optional because pre-existing Tasks were
  // written before the field existed.
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  // Due Date is never auto-assigned; a Task with no Due Date belongs to the
  // Cycle containing its creation date (see CONTEXT.md "Due Date").
  dueDate: Schema.Union(Schema.String, Schema.Null),
  // The User who created the Task. Optional because pre-existing Tasks were
  // written before the field existed; Template projection writes null.
  createdByUserId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
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
  description: Schema.Union(Schema.String, Schema.Null),
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.Union(Schema.String, Schema.Null),
  // Convex's built-in document creation time (epoch ms). Surfaced from
  // `_creationTime` by the task serializers so clients can show "Created …".
  createdAt: Schema.Number,
  createdByUserId: Schema.Union(Schema.String, Schema.Null),
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
