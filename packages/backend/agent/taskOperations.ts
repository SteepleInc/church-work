import { Schema } from "effect";

const TaskState = Schema.Union(
  Schema.Literal("todo"),
  Schema.Literal("in_progress"),
  Schema.Literal("done"),
  Schema.Literal("canceled"),
);

const TaskCreateInput = Schema.Struct({
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  workflowStatusId: Schema.String,
  dueDate: Schema.String,
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
});

export const TaskCreateBatchArgs = Schema.Struct({
  churchId: Schema.String,
  tasks: Schema.Array(TaskCreateInput),
});

export const TaskListArgs = Schema.Struct({
  churchId: Schema.String,
});

export const TaskTransitionBatchArgs = Schema.Struct({
  churchId: Schema.String,
  taskIds: Schema.Array(Schema.String),
});

const CycleSummary = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  startDate: Schema.String,
  endDate: Schema.String,
  startsAt: Schema.String,
  endsAt: Schema.String,
  churchTimeZone: Schema.String,
});

const TaskSummary = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.String,
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskState,
  finishedAt: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export const TaskSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("createTasks"),
    Schema.Literal("listTasks"),
    Schema.Literal("completeTasks"),
    Schema.Literal("cancelTasks"),
    Schema.Literal("reopenTasks"),
  ),
  data: Schema.Struct({
    cycles: Schema.Array(CycleSummary),
    tasks: Schema.Array(TaskSummary),
  }),
});

export const TaskErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("createTasks"),
    Schema.Literal("listTasks"),
    Schema.Literal("completeTasks"),
    Schema.Literal("cancelTasks"),
    Schema.Literal("reopenTasks"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("church_time_zone_missing"),
      Schema.Literal("invalid_due_date"),
      Schema.Literal("workflow_status_not_found"),
      Schema.Literal("parent_task_not_found"),
      Schema.Literal("task_not_found"),
      Schema.Literal("invalid_task_transition"),
      Schema.Literal("inconsistent_task_status"),
      Schema.Literal("done_workflow_status_not_found"),
      Schema.Literal("restore_activity_not_found"),
      Schema.Literal("restore_workflow_status_not_found"),
    ),
    message: Schema.String,
  }),
});

export const TaskWriteResponse = Schema.Union(TaskSuccessResponse, TaskErrorResponse);
export const TaskReadResponse = Schema.Union(TaskSuccessResponse, TaskErrorResponse);

export type TaskSuccessResponse = typeof TaskSuccessResponse.Type;
export type TaskErrorCode = Schema.Schema.Type<typeof TaskErrorResponse>["error"]["code"];
export type TaskOperation = Schema.Schema.Type<typeof TaskSuccessResponse>["operation"];

export const taskResponse = (
  operation: TaskOperation,
  data: Schema.Schema.Type<typeof TaskSuccessResponse>["data"],
): TaskSuccessResponse => ({
  ok: true,
  operation,
  data,
});

export const taskErrorResponse = (
  operation: TaskOperation,
  code: TaskErrorCode,
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
