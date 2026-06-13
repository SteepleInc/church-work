import { Schema } from "effect";

const ReadOperationName = Schema.Union(
  Schema.Literal("listTasks"),
  Schema.Literal("listTeams"),
  Schema.Literal("listTeamMemberships"),
  Schema.Literal("readChurchSettings"),
  Schema.Literal("readWorkDefaults"),
  Schema.Literal("listKeyDates"),
  Schema.Literal("resolveKeyDateOccurrences"),
  Schema.Literal("resolveTemplateSchedules"),
  Schema.Literal("previewCycleAdjustmentMerge"),
  Schema.Literal("listActivitiesForEntity"),
);

const WriteOperationName = Schema.Union(
  Schema.Literal("seedWorkDefaults"),
  Schema.Literal("maintainCycles"),
  Schema.Literal("createTasks"),
  Schema.Literal("completeTasks"),
  Schema.Literal("cancelTasks"),
  Schema.Literal("reopenTasks"),
  Schema.Literal("createKeyDates"),
  Schema.Literal("createKeyDateOccurrences"),
  Schema.Literal("createTeam"),
  Schema.Literal("renameTeam"),
  Schema.Literal("archiveTeam"),
  Schema.Literal("reorderTeams"),
  Schema.Literal("updateTeamProductFields"),
  Schema.Literal("addTeamMember"),
  Schema.Literal("removeTeamMember"),
  Schema.Literal("updateChurchTimeZone"),
  Schema.Literal("renameWorkflow"),
  Schema.Literal("reorderWorkflows"),
  Schema.Literal("archiveWorkflow"),
  Schema.Literal("addWorkflowStatus"),
  Schema.Literal("renameWorkflowStatus"),
  Schema.Literal("reorderWorkflowStatuses"),
  Schema.Literal("archiveWorkflowStatus"),
  Schema.Literal("remapTaskTeamWorkflow"),
  Schema.Literal("createTemplates"),
  Schema.Literal("setCycleAdjustments"),
  Schema.Literal("materializeProjectedTasks"),
  Schema.Literal("updateTemplateTasks"),
);

const SystemWriteOperationName = Schema.Union(
  Schema.Literal("maintainCyclesForChurch"),
  Schema.Literal("recordActivity"),
);

const BatchResult = Schema.Struct({
  id: Schema.String,
  operation: Schema.String,
  result: Schema.Any,
});

export const CoreWorkBatchReadArgs = Schema.Struct({
  operations: Schema.Array(
    Schema.Struct({ id: Schema.String, operation: ReadOperationName, input: Schema.Any }),
  ),
});
export const CoreWorkBatchWriteArgs = Schema.Struct({
  operations: Schema.Array(
    Schema.Struct({ id: Schema.String, operation: WriteOperationName, input: Schema.Any }),
  ),
});
export const CoreWorkSystemBatchWriteArgs = Schema.Struct({
  operations: Schema.Array(
    Schema.Struct({ id: Schema.String, operation: SystemWriteOperationName, input: Schema.Any }),
  ),
});

export const CoreWorkBatchReadResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("coreWorkBatchRead"),
  results: Schema.Array(BatchResult),
});

export const CoreWorkBatchWriteResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("coreWorkBatchWrite"),
  results: Schema.Array(BatchResult),
});

export const CoreWorkSystemBatchWriteResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("coreWorkSystemBatchWrite"),
  results: Schema.Array(BatchResult),
});

export type CoreWorkBatchReadResponse = typeof CoreWorkBatchReadResponse.Type;
export type CoreWorkBatchWriteResponse = typeof CoreWorkBatchWriteResponse.Type;
export type CoreWorkSystemBatchWriteResponse = typeof CoreWorkSystemBatchWriteResponse.Type;
export type CoreWorkBatchReadArgs = typeof CoreWorkBatchReadArgs.Type;
export type CoreWorkBatchWriteArgs = typeof CoreWorkBatchWriteArgs.Type;
export type CoreWorkSystemBatchWriteArgs = typeof CoreWorkSystemBatchWriteArgs.Type;

export const coreWorkBatchReadResponse = (
  results: ReadonlyArray<typeof BatchResult.Type>,
): CoreWorkBatchReadResponse => ({ ok: true, operation: "coreWorkBatchRead", results });

export const coreWorkBatchWriteResponse = (
  results: ReadonlyArray<typeof BatchResult.Type>,
): CoreWorkBatchWriteResponse => ({ ok: true, operation: "coreWorkBatchWrite", results });

export const coreWorkSystemBatchWriteResponse = (
  results: ReadonlyArray<typeof BatchResult.Type>,
): CoreWorkSystemBatchWriteResponse => ({
  ok: true,
  operation: "coreWorkSystemBatchWrite",
  results,
});
