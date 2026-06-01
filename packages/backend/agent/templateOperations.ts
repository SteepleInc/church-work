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
  ),
  data: Schema.Struct({
    templates: Schema.Array(TemplateSummary),
    focusWindows: Schema.Array(FocusWindowSummary),
    templateTasks: Schema.Array(TemplateTaskSummary),
    resolvedSchedules: Schema.Array(ResolvedTemplateTaskSchedule),
  }),
});

export const TemplateErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("createTemplates"),
    Schema.Literal("resolveTemplateSchedules"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("church_time_zone_missing"),
      Schema.Literal("invalid_template"),
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
