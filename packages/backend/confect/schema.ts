import { DatabaseSchema, Table } from "@confect/server";
import { Schema } from "effect";

import {
  ActivityActorType,
  ActivityEntityType,
  ActivityEventType,
  ActivityMetadata,
} from "../activityRegistry";
import { CycleAdjustmentLifecycle, CycleAdjustmentOverrides } from "../templateProjection";

export const Workflows = Table.make(
  "workflows",
  Schema.Struct({
    churchId: Schema.String,
    key: Schema.String,
    name: Schema.String,
    isDefault: Schema.Boolean,
    sortOrder: Schema.Number,
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_churchId_and_key", ["churchId", "key"])
  .index("by_churchId", ["churchId"]);

export const WorkflowStatuses = Table.make(
  "workflowStatuses",
  Schema.Struct({
    churchId: Schema.String,
    workflowId: Schema.String,
    key: Schema.String,
    name: Schema.String,
    taskState: Schema.Union(
      Schema.Literal("todo"),
      Schema.Literal("in_progress"),
      Schema.Literal("done"),
      Schema.Literal("canceled"),
    ),
    sortOrder: Schema.Number,
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_workflowId_and_key", ["workflowId", "key"])
  .index("by_churchId", ["churchId"])
  .index("by_workflowId", ["workflowId"]);

export const Tasks = Table.make(
  "tasks",
  Schema.Struct({
    churchId: Schema.String,
    title: Schema.String,
    teamId: Schema.Union(Schema.String, Schema.Null),
    cycleId: Schema.String,
    dueDate: Schema.String,
    parentTaskId: Schema.Union(Schema.String, Schema.Null),
    workflowId: Schema.String,
    workflowStatusId: Schema.String,
    taskState: Schema.Union(
      Schema.Literal("todo"),
      Schema.Literal("in_progress"),
      Schema.Literal("done"),
      Schema.Literal("canceled"),
    ),
    sourceTemplateId: Schema.Union(Schema.String, Schema.Null),
    sourceTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
    sourceTemplateCycleId: Schema.Union(Schema.String, Schema.Null),
    sourceTemplateSyncEnabled: Schema.Boolean,
  }),
)
  .index("by_churchId", ["churchId"])
  .index("by_churchId_and_cycleId", ["churchId", "cycleId"])
  .index("by_churchId_and_sourceTemplateTaskId_and_sourceTemplateCycleId", [
    "churchId",
    "sourceTemplateTaskId",
    "sourceTemplateCycleId",
  ])
  .index("by_churchId_and_sourceTemplateTaskId", ["churchId", "sourceTemplateTaskId"])
  .index("by_parentTaskId", ["parentTaskId"])
  .index("by_workflowStatusId", ["workflowStatusId"]);

export const Cycles = Table.make(
  "cycles",
  Schema.Struct({
    churchId: Schema.String,
    /** Church-local Monday that identifies the Cycle. */
    startDate: Schema.String,
    /** Church-local Sunday displayed as the Cycle's final calendar date. */
    endDate: Schema.String,
    /** UTC instant for the inclusive start boundary of the local Cycle. */
    startsAt: Schema.String,
    /** UTC instant for the exclusive end boundary immediately after local Sunday. */
    endsAt: Schema.String,
    churchTimeZone: Schema.String,
  }),
)
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

export const Templates = Table.make(
  "templates",
  Schema.Struct({
    churchId: Schema.String,
    key: Schema.String,
    name: Schema.String,
    recurrence: Schema.Union(
      Schema.Literal("none"),
      Schema.Literal("weekly"),
      Schema.Literal("monthly"),
      Schema.Literal("quarterly"),
      Schema.Literal("yearly"),
    ),
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_churchId_and_key", ["churchId", "key"])
  .index("by_churchId", ["churchId"]);

export const FocusWindows = Table.make(
  "focusWindows",
  Schema.Struct({
    churchId: Schema.String,
    templateId: Schema.String,
    key: Schema.String,
    name: Schema.String,
    type: Schema.String,
    /** Church-local start date for scheduling rules; no UTC instant is stored here. */
    startDate: Schema.String,
    /** Optional Church-local end date for scheduling rules; no UTC instant is stored here. */
    endDate: Schema.Union(Schema.String, Schema.Null),
    /** Optional Church-local anchor date used by relative scheduling rules. */
    anchorDate: Schema.Union(Schema.String, Schema.Null),
    keyDateId: Schema.Union(Schema.String, Schema.Null),
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_churchId", ["churchId"])
  .index("by_templateId", ["templateId"])
  .index("by_templateId_and_key", ["templateId", "key"]);

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

export const TemplateTasks = Table.make(
  "templateTasks",
  Schema.Struct({
    churchId: Schema.String,
    templateId: Schema.String,
    key: Schema.String,
    title: Schema.String,
    parentTemplateTaskId: Schema.Union(Schema.String, Schema.Null),
    schedulingRule: SchedulingRule,
    archivedAt: Schema.Union(Schema.String, Schema.Null),
  }),
)
  .index("by_churchId", ["churchId"])
  .index("by_templateId", ["templateId"])
  .index("by_templateId_and_key", ["templateId", "key"]);

export const CycleAdjustments = Table.make(
  "cycleAdjustments",
  Schema.Struct({
    churchId: Schema.String,
    cycleId: Schema.String,
    templateTaskId: Schema.String,
    lifecycle: CycleAdjustmentLifecycle,
    overrides: CycleAdjustmentOverrides,
  }),
)
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
  .addTable(Cycles)
  .addTable(KeyDates)
  .addTable(KeyDateOccurrences)
  .addTable(Templates)
  .addTable(FocusWindows)
  .addTable(TemplateTasks)
  .addTable(CycleAdjustments)
  .addTable(Activities);
