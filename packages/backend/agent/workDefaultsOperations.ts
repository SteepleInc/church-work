import { LabelSchema } from "@church-task/domain/Label";
import { WorkflowSchema, WorkflowStatusSchema } from "@church-task/domain/Workflow";
import { Schema } from "effect";

export const WorkDefaultsChurchArgs = Schema.Struct({
  churchId: Schema.String,
});

export const WorkflowSummary = WorkflowSchema;

export const WorkflowStatusSummary = WorkflowStatusSchema;

export const KeyDateSummary = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  schedule: Schema.Union(
    Schema.Struct({
      kind: Schema.Literal("fixedYearly"),
      month: Schema.Number,
      day: Schema.Number,
    }),
    Schema.Struct({
      kind: Schema.Literal("computedYearly"),
      rule: Schema.Union(
        Schema.Literal("easter"),
        Schema.Literal("palm_sunday"),
        Schema.Literal("pentecost"),
        Schema.Literal("mothers_day"),
        Schema.Literal("fathers_day"),
      ),
    }),
    Schema.Struct({
      kind: Schema.Literal("manualOccurrences"),
    }),
    Schema.Struct({
      kind: Schema.Literal("oneTime"),
    }),
  ),
  archivedAt: Schema.Union(Schema.String, Schema.Null),
});

export const LabelSummary = LabelSchema;

export const WorkDefaultsData = Schema.Struct({
  workflows: Schema.Array(WorkflowSummary),
  workflowStatuses: Schema.Array(WorkflowStatusSummary),
  keyDates: Schema.Array(KeyDateSummary),
  labels: Schema.Array(LabelSummary),
});

export const WorkDefaultsResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Union(Schema.Literal("seedWorkDefaults"), Schema.Literal("readWorkDefaults")),
  data: WorkDefaultsData,
});

export type WorkDefaultsData = typeof WorkDefaultsData.Type;
export type WorkDefaultsResponse = typeof WorkDefaultsResponse.Type;

export const workDefaultsResponse = (
  operation: "seedWorkDefaults" | "readWorkDefaults",
  data: WorkDefaultsData,
): WorkDefaultsResponse => ({
  ok: true,
  operation,
  data,
});
