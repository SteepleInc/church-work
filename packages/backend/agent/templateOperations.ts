import { Schema } from "effect";

const TemplateRecurrence = Schema.Union(
  Schema.Literal("none"),
  Schema.Literal("weekly"),
  Schema.Literal("monthly"),
  Schema.Literal("quarterly"),
  Schema.Literal("yearly"),
);

const SchedulingRule = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("fixedDate"), localDate: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("relativeToFocusWindow"),
    focusWindowId: Schema.String,
    edge: Schema.Union(Schema.Literal("start"), Schema.Literal("end")),
    offsetDays: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("relativeToAnchorDate"),
    focusWindowId: Schema.String,
    offsetDays: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("relativeToKeyDate"),
    keyDateId: Schema.String,
    year: Schema.Number,
    offsetDays: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("cycleOffset"),
    baseLocalDate: Schema.String,
    offsetCycles: Schema.Number,
    dayOffset: Schema.Number,
  }),
);

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
  parentTemplateTaskKey: Schema.Union(Schema.String, Schema.Null),
  schedulingRule: SchedulingRule,
});

const CycleAdjustmentLifecycle = Schema.Union(Schema.Literal("active"), Schema.Literal("skipped"));

const CycleAdjustmentOverride = Schema.Union(
  Schema.Struct({ field: Schema.Literal("title"), value: Schema.String }),
  Schema.Struct({ field: Schema.Literal("dueDate"), value: Schema.String }),
  Schema.Struct({
    field: Schema.Literal("parentTemplateTaskId"),
    value: Schema.Union(Schema.String, Schema.Null),
  }),
);

export const TemplateCreateArgs = Schema.Struct({
  churchId: Schema.String,
  templates: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      name: Schema.String,
      recurrence: TemplateRecurrence,
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

const TemplateSummary = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  recurrence: TemplateRecurrence,
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
  ),
  data: Schema.Struct({
    templates: Schema.Array(TemplateSummary),
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
