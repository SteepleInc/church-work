import { TaskStatusSchema } from "@church-task/domain/Task";
import { WorkflowSchema, WorkflowStatusSchema } from "@church-task/domain/Workflow";
import { Schema } from "effect";

const TaskState = TaskStatusSchema;

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

export const WorkflowRenameArgs = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
  name: Schema.String,
});

export const WorkflowReorderArgs = Schema.Struct({
  churchId: Schema.String,
  workflowIds: Schema.Array(Schema.String),
});

export const WorkflowArchiveArgs = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
});

export const WorkflowSetDefaultArgs = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
});

export const WorkflowAddStatusArgs = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
  status: WorkflowStatusInput,
});

export const WorkflowRenameStatusArgs = Schema.Struct({
  churchId: Schema.String,
  statusId: Schema.String,
  name: Schema.String,
});

export const WorkflowReorderStatusesArgs = Schema.Struct({
  churchId: Schema.String,
  workflowId: Schema.String,
  statusIds: Schema.Array(Schema.String),
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

const WorkflowSummary = WorkflowSchema;

const WorkflowStatusSummary = WorkflowStatusSchema;

const TaskWorkflowSummary = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.Union(Schema.String, Schema.Null),
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskState,
});

export const WorkflowSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("createWorkflow"),
    Schema.Literal("renameWorkflow"),
    Schema.Literal("reorderWorkflows"),
    Schema.Literal("archiveWorkflow"),
    Schema.Literal("setDefaultWorkflow"),
    Schema.Literal("addWorkflowStatus"),
    Schema.Literal("renameWorkflowStatus"),
    Schema.Literal("reorderWorkflowStatuses"),
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
    Schema.Literal("renameWorkflow"),
    Schema.Literal("reorderWorkflows"),
    Schema.Literal("archiveWorkflow"),
    Schema.Literal("setDefaultWorkflow"),
    Schema.Literal("addWorkflowStatus"),
    Schema.Literal("renameWorkflowStatus"),
    Schema.Literal("reorderWorkflowStatuses"),
    Schema.Literal("archiveWorkflowStatus"),
    Schema.Literal("remapTaskTeamWorkflow"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("invalid_workflow"),
      Schema.Literal("invalid_workflow_reorder"),
      Schema.Literal("invalid_workflow_status_reorder"),
      Schema.Literal("workflow_not_found"),
      Schema.Literal("workflow_in_use"),
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
