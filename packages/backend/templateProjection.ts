import { Schema } from "effect";

export const CycleAdjustmentLifecycle = Schema.Union(
  Schema.Literal("active"),
  Schema.Literal("skipped"),
);

export const CycleAdjustmentOverride = Schema.Union(
  Schema.Struct({ field: Schema.Literal("title"), value: Schema.String }),
  Schema.Struct({ field: Schema.Literal("dueDate"), value: Schema.String }),
  Schema.Struct({
    field: Schema.Literal("parentTemplateTaskId"),
    value: Schema.Union(Schema.String, Schema.Null),
  }),
);

export const CycleAdjustmentOverrides = Schema.Array(CycleAdjustmentOverride);

export const TemplateTaskProjectionBase = Schema.Struct({
  templateTaskId: Schema.String,
  templateTaskKey: Schema.String,
  title: Schema.String,
  dueDate: Schema.String,
  parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
});

export const CycleAdjustmentForMerge = Schema.Struct({
  lifecycle: CycleAdjustmentLifecycle,
  overrides: CycleAdjustmentOverrides,
});

export const EffectiveProjectedTask = Schema.Struct({
  templateTaskId: Schema.String,
  templateTaskKey: Schema.String,
  title: Schema.String,
  dueDate: Schema.String,
  parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
});

export const MergedTemplateTaskProjection = Schema.Struct({
  skipped: Schema.Boolean,
  effectiveTask: Schema.Union(EffectiveProjectedTask, Schema.Null),
  appliedOverrides: CycleAdjustmentOverrides,
});

export type CycleAdjustmentOverride = typeof CycleAdjustmentOverride.Type;
export type CycleAdjustmentForMerge = typeof CycleAdjustmentForMerge.Type;
export type TemplateTaskProjectionBase = typeof TemplateTaskProjectionBase.Type;
export type MergedTemplateTaskProjection = typeof MergedTemplateTaskProjection.Type;

export function validateCycleAdjustmentOverrides(overrides: unknown) {
  return Schema.decodeUnknownSync(CycleAdjustmentOverrides)(overrides);
}

export function mergeTemplateTaskProjection(
  baseInput: TemplateTaskProjectionBase,
  adjustmentInput: CycleAdjustmentForMerge | null,
): MergedTemplateTaskProjection {
  const base = Schema.decodeUnknownSync(TemplateTaskProjectionBase)(baseInput);
  const adjustment = adjustmentInput
    ? Schema.decodeUnknownSync(CycleAdjustmentForMerge)(adjustmentInput)
    : null;

  if (adjustment?.lifecycle === "skipped") {
    return {
      skipped: true,
      effectiveTask: null,
      appliedOverrides: adjustment.overrides,
    };
  }

  const effectiveTask = { ...base };

  for (const override of adjustment?.overrides ?? []) {
    if (override.field === "title") effectiveTask.title = override.value;
    if (override.field === "dueDate") effectiveTask.dueDate = override.value;
    if (override.field === "parentTemplateTaskId") {
      effectiveTask.parentTemplateTaskId = override.value;
    }
  }

  return Schema.decodeUnknownSync(MergedTemplateTaskProjection)({
    skipped: false,
    effectiveTask,
    appliedOverrides: adjustment?.overrides ?? [],
  });
}
