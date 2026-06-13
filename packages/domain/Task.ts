import { Schema } from "effect";

import { TEAM_IDENTIFIER_MAX_LENGTH } from "./Team";

export const TaskStatusSchema = Schema.Literal("todo", "in_progress", "done", "canceled");
export const RestorableTaskStatusSchema = Schema.Literal("todo", "in_progress", "done");

// Task Identifier: the user-facing reference for a Task — its Team's Team
// Identifier plus the Task's per-Team sequence number (e.g. "PRD-48").
// Computed at read time from `team identifier + task number` (ADR 0013);
// matching is case-insensitive, canonical form is uppercase. Pure functions
// only — no I/O.
export const formatTaskIdentifier = (teamIdentifier: string, taskNumber: number): string =>
  `${teamIdentifier.trim().toUpperCase()}-${taskNumber}`;

const TASK_IDENTIFIER_PATTERN = new RegExp(
  `^([A-Za-z0-9]{1,${TEAM_IDENTIFIER_MAX_LENGTH}})-([0-9]+)$`,
);

export type ParsedTaskIdentifier = {
  readonly teamIdentifier: string;
  readonly taskNumber: number;
};

// Parse a Task Identifier string ("prd-48", "PRD-48") into its Team
// Identifier (uppercase canonical form) and task number. Returns null for
// anything that is not a well-formed Task Identifier.
export const parseTaskIdentifier = (value: string): ParsedTaskIdentifier | null => {
  const match = TASK_IDENTIFIER_PATTERN.exec(value.trim());
  if (!match) return null;

  const taskNumber = Number.parseInt(match[2]!, 10);
  if (!Number.isSafeInteger(taskNumber) || taskNumber < 1) return null;

  return { teamIdentifier: match[1]!.toUpperCase(), taskNumber };
};

// Estimate: per-Task effort size (see CONTEXT.md "Estimate"). Null/absent
// means "no estimate"; the "no_estimate" sentinel is a UI-only concept.
export const TaskEstimateSchema = Schema.Literal("xs", "s", "m", "l", "xl");

export const TaskTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  title: Schema.String,
  // Every Task belongs to exactly one Team (ADR 0013).
  teamId: Schema.String,
  // Per-Team sequence number drawn from the Team's counter at creation /
  // projection time. Dense within a Team; prefixed by the Team Identifier to
  // form the Task Identifier (ADR 0013).
  number: Schema.Number,
  // Retired Task Identifiers (canonical uppercase, e.g. "PRD-48") this Task
  // answered to before a team move renumbered it. Resolution falls back to
  // these aliases only when nothing current matches (ADR 0013).
  previousIdentifiers: Schema.Array(Schema.String),
  // Free-form Task description. Optional because pre-existing Tasks were
  // written before the field existed.
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  // Due Date is never auto-assigned; a Task with no Due Date belongs to the
  // Cycle containing its creation date (see CONTEXT.md "Due Date").
  dueDate: Schema.Union(Schema.String, Schema.Null),
  // The User who created the Task. Optional because pre-existing Tasks were
  // written before the field existed; Template projection writes null.
  createdByUserId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  // Labels attached to the Task as an id array (see
  // docs/adr/0013-task-labels-as-id-array-with-hard-deleted-labels.md).
  // Optional because pre-existing Tasks were written before the field existed.
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskStatusSchema,
  // Per-Task effort size. Optional because pre-existing Tasks were written
  // before the field existed; null and absent both mean "no estimate".
  estimate: Schema.optional(Schema.Union(TaskEstimateSchema, Schema.Null)),
  // Board Order: fractional-indexing key ordering Tasks within a Board Column
  // (see docs/adr/0012-fractional-board-order.md). Compared as a plain string.
  boardOrder: Schema.String,
  finishedAt: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export const TaskSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  title: Schema.String,
  teamId: Schema.String,
  number: Schema.Number,
  // The computed Task Identifier (e.g. "PRD-48"): the Team's current Team
  // Identifier plus the Task's number, derived by the serializers at read time.
  identifier: Schema.String,
  description: Schema.Union(Schema.String, Schema.Null),
  assignedUserId: Schema.Union(Schema.String, Schema.Null),
  cycleId: Schema.String,
  dueDate: Schema.Union(Schema.String, Schema.Null),
  // Convex's built-in document creation time (epoch ms). Surfaced from
  // `_creationTime` by the task serializers so clients can show "Created …".
  createdAt: Schema.Number,
  createdByUserId: Schema.Union(Schema.String, Schema.Null),
  parentTaskId: Schema.Union(Schema.String, Schema.Null),
  labelIds: Schema.Array(Schema.String),
  workflowId: Schema.String,
  workflowStatusId: Schema.String,
  taskState: TaskStatusSchema,
  estimate: Schema.Union(TaskEstimateSchema, Schema.Null),
  boardOrder: Schema.String,
  finishedAt: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
  sourceTemplateSyncEnabled: Schema.Boolean,
});

export type Task = typeof TaskSchema.Type;
export type TaskStatus = typeof TaskStatusSchema.Type;
export type TaskEstimate = typeof TaskEstimateSchema.Type;
export type RestorableTaskStatus = typeof RestorableTaskStatusSchema.Type;
