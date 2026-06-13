import { TaskEstimateSchema, TaskSchema } from "@church-task/domain/Task";
import { Schema } from "effect";

const TaskCreateInput = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  // Every Task belongs to exactly one Team (ADR 0013).
  teamId: Schema.String,
  assignedUserId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  workflowStatusId: Schema.String,
  // Null means "no Due Date": the Task joins the Cycle containing its
  // creation date.
  dueDate: Schema.Union(Schema.String, Schema.Null),
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  // Null or absent means "no estimate".
  estimate: Schema.optional(Schema.Union(TaskEstimateSchema, Schema.Null)),
});

export const TaskCreateBatchArgs = Schema.Struct({
  churchId: Schema.String,
  tasks: Schema.Array(TaskCreateInput),
});

const TaskUpdateFields = Schema.Struct({
  title: Schema.optional(Schema.String),
  assignedUserId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  teamId: Schema.optional(Schema.String),
  workflowStatusId: Schema.optional(Schema.String),
  dueDate: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  cycleId: Schema.optional(Schema.String),
  parentTaskId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  boardOrder: Schema.optional(Schema.String),
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  estimate: Schema.optional(Schema.Union(TaskEstimateSchema, Schema.Null)),
});

export const TaskUpdateBatchArgs = Schema.Struct({
  churchId: Schema.String,
  updates: Schema.Array(
    Schema.Struct({
      taskId: Schema.String,
      fields: TaskUpdateFields,
    }),
  ),
});

export const TaskListArgs = Schema.Struct({
  churchId: Schema.String,
  surface: Schema.optional(Schema.Union(Schema.Literal("my_work"), Schema.Literal("our_work"))),
  cycleId: Schema.optional(Schema.String),
});

// Identifier resolution (ADR 0013): the identifier is a Task Identifier
// string ("PRD-48"), matched case-insensitively, current-first with
// previous-identifier alias fallback.
export const TaskResolveArgs = Schema.Struct({
  churchId: Schema.String,
  identifier: Schema.String,
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

const TaskSummary = TaskSchema;

export const TaskSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("createTasks"),
    Schema.Literal("updateTasks"),
    Schema.Literal("listTasks"),
    Schema.Literal("resolveTask"),
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
    Schema.Literal("updateTasks"),
    Schema.Literal("listTasks"),
    Schema.Literal("resolveTask"),
    Schema.Literal("completeTasks"),
    Schema.Literal("cancelTasks"),
    Schema.Literal("reopenTasks"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("church_time_zone_missing"),
      Schema.Literal("assigned_user_not_church_member"),
      Schema.Literal("invalid_due_date"),
      Schema.Literal("cycle_not_found"),
      Schema.Literal("workflow_status_not_found"),
      Schema.Literal("workflow_status_not_in_effective_workflow"),
      Schema.Literal("parent_task_not_found"),
      Schema.Literal("label_not_found"),
      Schema.Literal("label_not_in_team_scope"),
      Schema.Literal("task_not_found"),
      Schema.Literal("team_not_found"),
      Schema.Literal("team_required"),
      Schema.Literal("team_workflow_not_configured"),
      Schema.Literal("workflow_status_remap_failed"),
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
