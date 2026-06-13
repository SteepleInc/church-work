import { LabelColorSchema, LabelSchema } from "@church-task/domain/Label";
import { Schema } from "effect";

export const LabelListArgs = Schema.Struct({
  churchId: Schema.String,
});

export const LabelCreateArgs = Schema.Struct({
  churchId: Schema.String,
  name: Schema.String,
  // Null/omitted means a Church-scoped Label; a Team id creates a Team Label.
  teamId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  // Omitted means "derive from the name" (same derivation as Team Color).
  color: Schema.optional(LabelColorSchema),
});

export const LabelUpdateArgs = Schema.Struct({
  churchId: Schema.String,
  labelId: Schema.String,
  name: Schema.optional(Schema.String),
  color: Schema.optional(LabelColorSchema),
});

export const LabelDeleteArgs = Schema.Struct({
  churchId: Schema.String,
  labelId: Schema.String,
});

export const Label = LabelSchema;

const LabelOperation = Schema.Union(
  Schema.Literal("listLabels"),
  Schema.Literal("createLabel"),
  Schema.Literal("updateLabel"),
  Schema.Literal("deleteLabel"),
);

export const LabelOperationResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: LabelOperation,
  data: Schema.Struct({
    labels: Schema.Array(Label),
  }),
});

export const LabelOperationErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: LabelOperation,
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("label_not_found"),
      Schema.Literal("duplicate_label_name"),
      Schema.Literal("invalid_label_name"),
      Schema.Literal("team_not_found"),
    ),
    message: Schema.String,
  }),
});

export const LabelReadResponse = Schema.Union(LabelOperationResponse, LabelOperationErrorResponse);
export const LabelWriteResponse = Schema.Union(LabelOperationResponse, LabelOperationErrorResponse);

export const labelsResponse = (
  operation: Schema.Schema.Type<typeof LabelOperationResponse>["operation"],
  labels: ReadonlyArray<Schema.Schema.Type<typeof Label>>,
) => ({
  ok: true as const,
  operation,
  data: { labels },
});

export const labelErrorResponse = (
  operation: Schema.Schema.Type<typeof LabelOperationErrorResponse>["operation"],
  code: Schema.Schema.Type<typeof LabelOperationErrorResponse>["error"]["code"],
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
