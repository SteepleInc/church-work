import { Schema } from "effect";

const TaskState = Schema.Union(
  Schema.Literal("todo"),
  Schema.Literal("in_progress"),
  Schema.Literal("done"),
  Schema.Literal("canceled"),
);

const WorkflowStatusInput = Schema.Struct({
  key: Schema.String,
  name: Schema.String,
  taskState: TaskState,
  sortOrder: Schema.Number,
});

export const WorkflowCreateArgs = Schema.Struct({
  churchId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  sortOrder: Schema.Number,
  statuses: Schema.Array(WorkflowStatusInput),
});

export const WorkflowArchiveStatusArgs = Schema.Struct({
  churchId: Schema.String,
  statusId: Schema.String,
  archivedAt: Schema.String,
});

export const WorkflowRemapTaskTeamArgs = Schema.Struct({
  churchId: Schema.String,
  taskId: Schema.String,
  destinationTeamId: Schema.String,
});

const WorkflowSummary = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const WorkflowStatusSummary = Schema.Struct({
  id: Schema.String,
  workflowId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  taskState: TaskState,
  sortOrder: Schema.Number,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const TaskWorkflowSummary = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskState,
});

export const WorkflowSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("createWorkflow"),
    Schema.Literal("archiveWorkflowStatus"),
    Schema.Literal("remapTaskTeamWorkflow"),
  ),
  data: Schema.Struct({
    workflows: Schema.Array(WorkflowSummary),
    workflowStatuses: Schema.Array(WorkflowStatusSummary),
    tasks: Schema.Array(TaskWorkflowSummary),
  }),
});

export const WorkflowErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("createWorkflow"),
    Schema.Literal("archiveWorkflowStatus"),
    Schema.Literal("remapTaskTeamWorkflow"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("invalid_workflow"),
      Schema.Literal("workflow_not_found"),
      Schema.Literal("workflow_status_not_found"),
      Schema.Literal("workflow_status_in_use"),
      Schema.Literal("task_not_found"),
      Schema.Literal("team_not_found"),
      Schema.Literal("team_workflow_not_configured"),
      Schema.Literal("workflow_status_remap_failed"),
    ),
    message: Schema.String,
  }),
});

export const WorkflowWriteResponse = Schema.Union(WorkflowSuccessResponse, WorkflowErrorResponse);

export type WorkflowSuccessResponse = typeof WorkflowSuccessResponse.Type;
export type WorkflowErrorCode = Schema.Schema.Type<typeof WorkflowErrorResponse>["error"]["code"];
export type WorkflowOperation = Schema.Schema.Type<typeof WorkflowSuccessResponse>["operation"];

export const workflowResponse = (
  operation: WorkflowOperation,
  data: Schema.Schema.Type<typeof WorkflowSuccessResponse>["data"],
): WorkflowSuccessResponse => ({
  ok: true,
  operation,
  data,
});

export const workflowErrorResponse = (
  operation: WorkflowOperation,
  code: WorkflowErrorCode,
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
