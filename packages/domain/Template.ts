import { Schema } from "effect";

export const TemplateRecurrenceSchema = Schema.Literal(
  "none",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
);

export const SchedulingRuleSchema = Schema.Union(
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

export const TemplateTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  recurrence: TemplateRecurrenceSchema,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const TemplateTeamTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  templateId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  mappedTeamId: Schema.String,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const TemplateSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  key: Schema.String,
  name: Schema.String,
  recurrence: TemplateRecurrenceSchema,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const FocusWindowTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
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

export const TemplateTaskTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  templateId: Schema.String,
  templateTeamId: Schema.String,
  key: Schema.String,
  title: Schema.String,
  parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  schedulingRule: SchedulingRuleSchema,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const CycleAdjustmentLifecycleSchema = Schema.Literal("active", "skipped");

export const CycleAdjustmentOverrideSchema = Schema.Union(
  Schema.Struct({ field: Schema.Literal("title"), value: Schema.String }),
  Schema.Struct({ field: Schema.Literal("dueDate"), value: Schema.String }),
  Schema.Struct({
    field: Schema.Literal("parentTemplateTaskId"),
    value: Schema.Union(Schema.String, Schema.Null),
  }),
);

export const CycleAdjustmentOverridesSchema = Schema.Array(CycleAdjustmentOverrideSchema);

export const CycleAdjustmentTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  cycleId: Schema.String,
  templateTaskId: Schema.String,
  lifecycle: CycleAdjustmentLifecycleSchema,
  overrides: CycleAdjustmentOverridesSchema,
});

export type Template = typeof TemplateSchema.Type;
export type TemplateRecurrence = typeof TemplateRecurrenceSchema.Type;
export type SchedulingRule = typeof SchedulingRuleSchema.Type;
export type CycleAdjustmentOverride = typeof CycleAdjustmentOverrideSchema.Type;
