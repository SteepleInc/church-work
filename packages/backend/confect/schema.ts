import { DatabaseSchema, Table } from "@confect/server";
import { CycleTableFieldsSchema } from "@church-task/domain/Cycle";
import { LabelTableFieldsSchema } from "@church-task/domain/Label";
import { TaskTableFieldsSchema } from "@church-task/domain/Task";
import {
  CycleAdjustmentTableFieldsSchema,
  FocusWindowTableFieldsSchema,
  TemplateTableFieldsSchema,
  TemplateTeamTableFieldsSchema,
  TemplateTaskTableFieldsSchema,
} from "@church-task/domain/Template";
import {
  WorkflowStatusTableFieldsSchema,
  WorkflowTableFieldsSchema,
} from "@church-task/domain/Workflow";
import { Schema } from "effect";

import {
  ActivityActorType,
  ActivityEntityType,
  ActivityEventType,
  ActivityMetadata,
} from "../activityRegistry";

export const Workflows = Table.make("workflows", WorkflowTableFieldsSchema)
  .index("by_churchId_and_key", ["churchId", "key"])
  .index("by_churchId", ["churchId"])
  // Every Team owns its Workflow (ADR 0013): a Task's Workflow is looked up
  // by its Team, never through a Church-level default.
  .index("by_churchId_and_teamId", ["churchId", "teamId"]);

export const WorkflowStatuses = Table.make("workflowStatuses", WorkflowStatusTableFieldsSchema)
  .index("by_workflowId_and_key", ["workflowId", "key"])
  .index("by_churchId", ["churchId"])
  .index("by_workflowId", ["workflowId"]);

export const Tasks = Table.make("tasks", TaskTableFieldsSchema)
  .index("by_churchId", ["churchId"])
  .index("by_churchId_and_teamId", ["churchId", "teamId"])
  // Task Identifier resolution: a parsed "PRD-48" looks up the Task by its
  // Team plus per-Team number (ADR 0013).
  .index("by_churchId_and_teamId_and_number", ["churchId", "teamId", "number"])
  .index("by_churchId_and_cycleId", ["churchId", "cycleId"])
  .index("by_churchId_and_sourceTemplateTaskId_and_sourceTemplateCycleId", [
    "churchId",
    "sourceTemplateTaskId",
    "sourceTemplateCycleId",
  ])
  .index("by_churchId_and_sourceTemplateTaskId", ["churchId", "sourceTemplateTaskId"])
  .index("by_parentTaskId", ["parentTaskId"])
  .index("by_workflowStatusId", ["workflowStatusId"]);

// Labels are hard-deleted (no archivedAt), Linear-style; see
// docs/adr/0013-task-labels-as-id-array-with-hard-deleted-labels.md.
export const Labels = Table.make("labels", LabelTableFieldsSchema).index("by_churchId", [
  "churchId",
]);

export const Cycles = Table.make("cycles", CycleTableFieldsSchema)
  .index("by_churchId_and_startDate", ["churchId", "startDate"])
  .index("by_churchId", ["churchId"]);

export const KeyDates = Table.make(
  "keyDates",
  Schema.Struct({
    churchId: Schema.String,
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
  }),
)
  .index("by_churchId_and_key", ["churchId", "key"])
  .index("by_churchId", ["churchId"]);

export const KeyDateOccurrences = Table.make(
  "keyDateOccurrences",
  Schema.Struct({
    churchId: Schema.String,
    keyDateId: Schema.String,
    /** Church-local occurrence date used by scheduling rules that anchor to this Key Date. */
    localDate: Schema.String,
    label: Schema.Union(Schema.String, Schema.Null),
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_churchId", ["churchId"])
  .index("by_keyDateId", ["keyDateId"])
  .index("by_keyDateId_and_localDate", ["keyDateId", "localDate"]);

export const Templates = Table.make("templates", TemplateTableFieldsSchema)
  .index("by_churchId_and_key", ["churchId", "key"])
  .index("by_churchId", ["churchId"]);

export const TemplateTeams = Table.make("templateTeams", TemplateTeamTableFieldsSchema)
  .index("by_churchId", ["churchId"])
  .index("by_templateId", ["templateId"])
  .index("by_templateId_and_key", ["templateId", "key"])
  .index("by_churchId_and_mappedTeamId", ["churchId", "mappedTeamId"]);

export const FocusWindows = Table.make("focusWindows", FocusWindowTableFieldsSchema)
  .index("by_churchId", ["churchId"])
  .index("by_templateId", ["templateId"])
  .index("by_templateId_and_key", ["templateId", "key"]);

export const TemplateTasks = Table.make("templateTasks", TemplateTaskTableFieldsSchema)
  .index("by_churchId", ["churchId"])
  .index("by_templateTeamId", ["templateTeamId"])
  .index("by_templateId", ["templateId"])
  .index("by_templateId_and_key", ["templateId", "key"]);

export const CycleAdjustments = Table.make("cycleAdjustments", CycleAdjustmentTableFieldsSchema)
  .index("by_churchId", ["churchId"])
  .index("by_churchId_and_cycleId", ["churchId", "cycleId"])
  .index("by_churchId_and_cycleId_and_templateTaskId", ["churchId", "cycleId", "templateTaskId"]);

export const Activities = Table.make(
  "activities",
  Schema.Struct({
    churchId: Schema.String,
    entityType: ActivityEntityType,
    entityId: Schema.String,
    eventType: ActivityEventType,
    actorType: ActivityActorType,
    actorId: Schema.Union(Schema.String, Schema.Null),
    occurredAt: Schema.String,
    cycleId: Schema.Union(Schema.String, Schema.Null),
    metadata: ActivityMetadata,
  }),
)
  .index("by_churchId_and_entity", ["churchId", "entityType", "entityId"])
  .index("by_churchId", ["churchId"]);

export default DatabaseSchema.make()
  .addTable(Workflows)
  .addTable(WorkflowStatuses)
  .addTable(Tasks)
  .addTable(Labels)
  .addTable(Cycles)
  .addTable(KeyDates)
  .addTable(KeyDateOccurrences)
  .addTable(Templates)
  .addTable(TemplateTeams)
  .addTable(FocusWindows)
  .addTable(TemplateTasks)
  .addTable(CycleAdjustments)
  .addTable(Activities);
