import { TaskStatusSchema } from "@church-task/domain/Task";
import { Schema } from "effect";

const TaskState = TaskStatusSchema;

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
  teamId: Schema.String,
  cycleId: Schema.String,
  dueDate: Schema.Union(Schema.String, Schema.Null),
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskState,
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export const CycleMaintenanceRunArgs = Schema.Struct({
  churchId: Schema.String,
  now: Schema.String,
});

export const CycleMaintenanceSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("maintainCycles"),
  data: Schema.Struct({
    cycles: Schema.Array(CycleSummary),
    tasks: Schema.Array(TaskSummary),
    ensuredCycleIds: Schema.Array(Schema.String),
    createdCycleIds: Schema.Array(Schema.String),
    rolledOverTaskIds: Schema.Array(Schema.String),
    materializedTaskIds: Schema.Array(Schema.String),
  }),
});

export const CycleMaintenanceErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Literal("maintainCycles"),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("church_time_zone_missing"),
      Schema.Literal("invalid_now"),
      Schema.Literal("workflow_status_not_found"),
      Schema.Literal("team_not_found"),
      Schema.Literal("template_task_not_found"),
    ),
    message: Schema.String,
  }),
});

export const CycleMaintenanceWriteResponse = Schema.Union(
  CycleMaintenanceSuccessResponse,
  CycleMaintenanceErrorResponse,
);

export type CycleMaintenanceErrorCode = Schema.Schema.Type<
  typeof CycleMaintenanceErrorResponse
>["error"]["code"];
export type CycleMaintenanceData = Schema.Schema.Type<
  typeof CycleMaintenanceSuccessResponse
>["data"];

export const cycleMaintenanceResponse = (data: CycleMaintenanceData) => ({
  ok: true as const,
  operation: "maintainCycles" as const,
  data,
});

export const cycleMaintenanceErrorResponse = (
  code: CycleMaintenanceErrorCode,
  message: string,
) => ({
  ok: false as const,
  operation: "maintainCycles" as const,
  error: { code, message },
});
