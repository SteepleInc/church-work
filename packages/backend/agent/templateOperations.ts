import {
  CycleAdjustmentLifecycleSchema,
  CycleAdjustmentOverrideSchema,
  SchedulingRuleSchema,
  TemplateRecurrenceSchema,
} from "@church-task/domain/Template";
import { Schema } from "effect";

const TemplateRecurrence = TemplateRecurrenceSchema;

const SchedulingRule = SchedulingRuleSchema;

const FocusWindowInput = Schema.Struct({
  key: Schema.String,
  name: Schema.String,
  type: Schema.String,
  startDate: Schema.String,
  endDate: Schema.Union(Schema.String, Schema.Null),
  anchorDate: Schema.Union(Schema.String, Schema.Null),
  keyDateId: Schema.Union(Schema.String, Schema.Null),
});

const TemplateTaskInput = Schema.Struct({
  key: Schema.String,
  title: Schema.String,
  templateTeamKey: Schema.Union(Schema.String, Schema.Null),
  parentTemplateTaskKey: Schema.Union(Schema.String, Schema.Null),
  schedulingRule: SchedulingRule,
});

const TemplateTeamInput = Schema.Struct({
  key: Schema.String,
  name: Schema.String,
  mappedTeamId: Schema.String,
});

const CycleAdjustmentLifecycle = CycleAdjustmentLifecycleSchema;

const CycleAdjustmentOverride = CycleAdjustmentOverrideSchema;

export const TemplateCreateArgs = Schema.Struct({
  churchId: Schema.String,
  templates: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      name: Schema.String,
      recurrence: TemplateRecurrence,
      templateTeams: Schema.Array(TemplateTeamInput),
      focusWindows: Schema.Array(FocusWindowInput),
      templateTasks: Schema.Array(TemplateTaskInput),
    }),
  ),
});

export const TemplateResolveSchedulesArgs = Schema.Struct({
  churchId: Schema.String,
});

export const TemplateSetCycleAdjustmentsArgs = Schema.Struct({
  churchId: Schema.String,
  adjustments: Schema.Array(
    Schema.Struct({
      cycleId: Schema.String,
      templateTaskId: Schema.String,
      lifecycle: CycleAdjustmentLifecycle,
      overrides: Schema.Array(CycleAdjustmentOverride),
    }),
  ),
});

export const TemplatePreviewCycleAdjustmentMergeArgs = Schema.Struct({
  churchId: Schema.String,
  projections: Schema.Array(
    Schema.Struct({
      cycleId: Schema.String,
      templateTaskId: Schema.String,
      dueDate: Schema.String,
    }),
  ),
});

export const TemplateMaterializeProjectedTasksArgs = Schema.Struct({
  churchId: Schema.String,
  occurrenceCycleIds: Schema.Array(Schema.String),
});

export const TemplateUpdateTasksArgs = Schema.Struct({
  churchId: Schema.String,
  now: Schema.String,
  templateTasks: Schema.Array(
    Schema.Struct({
      templateTaskId: Schema.String,
      title: Schema.String,
      schedulingRule: SchedulingRule,
    }),
  ),
});

const TemplateSummary = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  recurrence: TemplateRecurrence,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const TemplateTeamSummary = Schema.Struct({
  id: Schema.String,
  templateId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  mappedTeamId: Schema.String,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const FocusWindowSummary = Schema.Struct({
  id: Schema.String,
  templateId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  type: Schema.String,
  startDate: Schema.String,
  endDate: Schema.Union(Schema.String, Schema.Null),
  anchorDate: Schema.Union(Schema.String, Schema.Null),
  keyDateId: Schema.Union(Schema.String, Schema.Null),
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const TemplateTaskSummary = Schema.Struct({
  id: Schema.String,
  templateId: Schema.String,
  templateTeamId: Schema.String,
  key: Schema.String,
  title: Schema.String,
  parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  schedulingRule: SchedulingRule,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

const CycleAdjustmentSummary = Schema.Struct({
  id: Schema.String,
  cycleId: Schema.String,
  templateTaskId: Schema.String,
  lifecycle: CycleAdjustmentLifecycle,
  overrides: Schema.Array(CycleAdjustmentOverride),
});

const MergedProjectedTask = Schema.Struct({
  cycleId: Schema.String,
  templateTaskId: Schema.String,
  skipped: Schema.Boolean,
  effectiveTask: Schema.Union(
    Schema.Struct({
      templateTaskId: Schema.String,
      templateTaskKey: Schema.String,
      title: Schema.String,
      dueDate: Schema.String,
      parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
    }),
    Schema.Null,
  ),
  appliedOverrides: Schema.Array(CycleAdjustmentOverride),
});

const ResolvedTemplateTaskSchedule = Schema.Struct({
  templateTaskId: Schema.String,
  templateTaskKey: Schema.String,
  dueDate: Schema.String,
  cycle: Schema.Struct({
    startDate: Schema.String,
    endDate: Schema.String,
    startsAt: Schema.String,
    endsAt: Schema.String,
    churchTimeZone: Schema.String,
  }),
});

export const TemplateSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(
    Schema.Literal("createTemplates"),
    Schema.Literal("resolveTemplateSchedules"),
    Schema.Literal("setCycleAdjustments"),
    Schema.Literal("previewCycleAdjustmentMerge"),
    Schema.Literal("materializeProjectedTasks"),
    Schema.Literal("updateTemplateTasks"),
  ),
  data: Schema.Struct({
    templates: Schema.Array(TemplateSummary),
    templateTeams: Schema.Array(TemplateTeamSummary),
    focusWindows: Schema.Array(FocusWindowSummary),
    templateTasks: Schema.Array(TemplateTaskSummary),
    cycleAdjustments: Schema.Array(CycleAdjustmentSummary),
    resolvedSchedules: Schema.Array(ResolvedTemplateTaskSchedule),
    mergedProjectedTasks: Schema.Array(MergedProjectedTask),
  }),
});

export const TemplateErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("createTemplates"),
    Schema.Literal("resolveTemplateSchedules"),
    Schema.Literal("setCycleAdjustments"),
    Schema.Literal("previewCycleAdjustmentMerge"),
    Schema.Literal("materializeProjectedTasks"),
    Schema.Literal("updateTemplateTasks"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("church_time_zone_missing"),
      Schema.Literal("invalid_template"),
      Schema.Literal("cycle_not_found"),
      Schema.Literal("template_task_not_found"),
      Schema.Literal("invalid_cycle_adjustment"),
      Schema.Literal("workflow_status_not_found"),
      Schema.Literal("team_not_found"),
      Schema.Literal("template_not_found"),
    ),
    message: Schema.String,
  }),
});

export const TemplateWriteResponse = Schema.Union(TemplateSuccessResponse, TemplateErrorResponse);
export const TemplateReadResponse = Schema.Union(TemplateSuccessResponse, TemplateErrorResponse);

export type TemplateOperation = Schema.Schema.Type<typeof TemplateSuccessResponse>["operation"];
export type TemplateErrorCode = Schema.Schema.Type<typeof TemplateErrorResponse>["error"]["code"];
export type TemplateData = Schema.Schema.Type<typeof TemplateSuccessResponse>["data"];

export const templateResponse = (operation: TemplateOperation, data: TemplateData) => ({
  ok: true as const,
  operation,
  data,
});

export const templateErrorResponse = (
  operation: TemplateOperation,
  code: TemplateErrorCode,
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
