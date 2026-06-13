import { Schema } from "effect";

import { TaskStatusSchema } from "./Task";

// Every Team owns exactly one Workflow (ADR 0013): the Workflow's teamId
// points at its owning Team, and there is no Church default Workflow.
export const WorkflowTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const WorkflowSchema = Schema.Struct({
  id: Schema.String,
  teamId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const WorkflowStatusTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  taskState: TaskStatusSchema,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const WorkflowStatusSchema = Schema.Struct({
  id: Schema.String,
  workflowId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  taskState: TaskStatusSchema,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export type Workflow = typeof WorkflowSchema.Type;
export type WorkflowStatus = typeof WorkflowStatusSchema.Type;
