import {
  DEFAULT_WORKFLOW_STATUSES,
  mergeTemplateTaskProjection,
  resolveSchedulingRule,
  type CycleAdjustmentOverride,
  type SchedulingRule,
  formatTaskIdentifier,
  generateTeamIdentifier,
  getLabelColorForName,
  getTeamColorForName,
  normalizeTeamIdentifier,
  TEAM_IDENTIFIER_MAX_LENGTH,
} from "@church-task/domain";
import {
  getActivityId,
  getCycleAdjustmentId,
  getCycleId,
  getDemoItemId,
  getFocusWindowId,
  getKeyDateId,
  getKeyDateOccurrenceId,
  getLabelId,
  getTemplateId,
  getTemplateScheduleId,
  getTemplateTaskId,
  getTemplateTeamId,
  getTaskId,
  getTaskCommentId,
  getTeamId,
  getTeamMembershipId,
  getWorkflowId,
  getWorkflowStatusId,
} from "@church-task/shared/get-ids";
import { defineMutatorWithType, defineMutators } from "@rocicorp/zero";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { Schema } from "effect";

import {
  activities,
  cycle_adjustments,
  cycles,
  demo_items,
  focus_windows,
  key_date_occurrences,
  key_dates,
  labels,
  tasks,
  task_comments,
  team_memberships,
  teams,
  template_schedules,
  template_tasks,
  template_teams,
  templates,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";
import { requireActiveChurchAccess, requireSignedInSession } from "./session-context";
import { toZeroSchema } from "./effect-schema";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const CreateDemoItemArgs = toZeroSchema(Schema.Struct({ name: Schema.String }));
const CreateTeamArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, name: Schema.String }),
);
const RenameTeamArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, team_id: Schema.String }),
);
const SetTeamIdentifierArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, identifier: Schema.String, team_id: Schema.String }),
);
const DeleteTeamArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String }),
);
const ReorderTeamsArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, team_ids: Schema.Array(Schema.String) }),
);
const TeamMemberArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String, user_id: Schema.String }),
);
const CreateLabelArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    color: Schema.optional(Schema.String),
    label_id: Schema.optional(Schema.String),
    name: Schema.String,
    team_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  }),
);
const UpdateLabelArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    color: Schema.optional(Schema.String),
    label_id: Schema.String,
    name: Schema.optional(Schema.String),
  }),
);
const DeleteLabelArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, label_id: Schema.String }),
);
const RenameWorkflowArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, workflow_id: Schema.String }),
);
const ReorderWorkflowsArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, workflow_ids: Schema.Array(Schema.String) }),
);
const ArchiveWorkflowArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, workflow_id: Schema.String }),
);
const AddWorkflowStatusArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    status: Schema.Struct({
      key: Schema.String,
      name: Schema.String,
      sort_order: Schema.Number,
      task_state: Schema.String,
    }),
    workflow_id: Schema.String,
  }),
);
const RenameWorkflowStatusArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, status_id: Schema.String }),
);
const ReorderWorkflowStatusesArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    status_ids: Schema.Array(Schema.String),
    workflow_id: Schema.String,
  }),
);
const ArchiveWorkflowStatusArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, status_id: Schema.String }),
);
const TaskEstimateArg = Schema.Union([
  Schema.Literal("xs"),
  Schema.Literal("s"),
  Schema.Literal("m"),
  Schema.Literal("l"),
  Schema.Literal("xl"),
  Schema.Null,
]);
const TaskPriorityArg = Schema.Union([
  Schema.Literal("urgent"),
  Schema.Literal("high"),
  Schema.Literal("medium"),
  Schema.Literal("low"),
  Schema.Null,
]);
const TargetCycleArg = Schema.Struct({
  church_time_zone: Schema.String,
  end_date: Schema.String,
  ends_at: Schema.String,
  start_date: Schema.String,
  starts_at: Schema.String,
});
type TargetCycleInput = typeof TargetCycleArg.Type;
const TaskFieldsArg = Schema.Struct({
  assigned_user_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  board_order: Schema.optional(Schema.String),
  cycle_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  due_date: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  estimate: Schema.optional(TaskEstimateArg),
  priority: Schema.optional(TaskPriorityArg),
  label_ids: Schema.optional(Schema.Array(Schema.String)),
  parent_task_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  team_id: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  target_cycle: Schema.optional(TargetCycleArg),
  workflow_status_id: Schema.optional(Schema.String),
});
const CreateTaskArgs = toZeroSchema(
  Schema.Struct({
    assigned_user_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    church_id: Schema.String,
    description: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    due_date: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    estimate: Schema.optional(TaskEstimateArg),
    priority: Schema.optional(TaskPriorityArg),
    label_ids: Schema.optional(Schema.Array(Schema.String)),
    parent_task_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    team_id: Schema.String,
    title: Schema.String,
    target_cycle: Schema.optional(TargetCycleArg),
    workflow_status_id: Schema.String,
  }),
);
const UpdateTaskArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, fields: TaskFieldsArg, task_id: Schema.String }),
);
const UpdateTasksBatchArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    updates: Schema.Array(Schema.Struct({ fields: TaskFieldsArg, task_id: Schema.String })),
  }),
);
const MaterializeProjectedTaskArgs = toZeroSchema(
  Schema.Struct({
    assigned_user_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    church_id: Schema.String,
    cycle_id: Schema.String,
    description: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    due_date: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    estimate: Schema.optional(TaskEstimateArg),
    priority: Schema.optional(TaskPriorityArg),
    label_ids: Schema.optional(Schema.Array(Schema.String)),
    source_template_id: Schema.String,
    source_template_occurrence_key: Schema.String,
    source_template_schedule_id: Schema.String,
    source_template_task_id: Schema.String,
    team_id: Schema.String,
    title: Schema.String,
    workflow_status_id: Schema.String,
  }),
);
const TaskTransitionArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, task_id: Schema.String }),
);
const CreateTaskCommentArgs = toZeroSchema(
  Schema.Struct({
    body: Schema.String,
    church_id: Schema.String,
    parent_comment_id: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    task_id: Schema.String,
  }),
);
const KeyDateScheduleArg = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("fixedYearly"), month: Schema.Number, day: Schema.Number }),
  Schema.Struct({
    kind: Schema.Literal("computedYearly"),
    rule: Schema.Union([
      Schema.Literal("easter"),
      Schema.Literal("palm_sunday"),
      Schema.Literal("pentecost"),
      Schema.Literal("ash_wednesday"),
      Schema.Literal("good_friday"),
      Schema.Literal("mothers_day"),
      Schema.Literal("fathers_day"),
      Schema.Literal("thanksgiving"),
    ]),
  }),
  Schema.Struct({ kind: Schema.Literal("oneTime"), localDate: Schema.String }),
]);
const SchedulingRuleArg = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("fixedDate"), localDate: Schema.String }),
  Schema.Struct({
    edge: Schema.Union([Schema.Literal("start"), Schema.Literal("end")]),
    focusWindowId: Schema.String,
    kind: Schema.Literal("relativeToFocusWindow"),
    offsetDays: Schema.Number,
  }),
  Schema.Struct({
    focusWindowId: Schema.String,
    kind: Schema.Literal("relativeToAnchorDate"),
    offsetDays: Schema.Number,
  }),
  Schema.Struct({
    keyDateId: Schema.String,
    kind: Schema.Literal("relativeToKeyDate"),
    offsetDays: Schema.Number,
    year: Schema.Number,
  }),
  Schema.Struct({
    baseLocalDate: Schema.String,
    dayOffset: Schema.Number,
    kind: Schema.Literal("cycleOffset"),
    offsetCycles: Schema.Number,
  }),
]);
const TemplateScheduleRuleArg = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("weekly"),
    weekdays: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    keyDateId: Schema.String,
    kind: Schema.Literal("keyDate"),
    repeat: Schema.Union([Schema.Literal("none"), Schema.Literal("yearly")]),
  }),
  Schema.Struct({
    kind: Schema.Literal("monthly"),
    repeat: Schema.Union([Schema.Literal("none"), Schema.Literal("monthly")]),
  }),
  Schema.Struct({
    kind: Schema.Literal("quarterly"),
    repeat: Schema.Union([Schema.Literal("none"), Schema.Literal("quarterly")]),
  }),
  Schema.Struct({
    kind: Schema.Literal("yearly"),
    repeat: Schema.Union([Schema.Literal("none"), Schema.Literal("yearly")]),
  }),
]);
const CycleAdjustmentOverrideArg = Schema.Union([
  Schema.Struct({ field: Schema.Literal("title"), value: Schema.String }),
  Schema.Struct({
    field: Schema.Literal("description"),
    value: Schema.Union([Schema.String, Schema.Null]),
  }),
  Schema.Struct({
    field: Schema.Literal("assignedUserId"),
    value: Schema.Union([Schema.String, Schema.Null]),
  }),
  Schema.Struct({ field: Schema.Literal("teamId"), value: Schema.String }),
  Schema.Struct({ field: Schema.Literal("dueDate"), value: Schema.String }),
  Schema.Struct({ field: Schema.Literal("labelIds"), value: Schema.Array(Schema.String) }),
  Schema.Struct({
    field: Schema.Literal("estimate"),
    value: Schema.Union([Schema.String, Schema.Null]),
  }),
  Schema.Struct({
    field: Schema.Literal("priority"),
    value: Schema.Union([Schema.String, Schema.Null]),
  }),
  Schema.Struct({
    field: Schema.Literal("parentTemplateTaskId"),
    value: Schema.Union([Schema.String, Schema.Null]),
  }),
]);
type CycleAdjustmentOverrideInput = typeof CycleAdjustmentOverrideArg.Type;

const mergeCycleAdjustmentOverrides = (
  existingOverrides: readonly CycleAdjustmentOverrideInput[],
  incomingOverrides: readonly CycleAdjustmentOverrideInput[],
) => {
  const overridesByField = new Map<
    CycleAdjustmentOverrideInput["field"],
    CycleAdjustmentOverrideInput
  >();
  for (const override of existingOverrides) overridesByField.set(override.field, override);
  for (const override of incomingOverrides) overridesByField.set(override.field, override);
  return [...overridesByField.values()];
};
const UpsertCycleArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    church_time_zone: Schema.String,
    description: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    end_date: Schema.String,
    ends_at: Schema.String,
    name: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
    start_date: Schema.String,
    starts_at: Schema.String,
  }),
);
const UpdateCycleDetailsArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    cycle_id: Schema.String,
    description: Schema.Union([Schema.String, Schema.Null]),
    name: Schema.Union([Schema.String, Schema.Null]),
  }),
);
const CreateKeyDateArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    key: Schema.String,
    name: Schema.String,
    schedule: KeyDateScheduleArg,
  }),
);
const UpdateKeyDateArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    key: Schema.String,
    key_date_id: Schema.String,
    name: Schema.String,
    schedule: KeyDateScheduleArg,
  }),
);
const DeleteKeyDateArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, key_date_id: Schema.String }),
);
const CreateKeyDateOccurrenceArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    key_date_id: Schema.String,
    label: Schema.Union([Schema.String, Schema.Null]),
    local_date: Schema.String,
  }),
);
const CreateTemplateArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    focus_windows: Schema.Array(
      Schema.Struct({
        anchor_date: Schema.Union([Schema.String, Schema.Null]),
        end_date: Schema.Union([Schema.String, Schema.Null]),
        key: Schema.String,
        key_date_id: Schema.Union([Schema.String, Schema.Null]),
        name: Schema.String,
        start_date: Schema.String,
        type: Schema.String,
      }),
    ),
    key: Schema.String,
    name: Schema.String,
    placement_shape: Schema.Union([Schema.String, Schema.Null]),
    recurrence: Schema.String,
    template_schedule: Schema.Union([
      Schema.Struct({
        end_date: Schema.Union([Schema.String, Schema.Null]),
        key: Schema.String,
        kind: Schema.String,
        name: Schema.String,
        recurrence: Schema.String,
        rule: TemplateScheduleRuleArg,
        start_date: Schema.String,
      }),
      Schema.Null,
    ]),
    template_tasks: Schema.Array(
      Schema.Struct({
        assigned_user_id: Schema.Union([Schema.String, Schema.Null]),
        description: Schema.Union([Schema.String, Schema.Null]),
        estimate: Schema.Union([Schema.String, Schema.Null]),
        priority: Schema.Union([Schema.String, Schema.Null]),
        key: Schema.String,
        label_ids: Schema.Array(Schema.String),
        parent_template_task_key: Schema.Union([Schema.String, Schema.Null]),
        placement_cycle_offset: Schema.Union([Schema.Number, Schema.Null]),
        placement_weekday: Schema.Union([Schema.Number, Schema.Null]),
        scheduling_rule: SchedulingRuleArg,
        template_team_key: Schema.Union([Schema.String, Schema.Null]),
        title: Schema.String,
      }),
    ),
    template_teams: Schema.Array(
      Schema.Struct({ key: Schema.String, mapped_team_id: Schema.String, name: Schema.String }),
    ),
  }),
);
const SetCycleAdjustmentsArgs = toZeroSchema(
  Schema.Struct({
    adjustments: Schema.Array(
      Schema.Struct({
        cycle_id: Schema.String,
        lifecycle: Schema.Union([Schema.Literal("active"), Schema.Literal("skipped")]),
        overrides: Schema.Array(CycleAdjustmentOverrideArg),
        source_template_occurrence_key: Schema.String,
        source_template_schedule_id: Schema.String,
        template_task_id: Schema.String,
      }),
    ),
    church_id: Schema.String,
  }),
);
const ProjectTemplateCycleArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, cycle_id: Schema.String, template_id: Schema.String }),
);
const TemplateEntityMutationArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, id: Schema.String }),
);
const DuplicateTemplateArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, template_id: Schema.String }),
);
const DeleteTemplateScheduleArgs = toZeroSchema(
  Schema.Struct({
    church_id: Schema.String,
    cleanup_current_occurrence: Schema.Boolean,
    current_date: Schema.String,
    current_occurrence_key: Schema.Union([Schema.String, Schema.Null]),
    id: Schema.String,
  }),
);

const defineChurchTaskMutator = defineMutatorWithType<
  ZeroSchema,
  OptionalZeroSessionContext,
  unknown
>();

const softDeleteEntity = async (params: {
  readonly db: ReturnType<typeof serverDb> extends infer Db ? NonNullable<Db> : never;
  readonly table: typeof templates | typeof template_tasks | typeof template_schedules;
  readonly church_id: string;
  readonly id: string;
  readonly user_id: string;
  readonly now: Date;
}) => {
  await params.db
    .update(params.table)
    .set({
      deleted_at: params.now,
      deleted_by: params.user_id,
      updated_at: params.now,
      updated_by: params.user_id,
    })
    .where(
      and(
        eq(params.table.id, params.id),
        eq(params.table.church_id, params.church_id),
        isNull(params.table.deleted_at),
      ),
    );
};

const restoreEntity = async (params: {
  readonly db: ReturnType<typeof serverDb> extends infer Db ? NonNullable<Db> : never;
  readonly table: typeof templates | typeof template_tasks | typeof template_schedules;
  readonly church_id: string;
  readonly id: string;
  readonly user_id: string;
  readonly now: Date;
}) => {
  await params.db
    .update(params.table)
    .set({ deleted_at: null, deleted_by: null, updated_at: params.now, updated_by: params.user_id })
    .where(and(eq(params.table.id, params.id), eq(params.table.church_id, params.church_id)));
};

const requireTeamManager = (ctx: OptionalZeroSessionContext, church_id: string) => {
  const session = requireActiveChurchAccess(ctx, church_id);

  if (!session.is_app_admin && session.church_role !== "owner" && session.church_role !== "admin") {
    throw new Error("Only Church owners and admins can change Teams.");
  }

  return session;
};

const isValidTeamIdentifier = (identifier: string) =>
  identifier.length > 0 &&
  identifier.length <= TEAM_IDENTIFIER_MAX_LENGTH &&
  /^[A-Z0-9]+$/.test(identifier);

const parsePreviousIdentifiers = (value: string): readonly string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const serializeStringArray = (values: ReadonlyArray<string>) =>
  JSON.stringify([...new Set(values)]);

const appendBoardOrderKey = (lastKey: string | null): string => {
  if (lastKey === null) return "a1";
  const prefix = lastKey.match(/^[a-zA-Z]+/)?.[0] ?? "a";
  const parsed = Number.parseFloat(
    lastKey.startsWith(prefix) ? lastKey.slice(prefix.length) : lastKey,
  );
  return `${prefix}${Number.isFinite(parsed) ? parsed + 1 : 1}`;
};

const parseSerializedStringArray = (value: string): readonly string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

type LabelScopeRow = {
  readonly id: string;
  readonly name: string;
  readonly team_id: string | null;
};

type ServerTx = {
  readonly dbTransaction: {
    readonly wrappedTransaction: {
      readonly delete: (table: unknown) => any;
      readonly insert: (table: unknown) => any;
      readonly select: (fields?: unknown) => any;
      readonly update: (table: unknown) => any;
    };
  };
};

const serverDb = (tx: { readonly location: string }) => {
  if (tx.location !== "server") return null;
  return (tx as typeof tx & ServerTx).dbTransaction.wrappedTransaction;
};

const getChurchLabels = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  church_id: string,
) =>
  (await db
    .select({ id: labels.id, name: labels.name, team_id: labels.team_id })
    .from(labels)
    .where(and(eq(labels.church_id, church_id), isNull(labels.deleted_at)))) as LabelScopeRow[];

const normalizeLabelName = (name: string) => name.trim().toLowerCase();

const ensureUniqueLabelName = (
  existingLabels: readonly LabelScopeRow[],
  args: {
    readonly exclude_id?: string;
    readonly name: string;
    readonly team_id: string | null;
  },
) => {
  const normalized = normalizeLabelName(args.name);
  const duplicate = existingLabels.some(
    (label) =>
      label.id !== args.exclude_id &&
      label.team_id === args.team_id &&
      normalizeLabelName(label.name) === normalized,
  );

  if (duplicate) throw new Error("A Label with that name already exists in this scope.");
};

const validateTaskLabelIds = (
  existingLabels: readonly LabelScopeRow[],
  args: { readonly label_ids: readonly string[]; readonly team_id: string },
) => {
  const labelsById = new Map(existingLabels.map((label) => [label.id, label]));

  for (const label_id of args.label_ids) {
    const label = labelsById.get(label_id);
    if (!label) throw new Error("Label not found.");
    if (label.team_id !== null && label.team_id !== args.team_id) {
      throw new Error("Label is not in this Task's Team scope.");
    }
  }
};

const stripForeignTeamLabelIds = (
  existingLabels: readonly LabelScopeRow[],
  args: { readonly label_ids: readonly string[]; readonly team_id: string },
) => {
  const labelsById = new Map(existingLabels.map((label) => [label.id, label]));

  return args.label_ids.filter((label_id) => {
    const label = labelsById.get(label_id);

    return label !== undefined && (label.team_id === null || label.team_id === args.team_id);
  });
};

const getTaskWithTeamIdentifier = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  task_id: string,
  church_id: string,
) => {
  const rows = (await db
    .select({
      board_order: tasks.board_order,
      church_id: tasks.church_id,
      deleted_at: tasks.deleted_at,
      finished_at: tasks.finished_at,
      id: tasks.id,
      label_ids: tasks.label_ids,
      number: tasks.number,
      previous_identifiers: tasks.previous_identifiers,
      cycle_id: tasks.cycle_id,
      task_state: tasks.task_state,
      team_id: tasks.team_id,
      team_identifier: teams.identifier,
      workflow_id: tasks.workflow_id,
      workflow_status_id: tasks.workflow_status_id,
    })
    .from(tasks)
    .leftJoin(teams, eq(tasks.team_id, teams.id))
    .where(
      and(eq(tasks.id, task_id), eq(tasks.church_id, church_id), isNull(tasks.deleted_at)),
    )) as Array<{
    readonly board_order: string;
    readonly church_id: string;
    readonly deleted_at: Date | null;
    readonly finished_at: Date | null;
    readonly id: string;
    readonly label_ids: string;
    readonly number: number;
    readonly previous_identifiers: string;
    readonly cycle_id: string | null;
    readonly task_state: string;
    readonly team_id: string;
    readonly team_identifier: string | null;
    readonly workflow_id: string;
    readonly workflow_status_id: string;
  }>;

  return rows[0] ?? null;
};

const stringifyJson = (value: unknown) => JSON.stringify(value);

const parseJson = <Value>(value: string, fallback: Value): Value => {
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
};

const writeActivity = async (
  db: any,
  args: {
    readonly actor_id: string;
    readonly church_id: string;
    readonly cycle_id?: string | null;
    readonly entity_id: string;
    readonly entity_type: string;
    readonly event_type: string;
    readonly metadata?: unknown;
    readonly occurred_at?: Date;
  },
) => {
  const occurredAt = args.occurred_at ?? new Date();

  await db.insert(activities).values({
    _tag: "activity",
    actor_id: args.actor_id,
    actor_type: "user",
    church_id: args.church_id,
    created_at: occurredAt,
    created_by: args.actor_id,
    cycle_id: args.cycle_id ?? null,
    entity_id: args.entity_id,
    entity_type: args.entity_type,
    event_type: args.event_type,
    id: getActivityId(),
    metadata: stringifyJson(args.metadata ?? {}),
    occurred_at: occurredAt,
    updated_at: occurredAt,
    updated_by: args.actor_id,
  });
};

/**
 * Writes one Task Activity per field change produced by `taskPatchForFields`,
 * so a single `update` that touched several fields shows as several Feed lines
 * (ADR 0005). Each change already carries its own `event_type` and rich
 * before/after `metadata`; they share a single `occurred_at` so they stay
 * grouped and ordered together in the Feed.
 */
const writeTaskActivityChanges = async (
  db: any,
  args: {
    readonly actor_id: string;
    readonly changes: readonly { readonly event_type: string; readonly metadata: unknown }[];
    readonly church_id: string;
    readonly cycle_id: string | null;
    readonly task_id: string;
  },
) => {
  const occurredAt = new Date();
  for (const change of args.changes) {
    await writeActivity(db, {
      actor_id: args.actor_id,
      church_id: args.church_id,
      cycle_id: args.cycle_id,
      entity_id: args.task_id,
      entity_type: "task",
      event_type: change.event_type,
      metadata: change.metadata,
      occurred_at: occurredAt,
    });
  }
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

const remapJsonFieldValues = (
  value: JsonValue,
  remaps: ReadonlyMap<string, ReadonlyMap<string, string>>,
): JsonValue => {
  if (Array.isArray(value)) return value.map((item) => remapJsonFieldValues(item, remaps));
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const replacement = typeof item === "string" ? remaps.get(key)?.get(item) : undefined;
      return [key, replacement ?? remapJsonFieldValues(item, remaps)];
    }),
  );
};

const remapSerializedJsonFieldValues = (
  value: string,
  remaps: ReadonlyMap<string, ReadonlyMap<string, string>>,
) => {
  try {
    return stringifyJson(remapJsonFieldValues(JSON.parse(value) as JsonValue, remaps));
  } catch {
    return value;
  }
};

const requireTemplateManager = (ctx: OptionalZeroSessionContext, church_id: string) =>
  requireTeamManager(ctx, church_id);

const parseIsoInstant = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Instant must be a valid ISO timestamp.");
  return date;
};

const ensureTargetCycle = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  args: {
    readonly church_id: string;
    readonly session_user_id: string;
    readonly target_cycle: TargetCycleInput;
  },
) => {
  const existing = (await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.church_id, args.church_id),
        eq(cycles.start_date, args.target_cycle.start_date),
        isNull(cycles.deleted_at),
      ),
    )) as Array<{ readonly id: string }>;
  if (existing[0]) return existing[0].id;

  const now = new Date();
  const cycleId = getCycleId();
  await db.insert(cycles).values({
    _tag: "cycle",
    church_id: args.church_id,
    church_time_zone: args.target_cycle.church_time_zone,
    created_at: now,
    created_by: args.session_user_id,
    description: null,
    end_date: args.target_cycle.end_date,
    ends_at: parseIsoInstant(args.target_cycle.ends_at),
    id: cycleId,
    name: null,
    start_date: args.target_cycle.start_date,
    starts_at: parseIsoInstant(args.target_cycle.starts_at),
    updated_at: now,
    updated_by: args.session_user_id,
  });
  return cycleId;
};

const requireCurrentCycleId = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  church_id: string,
) => {
  const now = new Date();
  const rows = (await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.church_id, church_id),
        lte(cycles.starts_at, now),
        gte(cycles.ends_at, now),
        isNull(cycles.deleted_at),
      ),
    )) as Array<{ readonly id: string }>;
  const cycle = rows[0];
  if (!cycle) throw new Error("Current Cycle not found.");
  return cycle.id;
};

type TemplateTaskRow = {
  readonly assigned_user_id?: string | null;
  readonly description?: string | null;
  readonly estimate?: string | null;
  readonly priority?: string | null;
  readonly id: string;
  readonly key: string;
  readonly label_ids?: string;
  readonly parent_template_task_id: string | null;
  readonly scheduling_rule: string;
  readonly template_team_id: string;
  readonly title: string;
};

type TemplateTeamRow = { readonly id: string; readonly mapped_team_id: string };
type CycleRow = { readonly id: string; readonly start_date: string };
type FocusWindowRow = {
  readonly anchor_date: string | null;
  readonly end_date: string | null;
  readonly id: string;
  readonly start_date: string;
};
type KeyDateOccurrenceRow = { readonly key_date_id: string; readonly local_date: string };
type CycleAdjustmentRow = {
  readonly lifecycle: "active" | "skipped";
  readonly overrides: string;
  readonly template_task_id: string;
};
type WorkflowRow = { readonly id: string; readonly team_id: string };
type TodoStatusRow = { readonly id: string; readonly workflow_id: string };
type ExistingProjectedTaskRow = {
  readonly id: string;
  readonly source_template_occurrence_key?: string | null;
  readonly source_template_schedule_id?: string | null;
  readonly source_template_task_id: string;
};

const templateTaskSourceKey = (source: {
  readonly source_template_occurrence_key?: string | null;
  readonly source_template_schedule_id?: string | null;
  readonly source_template_task_id: string;
}) =>
  source.source_template_schedule_id && source.source_template_occurrence_key
    ? `${source.source_template_schedule_id}\u0000${source.source_template_occurrence_key}\u0000${source.source_template_task_id}`
    : source.source_template_task_id;

type EffectiveTemplateCycleTask = {
  readonly due_date: string;
  readonly estimate: string | null;
  readonly parent_template_task_id: string | null;
  readonly priority: string | null;
  readonly source_template_task_id: string;
  readonly team_id: string;
  readonly template_task_key: string;
  readonly title: string;
};
export type TemplateCycleTaskProjection = {
  readonly cycle_id: string;
  readonly due_date: string;
  readonly estimate: string | null;
  readonly parent_template_task_id: string | null;
  readonly priority: string | null;
  readonly skipped: false;
  readonly source_template_id: string;
  readonly source_template_task_id: string;
  readonly team_id: string;
  readonly template_task_key: string;
  readonly title: string;
};
type TaskPatch = {
  readonly updated_at: Date;
  readonly updated_by: string;
  cycle_id?: string | null;
  task_state?: string;
  [key: string]: unknown;
};
type ProjectionTaskInsert = {
  readonly _tag: "task";
  readonly board_order: string;
  readonly church_id: string;
  readonly created_at: Date;
  readonly created_by: string;
  readonly created_by_user_id: string;
  readonly cycle_id: string;
  readonly due_date: string;
  readonly estimate: string | null;
  readonly finished_at: null;
  readonly id: string;
  readonly label_ids: string;
  readonly number: number;
  parent_task_id: string | null;
  readonly priority: string | null;
  readonly previous_identifiers: string;
  readonly source_template_cycle_id: string | null;
  readonly source_template_id: string;
  readonly source_template_occurrence_key: string | null;
  readonly source_template_schedule_id: string | null;
  readonly source_template_sync_enabled: boolean;
  readonly source_template_task_id: string;
  readonly task_state: "todo";
  readonly team_id: string;
  readonly title: string;
  readonly updated_at: Date;
  readonly updated_by: string;
  readonly workflow_id: string;
  readonly workflow_status_id: string;
};

const buildEffectiveTemplateCycleTasks = (args: {
  readonly adjustments: readonly CycleAdjustmentRow[];
  readonly cycle: CycleRow;
  readonly focus_windows: readonly FocusWindowRow[];
  readonly key_date_occurrences: readonly KeyDateOccurrenceRow[];
  readonly template_tasks: readonly TemplateTaskRow[];
  readonly template_teams: readonly TemplateTeamRow[];
}): readonly EffectiveTemplateCycleTask[] => {
  const templateTeamById = new Map(args.template_teams.map((team) => [team.id, team]));
  const adjustmentByTemplateTaskId = new Map(
    args.adjustments.map((adjustment) => [adjustment.template_task_id, adjustment]),
  );

  return args.template_tasks.flatMap((templateTask) => {
    const templateTeam = templateTeamById.get(templateTask.template_team_id);
    if (!templateTeam) throw new Error("Template Task does not reference an active Template Team.");

    const dueDate = resolveSchedulingRule(
      parseJson<SchedulingRule>(templateTask.scheduling_rule, {
        kind: "fixedDate",
        localDate: args.cycle.start_date,
      }),
      {
        cycle_start_date: args.cycle.start_date,
        focus_windows: args.focus_windows,
        key_date_occurrences: args.key_date_occurrences,
      },
    );
    const adjustment = adjustmentByTemplateTaskId.get(templateTask.id);
    const merged = mergeTemplateTaskProjection(
      {
        dueDate,
        assignedUserId: templateTask.assigned_user_id ?? null,
        description: templateTask.description ?? null,
        estimate: templateTask.estimate ?? null,
        priority: templateTask.priority ?? null,
        labelIds: parseJson<readonly string[]>(templateTask.label_ids ?? "[]", []),
        parentTemplateTaskId: templateTask.parent_template_task_id,
        teamId: templateTeam.mapped_team_id,
        templateTaskId: templateTask.id,
        templateTaskKey: templateTask.key,
        title: templateTask.title,
      },
      adjustment
        ? {
            lifecycle: adjustment.lifecycle,
            overrides: parseJson<readonly CycleAdjustmentOverride[]>(adjustment.overrides, []),
          }
        : null,
    );

    if (merged.skipped || !merged.effectiveTask) return [];
    return [
      {
        due_date: merged.effectiveTask.dueDate,
        estimate: merged.effectiveTask.estimate,
        parent_template_task_id: merged.effectiveTask.parentTemplateTaskId,
        priority: merged.effectiveTask.priority,
        source_template_task_id: templateTask.id,
        team_id: templateTeam.mapped_team_id,
        template_task_key: merged.effectiveTask.templateTaskKey,
        title: merged.effectiveTask.title,
      },
    ];
  });
};

export const buildTemplateCycleTaskInserts = (args: {
  readonly adjustments: readonly CycleAdjustmentRow[];
  readonly church_id: string;
  readonly cycle: CycleRow;
  readonly existing_projected_tasks?: readonly ExistingProjectedTaskRow[];
  readonly focus_windows: readonly FocusWindowRow[];
  readonly key_date_occurrences: readonly KeyDateOccurrenceRow[];
  readonly now: Date;
  readonly session_user_id: string;
  readonly start_number_by_team_id: ReadonlyMap<string, number>;
  readonly source_template_occurrence_key?: string | null;
  readonly source_template_schedule_id?: string | null;
  readonly template_id: string;
  readonly template_tasks: readonly TemplateTaskRow[];
  readonly template_teams: readonly TemplateTeamRow[];
  readonly todo_status_by_workflow_id: ReadonlyMap<string, TodoStatusRow>;
  readonly workflow_by_team_id: ReadonlyMap<string, WorkflowRow>;
}) => {
  const nextNumberByTeamId = new Map(args.start_number_by_team_id);
  const insertedTasksBySourceKey = new Map<string, string>();
  const pendingParentLinks: Array<{
    readonly parentTemplateTaskId: string;
    readonly taskId: string;
  }> = [];
  const inserts: ProjectionTaskInsert[] = [];
  const sourceTemplateScheduleId = args.source_template_schedule_id ?? null;
  const sourceTemplateOccurrenceKey = args.source_template_occurrence_key ?? null;
  const sourceKeyForTemplateTask = (templateTaskId: string) =>
    templateTaskSourceKey({
      source_template_occurrence_key: sourceTemplateOccurrenceKey,
      source_template_schedule_id: sourceTemplateScheduleId,
      source_template_task_id: templateTaskId,
    });

  for (const existingTask of args.existing_projected_tasks ?? []) {
    insertedTasksBySourceKey.set(templateTaskSourceKey(existingTask), existingTask.id);
  }

  for (const effectiveTask of buildEffectiveTemplateCycleTasks(args)) {
    const sourceKey = sourceKeyForTemplateTask(effectiveTask.source_template_task_id);
    if (insertedTasksBySourceKey.has(sourceKey)) continue;

    const workflow = args.workflow_by_team_id.get(effectiveTask.team_id);
    if (!workflow) throw new Error("Template Team mapped Team does not have an active Workflow.");
    const todoStatus = args.todo_status_by_workflow_id.get(workflow.id);
    if (!todoStatus) throw new Error("Mapped Team Workflow does not have a To Do status.");
    const number = nextNumberByTeamId.get(effectiveTask.team_id) ?? 1;
    nextNumberByTeamId.set(effectiveTask.team_id, number + 1);
    const taskId = getTaskId();
    insertedTasksBySourceKey.set(sourceKey, taskId);
    if (effectiveTask.parent_template_task_id) {
      pendingParentLinks.push({
        parentTemplateTaskId: effectiveTask.parent_template_task_id,
        taskId,
      });
    }

    inserts.push({
      _tag: "task",
      board_order: appendBoardOrderKey(null),
      church_id: args.church_id,
      created_at: args.now,
      created_by: args.session_user_id,
      created_by_user_id: args.session_user_id,
      cycle_id: args.cycle.id,
      due_date: effectiveTask.due_date,
      estimate: effectiveTask.estimate,
      finished_at: null,
      id: taskId,
      label_ids: "[]",
      number,
      parent_task_id: null,
      priority: effectiveTask.priority,
      previous_identifiers: "[]",
      source_template_cycle_id: args.cycle.id,
      source_template_id: args.template_id,
      source_template_occurrence_key: sourceTemplateOccurrenceKey,
      source_template_schedule_id: sourceTemplateScheduleId,
      source_template_sync_enabled: false,
      source_template_task_id: effectiveTask.source_template_task_id,
      task_state: "todo",
      team_id: effectiveTask.team_id,
      title: effectiveTask.title,
      updated_at: args.now,
      updated_by: args.session_user_id,
      workflow_id: workflow.id,
      workflow_status_id: todoStatus.id,
    });
  }

  for (const link of pendingParentLinks) {
    const parentTaskId =
      insertedTasksBySourceKey.get(sourceKeyForTemplateTask(link.parentTemplateTaskId)) ?? null;
    const child = inserts.find((insert) => insert.id === link.taskId);
    if (child) child.parent_task_id = parentTaskId;
  }

  return { inserts, nextNumberByTeamId };
};

export const buildTemplateCycleTaskProjections = (args: {
  readonly adjustments: readonly CycleAdjustmentRow[];
  readonly cycle: CycleRow;
  readonly focus_windows: readonly FocusWindowRow[];
  readonly key_date_occurrences: readonly KeyDateOccurrenceRow[];
  readonly template_id: string;
  readonly template_tasks: readonly TemplateTaskRow[];
  readonly template_teams: readonly TemplateTeamRow[];
}): readonly TemplateCycleTaskProjection[] => {
  return buildEffectiveTemplateCycleTasks(args).map((effectiveTask) => ({
    cycle_id: args.cycle.id,
    due_date: effectiveTask.due_date,
    estimate: effectiveTask.estimate,
    parent_template_task_id: effectiveTask.parent_template_task_id,
    priority: effectiveTask.priority,
    skipped: false as const,
    source_template_id: args.template_id,
    source_template_task_id: effectiveTask.source_template_task_id,
    team_id: effectiveTask.team_id,
    template_task_key: effectiveTask.template_task_key,
    title: effectiveTask.title,
  }));
};

/**
 * One Feed-facing Activity emitted by a Task field change. Each carries an
 * `event_type` and structured before/after `metadata` rich enough to render
 * the line on its own (ADR 0005). Value fields store `{ value, label }`;
 * record references store `{ id, label }` with the name snapshotted at change
 * time so old lines stay truthful after renames/deletes.
 */
type TaskActivityChange = {
  readonly event_type: string;
  readonly metadata: Record<string, unknown>;
};

/** A plain (non-record) before/after value, e.g. title, priority, due date. */
const valueRef = (value: string | null) =>
  value === null ? null : ({ label: value, value } as const);

/**
 * A User reference (assignee) for Activity metadata. Unlike Workflow Statuses,
 * Teams, and Labels, we do not snapshot the User's name here: the `user` table
 * is Better Auth-owned and not a safe read target from inside a Zero mutator
 * transaction, and Users are rarely deleted. The Feed resolves the display name
 * live from the loaded church members, falling back to "Unknown user".
 */
const userRef = (userId: string | null) =>
  userId === null ? null : ({ id: userId, label: null } as const);

/**
 * Loads the Task plus the extra current-value fields needed to compute Activity
 * before/after metadata (title, assignee, due date, estimate, priority, current
 * Workflow Status name, and Team name), on top of everything
 * `getTaskWithTeamIdentifier` returns.
 */
const getTaskWithActivityFields = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  task_id: string,
  church_id: string,
) => {
  const base = await getTaskWithTeamIdentifier(db, task_id, church_id);
  if (!base) return null;

  const rows = (await db
    .select({
      assigned_user_id: tasks.assigned_user_id,
      due_date: tasks.due_date,
      estimate: tasks.estimate,
      priority: tasks.priority,
      team_name: teams.name,
      title: tasks.title,
      workflow_status_name: workflow_statuses.name,
    })
    .from(tasks)
    .leftJoin(teams, eq(tasks.team_id, teams.id))
    .leftJoin(workflow_statuses, eq(tasks.workflow_status_id, workflow_statuses.id))
    .where(and(eq(tasks.id, task_id), eq(tasks.church_id, church_id)))
    .limit(1)) as Array<{
    readonly assigned_user_id: string | null;
    readonly due_date: string | null;
    readonly estimate: string | null;
    readonly priority: string | null;
    readonly team_name: string | null;
    readonly title: string;
    readonly workflow_status_name: string | null;
  }>;
  const extra = rows[0];

  return {
    ...base,
    assigned_user_id: extra?.assigned_user_id ?? null,
    due_date: extra?.due_date ?? null,
    estimate: extra?.estimate ?? null,
    priority: extra?.priority ?? null,
    team_name: extra?.team_name ?? null,
    title: extra?.title ?? "",
    workflow_status_name: extra?.workflow_status_name ?? null,
  };
};

const taskPatchForFields = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  args: {
    readonly church_id: string;
    readonly fields: typeof TaskFieldsArg.Type;
    readonly session_user_id: string;
    readonly task_id: string;
  },
): Promise<{ readonly patch: TaskPatch; readonly changes: readonly TaskActivityChange[] }> => {
  const task = await getTaskWithActivityFields(db, args.task_id, args.church_id);
  if (!task) throw new Error("Task not found.");

  const now = new Date();
  const patch: TaskPatch = { updated_at: now, updated_by: args.session_user_id };
  const changes: TaskActivityChange[] = [];

  if (args.fields.title !== undefined) {
    const nextTitle = args.fields.title.trim();
    patch.title = nextTitle;
    if (nextTitle !== task.title) {
      changes.push({
        event_type: "task.title_changed",
        metadata: { from: valueRef(task.title), to: valueRef(nextTitle) },
      });
    }
  }
  if (args.fields.assigned_user_id !== undefined) {
    patch.assigned_user_id = args.fields.assigned_user_id;
    if (args.fields.assigned_user_id !== task.assigned_user_id) {
      changes.push({
        event_type: "task.assignee_changed",
        metadata: {
          from: userRef(task.assigned_user_id),
          to: userRef(args.fields.assigned_user_id),
        },
      });
    }
  }
  if (args.fields.due_date !== undefined) {
    patch.due_date = args.fields.due_date;
    if (args.fields.due_date !== task.due_date) {
      changes.push({
        event_type: "task.due_date_changed",
        metadata: { from: valueRef(task.due_date), to: valueRef(args.fields.due_date) },
      });
    }
  }
  if (args.fields.parent_task_id !== undefined) patch.parent_task_id = args.fields.parent_task_id;
  if (args.fields.board_order !== undefined) patch.board_order = args.fields.board_order;
  if (args.fields.estimate !== undefined) {
    patch.estimate = args.fields.estimate;
    if (args.fields.estimate !== task.estimate) {
      changes.push({
        event_type: "task.estimate_changed",
        metadata: { from: valueRef(task.estimate), to: valueRef(args.fields.estimate) },
      });
    }
  }
  if (args.fields.priority !== undefined) {
    patch.priority = args.fields.priority;
    if (args.fields.priority !== task.priority) {
      changes.push({
        event_type: "task.priority_changed",
        metadata: { from: valueRef(task.priority), to: valueRef(args.fields.priority) },
      });
    }
  }
  if (args.fields.cycle_id !== undefined) patch.cycle_id = args.fields.cycle_id;
  if (args.fields.target_cycle !== undefined) {
    patch.cycle_id = await ensureTargetCycle(db, {
      church_id: args.church_id,
      session_user_id: args.session_user_id,
      target_cycle: args.fields.target_cycle,
    });
  }
  if (patch.cycle_id !== undefined && patch.cycle_id !== task.cycle_id) {
    changes.push({
      event_type: "task.cycle_changed",
      metadata: {
        from: task.cycle_id === null ? null : { id: task.cycle_id, label: null },
        to: patch.cycle_id === null ? null : { id: patch.cycle_id, label: null },
      },
    });
  }

  if (args.fields.workflow_status_id !== undefined) {
    const statusRows = (await db
      .select({
        id: workflow_statuses.id,
        name: workflow_statuses.name,
        task_state: workflow_statuses.task_state,
        workflow_id: workflow_statuses.workflow_id,
      })
      .from(workflow_statuses)
      .where(
        and(
          eq(workflow_statuses.id, args.fields.workflow_status_id),
          eq(workflow_statuses.church_id, args.church_id),
          isNull(workflow_statuses.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly name: string;
      readonly task_state: string;
      readonly workflow_id: string;
    }>;
    const status = statusRows[0];
    if (!status) throw new Error("Workflow Status not found.");
    if (status.workflow_id !== task.workflow_id)
      throw new Error("Workflow Status is not in this Task's Workflow.");
    if (status.id !== task.workflow_status_id) {
      changes.push({
        event_type: "task.status_changed",
        metadata: {
          from: { id: task.workflow_status_id, label: task.workflow_status_name },
          to: { id: status.id, label: status.name },
        },
      });
    }
    patch.workflow_status_id = status.id;
    patch.task_state = status.task_state;
    patch.finished_at =
      status.task_state === "done" ? now : task.task_state === "done" ? null : task.finished_at;
  }

  const effectiveTaskState = patch.task_state ?? task.task_state;
  const effectiveCycleId = Object.hasOwn(patch, "cycle_id") ? patch.cycle_id : task.cycle_id;
  if (effectiveTaskState !== "todo" && effectiveCycleId === null) {
    patch.cycle_id = await requireCurrentCycleId(db, args.church_id);
  }

  if (args.fields.team_id !== undefined && args.fields.team_id !== task.team_id) {
    const teamRows = (await db
      .select({
        id: teams.id,
        identifier: teams.identifier,
        name: teams.name,
        next_task_number: teams.next_task_number,
      })
      .from(teams)
      .where(
        and(
          eq(teams.id, args.fields.team_id),
          eq(teams.church_id, args.church_id),
          isNull(teams.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly identifier: string;
      readonly name: string;
      readonly next_task_number: number;
    }>;
    const team = teamRows[0];
    if (!team) throw new Error("Team not found.");
    changes.push({
      event_type: "task.team_changed",
      metadata: {
        from: { id: task.team_id, label: task.team_name },
        to: { id: team.id, label: team.name },
      },
    });
    const workflowRows = (await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.team_id, team.id),
          eq(workflows.church_id, args.church_id),
          isNull(workflows.deleted_at),
        ),
      )) as Array<{ readonly id: string }>;
    const workflow = workflowRows[0];
    if (!workflow) throw new Error("Team Workflow not found.");
    const statusRows = (await db
      .select({ id: workflow_statuses.id, task_state: workflow_statuses.task_state })
      .from(workflow_statuses)
      .where(
        and(
          eq(workflow_statuses.workflow_id, workflow.id),
          eq(workflow_statuses.task_state, task.task_state),
          isNull(workflow_statuses.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly task_state: string;
    }>;
    const status = statusRows[0];
    if (!status) throw new Error("Workflow Status remap failed.");

    const previousIdentifier = formatTaskIdentifier(task.team_identifier ?? "TEAM", task.number);
    patch.team_id = team.id;
    patch.workflow_id = workflow.id;
    patch.workflow_status_id = status.id;
    patch.number = team.next_task_number;
    patch.previous_identifiers = serializeStringArray([
      ...parsePreviousIdentifiers(task.previous_identifiers),
      previousIdentifier,
    ]);
    await db
      .update(teams)
      .set({
        next_task_number: team.next_task_number + 1,
        updated_at: now,
        updated_by: args.session_user_id,
      })
      .where(eq(teams.id, team.id));
  }

  const effectiveTeamId = (patch.team_id as string | undefined) ?? task.team_id;
  if (args.fields.label_ids !== undefined) {
    const churchLabels = await getChurchLabels(db, args.church_id);
    validateTaskLabelIds(churchLabels, {
      label_ids: args.fields.label_ids,
      team_id: effectiveTeamId,
    });
    patch.label_ids = serializeStringArray(args.fields.label_ids);

    const labelNameById = new Map(churchLabels.map((label) => [label.id, label.name]));
    const previousLabelIds = new Set(parseSerializedStringArray(task.label_ids));
    const nextLabelIds = new Set(args.fields.label_ids);
    const added = [...nextLabelIds].filter((id) => !previousLabelIds.has(id));
    const removed = [...previousLabelIds].filter((id) => !nextLabelIds.has(id));
    if (added.length > 0 || removed.length > 0) {
      changes.push({
        event_type: "task.labels_changed",
        metadata: {
          added: added.map((id) => ({ id, label: labelNameById.get(id) ?? null })),
          removed: removed.map((id) => ({ id, label: labelNameById.get(id) ?? null })),
        },
      });
    }
  } else if (patch.team_id !== undefined) {
    const churchLabels = await getChurchLabels(db, args.church_id);
    patch.label_ids = serializeStringArray(
      stripForeignTeamLabelIds(churchLabels, {
        label_ids: parseSerializedStringArray(task.label_ids),
        team_id: effectiveTeamId,
      }),
    );
  }

  return { changes, patch };
};

export const mutators = defineMutators({
  demo_items: {
    create: defineChurchTaskMutator(CreateDemoItemArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("demo_items.create must run on the server");
      }

      const session = requireSignedInSession(ctx);
      const now = new Date();

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { insert: (table: typeof demo_items) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction.insert(demo_items).values({
        _tag: "demo_item",
        created_at: now,
        created_by: session.user_id,
        id: getDemoItemId(),
        name: args.name,
        owner_user_id: session.user_id,
        updated_at: now,
        updated_by: session.user_id,
      });
    }),
  },
  teams: {
    create: defineChurchTaskMutator(CreateTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const now = new Date();
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly insert: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingTeams = await db
        .select({ identifier: teams.identifier, sort_order: teams.sort_order })
        .from(teams)
        .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)));
      const identifier = generateTeamIdentifier(
        args.name,
        existingTeams.map((team: { readonly identifier: string }) => team.identifier),
      );
      const teamId = getTeamId();
      const workflowId = getWorkflowId();

      await db.insert(teams).values({
        _tag: "team",
        church_id: args.church_id,
        color: getTeamColorForName(args.name),
        created_at: now,
        created_by: session.user_id,
        id: teamId,
        identifier,
        name: args.name,
        previous_identifiers: "[]",
        sort_order:
          existingTeams.reduce(
            (max: number, team: { readonly sort_order: number }) => Math.max(max, team.sort_order),
            -1,
          ) + 1,
        updated_at: now,
        updated_by: session.user_id,
      });

      await db.insert(team_memberships).values({
        _tag: "teammembership",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: getTeamMembershipId(),
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
        user_id: session.user_id,
      });

      await db.insert(workflows).values({
        _tag: "workflow",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: workflowId,
        name: `${args.name} Workflow`,
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
      });

      await db.insert(workflow_statuses).values(
        DEFAULT_WORKFLOW_STATUSES.map((status) => ({
          _tag: "workflowstatus",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          id: getWorkflowStatusId(),
          key: status.key,
          name: status.name,
          sort_order: status.sort_order,
          task_state: status.task_state,
          updated_at: now,
          updated_by: session.user_id,
          workflow_id: workflowId,
        })),
      );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: teamId,
        entity_type: "team",
        event_type: "team.created",
        metadata: { name: args.name },
        occurred_at: now,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: workflowId,
        entity_type: "workflow",
        event_type: "workflow.created",
        metadata: { name: `${args.name} Workflow`, team_id: teamId },
        occurred_at: now,
      });
    }),
    rename: defineChurchTaskMutator(RenameTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Team name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(teams)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        );

      await writeActivity(serverTx.dbTransaction.wrappedTransaction, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.team_id,
        entity_type: "team",
        event_type: "team.renamed",
        metadata: { name },
      });
    }),
    set_identifier: defineChurchTaskMutator(SetTeamIdentifierArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const identifier = normalizeTeamIdentifier(args.identifier);
      if (!isValidTeamIdentifier(identifier)) {
        throw new Error(
          `Team Identifier must be 1-${TEAM_IDENTIFIER_MAX_LENGTH} letters or numbers.`,
        );
      }

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingTeams = (await db
        .select({
          id: teams.id,
          identifier: teams.identifier,
          previous_identifiers: teams.previous_identifiers,
        })
        .from(teams)
        .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)))) as Array<{
        readonly id: string;
        readonly identifier: string;
        readonly previous_identifiers: string;
      }>;
      const team = existingTeams.find((candidate) => candidate.id === args.team_id);

      if (!team) throw new Error("Team was not found in the active Church.");
      if (
        existingTeams.some(
          (candidate) =>
            candidate.id !== args.team_id &&
            normalizeTeamIdentifier(candidate.identifier) === identifier,
        )
      ) {
        throw new Error("Another Team in this Church already uses that identifier.");
      }

      const previousIdentifier = normalizeTeamIdentifier(team.identifier);
      if (identifier === previousIdentifier) return;

      const previousIdentifiers = [
        ...parsePreviousIdentifiers(team.previous_identifiers).filter(
          (value) => value !== identifier,
        ),
        previousIdentifier,
      ];

      await db
        .update(teams)
        .set({
          identifier,
          previous_identifiers: JSON.stringify(previousIdentifiers),
          updated_at: new Date(),
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.team_id,
        entity_type: "team",
        event_type: "team.identifier_changed",
        metadata: { identifier, previous_identifier: previousIdentifier },
      });
    }),
    delete: defineChurchTaskMutator(DeleteTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const now = new Date();
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly delete: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingWorkflows = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.church_id, args.church_id),
            eq(workflows.team_id, args.team_id),
            isNull(workflows.deleted_at),
          ),
        );
      const workflowIds = existingWorkflows.map((workflow: { readonly id: string }) => workflow.id);

      await db
        .update(teams)
        .set({
          deleted_at: now,
          deleted_by: session.user_id,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(and(eq(teams.id, args.team_id), eq(teams.church_id, args.church_id)));

      await db
        .update(workflows)
        .set({
          deleted_at: now,
          deleted_by: session.user_id,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(and(eq(workflows.team_id, args.team_id), eq(workflows.church_id, args.church_id)));

      if (workflowIds.length > 0) {
        await db
          .update(workflow_statuses)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(workflow_statuses.church_id, args.church_id),
              inArray(workflow_statuses.workflow_id, workflowIds),
            ),
          );
      }

      await db
        .delete(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.team_id,
        entity_type: "team",
        event_type: "team.deleted",
      });
    }),
    reorder: defineChurchTaskMutator(ReorderTeamsArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };
      const now = new Date();

      await Promise.all(
        args.team_ids.map((team_id, sort_order) =>
          serverTx.dbTransaction.wrappedTransaction
            .update(teams)
            .set({ sort_order, updated_at: now, updated_by: session.user_id })
            .where(
              and(
                eq(teams.id, team_id),
                eq(teams.church_id, args.church_id),
                isNull(teams.deleted_at),
              ),
            ),
        ),
      );

      await Promise.all(
        args.team_ids.map((team_id, sort_order) =>
          writeActivity(serverTx.dbTransaction.wrappedTransaction, {
            actor_id: session.user_id,
            church_id: args.church_id,
            entity_id: team_id,
            entity_type: "team",
            event_type: "team.reordered",
            metadata: { sort_order },
          }),
        ),
      );
    }),
    add_member: defineChurchTaskMutator(TeamMemberArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly insert: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existing = await db
        .select({ id: team_memberships.id })
        .from(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
            eq(team_memberships.user_id, args.user_id),
          ),
        );

      if (existing.length > 0) return;

      const now = new Date();
      await db.insert(team_memberships).values({
        _tag: "teammembership",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: getTeamMembershipId(),
        team_id: args.team_id,
        updated_at: now,
        updated_by: session.user_id,
        user_id: args.user_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.team_id,
        entity_type: "team",
        event_type: "team.member.added",
        metadata: { member_user_id: args.user_id },
      });
    }),
    remove_member: defineChurchTaskMutator(TeamMemberArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly delete: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .delete(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
            eq(team_memberships.user_id, args.user_id),
          ),
        );

      await writeActivity(serverTx.dbTransaction.wrappedTransaction, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.team_id,
        entity_type: "team",
        event_type: "team.member.removed",
        metadata: { member_user_id: args.user_id },
      });
    }),
  },
  labels: {
    create: defineChurchTaskMutator(CreateLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Label name is required.");

      const teamId = args.team_id ?? null;
      if (teamId !== null) {
        const teamRows = (await db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.id, teamId),
              eq(teams.church_id, args.church_id),
              isNull(teams.deleted_at),
            ),
          )) as Array<{ readonly id: string }>;
        if (teamRows.length === 0) throw new Error("Team was not found in the active Church.");
      }

      const existingLabels = await getChurchLabels(db, args.church_id);
      ensureUniqueLabelName(existingLabels, { name, team_id: teamId });
      const now = new Date();
      const labelId = args.label_id ?? getLabelId();

      await db.insert(labels).values({
        _tag: "label",
        church_id: args.church_id,
        color: args.color ?? getLabelColorForName(name),
        created_at: now,
        created_by: session.user_id,
        id: labelId,
        name,
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: labelId,
        entity_type: "label",
        event_type: "label.created",
        metadata: { name, team_id: teamId },
        occurred_at: now,
      });
    }),
    update: defineChurchTaskMutator(UpdateLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTeamManager(ctx, args.church_id);
      const existingLabels = await getChurchLabels(db, args.church_id);
      const label = existingLabels.find((candidate) => candidate.id === args.label_id);
      if (!label) throw new Error("Label not found.");

      const patch: Record<string, unknown> = {
        updated_at: new Date(),
        updated_by: session.user_id,
      };

      if (args.name !== undefined) {
        const name = args.name.trim();
        if (!name) throw new Error("Label name is required.");
        ensureUniqueLabelName(existingLabels, {
          exclude_id: args.label_id,
          name,
          team_id: label.team_id,
        });
        patch.name = name;
      }

      if (args.color !== undefined) patch.color = args.color;

      await db
        .update(labels)
        .set(patch)
        .where(and(eq(labels.id, args.label_id), eq(labels.church_id, args.church_id)));

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.label_id,
        entity_type: "label",
        event_type: "label.updated",
        metadata: { updated_fields: Object.keys(patch).filter((key) => !key.endsWith("_at")) },
      });
    }),
    delete: defineChurchTaskMutator(DeleteLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTeamManager(ctx, args.church_id);
      const existingLabels = await getChurchLabels(db, args.church_id);
      if (!existingLabels.some((label) => label.id === args.label_id)) {
        throw new Error("Label not found.");
      }

      const taskRows = (await db
        .select({ id: tasks.id, label_ids: tasks.label_ids })
        .from(tasks)
        .where(and(eq(tasks.church_id, args.church_id), isNull(tasks.deleted_at)))) as Array<{
        readonly id: string;
        readonly label_ids: string;
      }>;

      for (const task of taskRows) {
        const currentLabelIds = parseSerializedStringArray(task.label_ids);
        const nextLabelIds = currentLabelIds.filter((label_id) => label_id !== args.label_id);
        if (nextLabelIds.length === currentLabelIds.length) continue;

        await db
          .update(tasks)
          .set({ label_ids: serializeStringArray(nextLabelIds) })
          .where(eq(tasks.id, task.id));
      }

      await db
        .delete(labels)
        .where(and(eq(labels.id, args.label_id), eq(labels.church_id, args.church_id)));

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.label_id,
        entity_type: "label",
        event_type: "label.deleted",
      });
    }),
  },
  cycles: {
    upsert: defineChurchTaskMutator(UpsertCycleArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const now = new Date();
      const existing = (await db
        .select({ id: cycles.id })
        .from(cycles)
        .where(
          and(
            eq(cycles.church_id, args.church_id),
            eq(cycles.start_date, args.start_date),
            isNull(cycles.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;

      if (existing[0]) {
        await db
          .update(cycles)
          .set({
            church_time_zone: args.church_time_zone,
            end_date: args.end_date,
            ends_at: parseIsoInstant(args.ends_at),
            ...(args.description === undefined ? {} : { description: args.description }),
            ...(args.name === undefined ? {} : { name: args.name }),
            start_date: args.start_date,
            starts_at: parseIsoInstant(args.starts_at),
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(eq(cycles.id, existing[0].id));
        return;
      }

      const cycleId = getCycleId();
      await db.insert(cycles).values({
        _tag: "cycle",
        church_id: args.church_id,
        church_time_zone: args.church_time_zone,
        description: args.description ?? null,
        created_at: now,
        created_by: session.user_id,
        end_date: args.end_date,
        ends_at: parseIsoInstant(args.ends_at),
        id: cycleId,
        name: args.name ?? null,
        start_date: args.start_date,
        starts_at: parseIsoInstant(args.starts_at),
        updated_at: now,
        updated_by: session.user_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: cycleId,
        entity_type: "cycle",
        event_type: "cycle.created",
        metadata: {
          church_time_zone: args.church_time_zone,
          end_date: args.end_date,
          start_date: args.start_date,
        },
        occurred_at: now,
      });
    }),
    updateDetails: defineChurchTaskMutator(UpdateCycleDetailsArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const now = new Date();
      await db
        .update(cycles)
        .set({
          description: args.description,
          name: args.name,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(cycles.id, args.cycle_id),
            eq(cycles.church_id, args.church_id),
            isNull(cycles.deleted_at),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.cycle_id,
        entity_type: "cycle",
        event_type: "cycle.updated",
        metadata: { description: args.description, name: args.name },
        occurred_at: now,
      });
    }),
  },
  key_dates: {
    create: defineChurchTaskMutator(CreateKeyDateArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      const keyDateId = getKeyDateId();
      await db.insert(key_dates).values({
        _tag: "keydate",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: keyDateId,
        key: args.key,
        name: args.name,
        schedule: stringifyJson(args.schedule),
        updated_at: now,
        updated_by: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: keyDateId,
        entity_type: "key_date",
        event_type: "key_date.created",
        metadata: { key: args.key, name: args.name, schedule: args.schedule },
        occurred_at: now,
      });
    }),
    update: defineChurchTaskMutator(UpdateKeyDateArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await db
        .update(key_dates)
        .set({
          key: args.key,
          name: args.name,
          schedule: stringifyJson(args.schedule),
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(key_dates.id, args.key_date_id),
            eq(key_dates.church_id, args.church_id),
            isNull(key_dates.deleted_at),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.key_date_id,
        entity_type: "key_date",
        event_type: "key_date.updated",
        metadata: { key: args.key, name: args.name, schedule: args.schedule },
        occurred_at: now,
      });
    }),
    delete: defineChurchTaskMutator(DeleteKeyDateArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await db
        .update(key_dates)
        .set({ deleted_at: now, updated_at: now, updated_by: session.user_id })
        .where(
          and(
            eq(key_dates.id, args.key_date_id),
            eq(key_dates.church_id, args.church_id),
            isNull(key_dates.deleted_at),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.key_date_id,
        entity_type: "key_date",
        event_type: "key_date.deleted",
        metadata: {},
        occurred_at: now,
      });
    }),
    create_occurrence: defineChurchTaskMutator(
      CreateKeyDateOccurrenceArgs,
      async ({ args, ctx, tx }) => {
        const db = serverDb(tx);
        if (!db) return;

        const session = requireTemplateManager(ctx, args.church_id);
        const now = new Date();
        await db.insert(key_date_occurrences).values({
          _tag: "keydateoccurrence",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          id: getKeyDateOccurrenceId(),
          key_date_id: args.key_date_id,
          label: args.label,
          local_date: args.local_date,
          updated_at: now,
          updated_by: session.user_id,
        });
      },
    ),
  },
  templates: {
    create: defineChurchTaskMutator(CreateTemplateArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      const templateId = getTemplateId();
      const templateTeamIdByKey = new Map<string, string>();
      const templateTaskIdByKey = new Map<string, string>();

      for (const templateTeam of args.template_teams) {
        templateTeamIdByKey.set(templateTeam.key, getTemplateTeamId());
      }
      for (const templateTask of args.template_tasks) {
        templateTaskIdByKey.set(templateTask.key, getTemplateTaskId());
      }

      await db.insert(templates).values({
        _tag: "template",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: templateId,
        key: args.key,
        name: args.name,
        placement_shape: args.placement_shape,
        recurrence: args.recurrence,
        updated_at: now,
        updated_by: session.user_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: templateId,
        entity_type: "template",
        event_type: "template.created",
        metadata: { key: args.key, name: args.name, recurrence: args.recurrence },
        occurred_at: now,
      });

      await db.insert(template_teams).values(
        args.template_teams.map((templateTeam) => ({
          _tag: "templateteam",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          id: templateTeamIdByKey.get(templateTeam.key)!,
          key: templateTeam.key,
          mapped_team_id: templateTeam.mapped_team_id,
          name: templateTeam.name,
          template_id: templateId,
          updated_at: now,
          updated_by: session.user_id,
        })),
      );

      if (args.focus_windows.length > 0) {
        await db.insert(focus_windows).values(
          args.focus_windows.map((focusWindow) => ({
            _tag: "focuswindow",
            anchor_date: focusWindow.anchor_date,
            church_id: args.church_id,
            created_at: now,
            created_by: session.user_id,
            end_date: focusWindow.end_date,
            id: getFocusWindowId(),
            key: focusWindow.key,
            key_date_id: focusWindow.key_date_id,
            name: focusWindow.name,
            start_date: focusWindow.start_date,
            template_id: templateId,
            type: focusWindow.type,
            updated_at: now,
            updated_by: session.user_id,
          })),
        );
      }

      if (args.template_schedule) {
        const templateScheduleId = getTemplateScheduleId();
        await db.insert(template_schedules).values({
          _tag: "templateschedule",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          end_date: args.template_schedule.end_date,
          id: templateScheduleId,
          key: args.template_schedule.key,
          kind: args.template_schedule.kind,
          name: args.template_schedule.name,
          recurrence: args.template_schedule.recurrence,
          rule: stringifyJson(args.template_schedule.rule),
          start_date: args.template_schedule.start_date,
          template_id: templateId,
          updated_at: now,
          updated_by: session.user_id,
        });
        await writeActivity(db, {
          actor_id: session.user_id,
          church_id: args.church_id,
          entity_id: templateScheduleId,
          entity_type: "template_schedule",
          event_type: "template_schedule.created",
          metadata: { kind: args.template_schedule.kind, template_id: templateId },
          occurred_at: now,
        });
      }

      const templateTaskInserts = args.template_tasks.map((templateTask) => {
        const templateTeamKey = templateTask.template_team_key ?? args.template_teams[0]?.key;
        const templateTeamId = templateTeamKey
          ? templateTeamIdByKey.get(templateTeamKey)
          : undefined;
        if (!templateTeamId) throw new Error("Template Task must reference a Template Team.");
        return {
          _tag: "templatetask",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          assigned_user_id: templateTask.assigned_user_id,
          id: templateTaskIdByKey.get(templateTask.key)!,
          key: templateTask.key,
          description: templateTask.description,
          estimate: templateTask.estimate,
          priority: templateTask.priority,
          label_ids: stringifyJson(templateTask.label_ids),
          parent_template_task_id: templateTask.parent_template_task_key
            ? (templateTaskIdByKey.get(templateTask.parent_template_task_key) ?? null)
            : null,
          placement_cycle_offset: templateTask.placement_cycle_offset,
          placement_weekday: templateTask.placement_weekday,
          scheduling_rule: stringifyJson(templateTask.scheduling_rule),
          template_id: templateId,
          template_team_id: templateTeamId,
          title: templateTask.title,
          updated_at: now,
          updated_by: session.user_id,
        };
      });
      await db.insert(template_tasks).values(templateTaskInserts);
      await Promise.all(
        templateTaskInserts.map((templateTask) =>
          writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            entity_id: templateTask.id,
            entity_type: "template_task",
            event_type: "template_task.created",
            metadata: { template_id: templateId, title: templateTask.title },
            occurred_at: now,
          }),
        ),
      );
    }),
    duplicate: defineChurchTaskMutator(DuplicateTemplateArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      const [source] = (await db
        .select({
          key: templates.key,
          name: templates.name,
          placement_shape: templates.placement_shape,
          recurrence: templates.recurrence,
        })
        .from(templates)
        .where(
          and(
            eq(templates.id, args.template_id),
            eq(templates.church_id, args.church_id),
            isNull(templates.deleted_at),
          ),
        )) as Array<{
        readonly key: string;
        readonly name: string;
        readonly placement_shape: string | null;
        readonly recurrence: string;
      }>;
      if (!source) throw new Error("Template not found.");

      const sourceTeams = (await db
        .select({
          key: template_teams.key,
          mapped_team_id: template_teams.mapped_team_id,
          name: template_teams.name,
          source_id: template_teams.id,
        })
        .from(template_teams)
        .where(
          and(
            eq(template_teams.template_id, args.template_id),
            eq(template_teams.church_id, args.church_id),
            isNull(template_teams.deleted_at),
          ),
        )) as Array<{
        readonly key: string;
        readonly mapped_team_id: string;
        readonly name: string;
        readonly source_id: string;
      }>;
      const sourceTasks = (await db
        .select({
          assigned_user_id: template_tasks.assigned_user_id,
          description: template_tasks.description,
          estimate: template_tasks.estimate,
          priority: template_tasks.priority,
          key: template_tasks.key,
          label_ids: template_tasks.label_ids,
          parent_template_task_id: template_tasks.parent_template_task_id,
          placement_cycle_offset: template_tasks.placement_cycle_offset,
          placement_weekday: template_tasks.placement_weekday,
          scheduling_rule: template_tasks.scheduling_rule,
          source_id: template_tasks.id,
          template_team_id: template_tasks.template_team_id,
          title: template_tasks.title,
        })
        .from(template_tasks)
        .where(
          and(
            eq(template_tasks.template_id, args.template_id),
            eq(template_tasks.church_id, args.church_id),
            isNull(template_tasks.deleted_at),
          ),
        )) as Array<{
        readonly assigned_user_id: string | null;
        readonly description: string | null;
        readonly estimate: string | null;
        readonly priority: string | null;
        readonly key: string;
        readonly label_ids: string;
        readonly parent_template_task_id: string | null;
        readonly placement_cycle_offset: number | null;
        readonly placement_weekday: number | null;
        readonly scheduling_rule: string;
        readonly source_id: string;
        readonly template_team_id: string;
        readonly title: string;
      }>;
      const sourceSchedules = (await db
        .select({
          end_date: template_schedules.end_date,
          key: template_schedules.key,
          kind: template_schedules.kind,
          name: template_schedules.name,
          recurrence: template_schedules.recurrence,
          rule: template_schedules.rule,
          start_date: template_schedules.start_date,
        })
        .from(template_schedules)
        .where(
          and(
            eq(template_schedules.template_id, args.template_id),
            eq(template_schedules.church_id, args.church_id),
            isNull(template_schedules.deleted_at),
          ),
        )) as Array<{
        readonly end_date: string | null;
        readonly key: string;
        readonly kind: string;
        readonly name: string;
        readonly recurrence: string;
        readonly rule: string;
        readonly start_date: string;
      }>;
      const sourceFocusWindows = (await db
        .select({
          anchor_date: focus_windows.anchor_date,
          end_date: focus_windows.end_date,
          key: focus_windows.key,
          key_date_id: focus_windows.key_date_id,
          name: focus_windows.name,
          source_id: focus_windows.id,
          start_date: focus_windows.start_date,
          type: focus_windows.type,
        })
        .from(focus_windows)
        .where(
          and(
            eq(focus_windows.template_id, args.template_id),
            eq(focus_windows.church_id, args.church_id),
            isNull(focus_windows.deleted_at),
          ),
        )) as Array<{
        readonly anchor_date: string | null;
        readonly end_date: string;
        readonly key: string;
        readonly key_date_id: string | null;
        readonly name: string;
        readonly source_id: string;
        readonly start_date: string;
        readonly type: string;
      }>;

      const templateId = getTemplateId();
      const teamIdBySourceId = new Map(
        sourceTeams.map((team) => [team.source_id, getTemplateTeamId()]),
      );
      const taskIdBySourceId = new Map(
        sourceTasks.map((task) => [task.source_id, getTemplateTaskId()]),
      );
      const focusWindowIdBySourceId = new Map(
        sourceFocusWindows.map((focusWindow) => [focusWindow.source_id, getFocusWindowId()]),
      );
      const jsonFieldRemaps = new Map([["focusWindowId", focusWindowIdBySourceId]]);
      await db.insert(templates).values({
        _tag: "template",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: templateId,
        key: `${source.key}-copy-${templateId.slice(-8)}`,
        name: `${source.name} Copy`,
        placement_shape: source.placement_shape,
        recurrence: source.recurrence,
        updated_at: now,
        updated_by: session.user_id,
      });
      const teamInserts = sourceTeams.map((team) => ({
        _tag: "templateteam",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: teamIdBySourceId.get(team.source_id)!,
        key: team.key,
        mapped_team_id: team.mapped_team_id,
        name: team.name,
        template_id: templateId,
        updated_at: now,
        updated_by: session.user_id,
      }));
      if (teamInserts.length > 0) await db.insert(template_teams).values(teamInserts);
      if (sourceFocusWindows.length > 0) {
        await db.insert(focus_windows).values(
          sourceFocusWindows.map((focusWindow) => ({
            _tag: "focuswindow",
            anchor_date: focusWindow.anchor_date,
            church_id: args.church_id,
            created_at: now,
            created_by: session.user_id,
            end_date: focusWindow.end_date,
            id: focusWindowIdBySourceId.get(focusWindow.source_id)!,
            key: focusWindow.key,
            key_date_id: focusWindow.key_date_id,
            name: focusWindow.name,
            start_date: focusWindow.start_date,
            template_id: templateId,
            type: focusWindow.type,
            updated_at: now,
            updated_by: session.user_id,
          })),
        );
      }
      const taskInserts = sourceTasks.map((task) => ({
        _tag: "templatetask",
        assigned_user_id: task.assigned_user_id,
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        description: task.description,
        estimate: task.estimate,
        priority: task.priority,
        id: taskIdBySourceId.get(task.source_id)!,
        key: task.key,
        label_ids: task.label_ids,
        parent_template_task_id: task.parent_template_task_id
          ? (taskIdBySourceId.get(task.parent_template_task_id) ?? null)
          : null,
        placement_cycle_offset: task.placement_cycle_offset,
        placement_weekday: task.placement_weekday,
        scheduling_rule: remapSerializedJsonFieldValues(task.scheduling_rule, jsonFieldRemaps),
        template_id: templateId,
        template_team_id: teamIdBySourceId.get(task.template_team_id)!,
        title: task.title,
        updated_at: now,
        updated_by: session.user_id,
      }));
      if (taskInserts.length > 0) await db.insert(template_tasks).values(taskInserts);
      await Promise.all(
        sourceTasks.map((task) =>
          writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            entity_id: taskIdBySourceId.get(task.source_id)!,
            entity_type: "template_task",
            event_type: "template_task.created",
            metadata: { source_template_task_id: task.source_id, template_id: templateId },
            occurred_at: now,
          }),
        ),
      );
      if (sourceSchedules.length > 0) {
        const scheduleInserts = sourceSchedules.map((schedule) => ({
          _tag: "templateschedule",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          end_date: schedule.end_date,
          id: getTemplateScheduleId(),
          key: `${schedule.key}-copy-${templateId.slice(-8)}`,
          kind: schedule.kind,
          name: schedule.name,
          recurrence: schedule.recurrence,
          rule: remapSerializedJsonFieldValues(schedule.rule, jsonFieldRemaps),
          start_date: schedule.start_date,
          template_id: templateId,
          updated_at: now,
          updated_by: session.user_id,
        }));
        await db.insert(template_schedules).values(scheduleInserts);
        await Promise.all(
          scheduleInserts.map((schedule) =>
            writeActivity(db, {
              actor_id: session.user_id,
              church_id: args.church_id,
              entity_id: schedule.id,
              entity_type: "template_schedule",
              event_type: "template_schedule.created",
              metadata: { source_template_id: args.template_id, template_id: templateId },
              occurred_at: now,
            }),
          ),
        );
      }
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: templateId,
        entity_type: "template",
        event_type: "template.duplicated",
        metadata: { source_template_id: args.template_id },
        occurred_at: now,
      });
    }),
    delete: defineChurchTaskMutator(TemplateEntityMutationArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await softDeleteEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: templates,
        user_id: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template",
        event_type: "template.deleted",
        metadata: {},
        occurred_at: now,
      });
    }),
    restore: defineChurchTaskMutator(TemplateEntityMutationArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await restoreEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: templates,
        user_id: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template",
        event_type: "template.restored",
        metadata: {},
        occurred_at: now,
      });
    }),
    project_cycle: defineChurchTaskMutator(ProjectTemplateCycleArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const [cycle] = (await db
        .select({ id: cycles.id, start_date: cycles.start_date })
        .from(cycles)
        .where(
          and(
            eq(cycles.id, args.cycle_id),
            eq(cycles.church_id, args.church_id),
            isNull(cycles.deleted_at),
          ),
        )) as CycleRow[];
      if (!cycle) throw new Error("Cycle not found.");

      const templateTeams = (await db
        .select({ id: template_teams.id, mapped_team_id: template_teams.mapped_team_id })
        .from(template_teams)
        .where(
          and(
            eq(template_teams.template_id, args.template_id),
            eq(template_teams.church_id, args.church_id),
            isNull(template_teams.deleted_at),
          ),
        )) as TemplateTeamRow[];
      const templateTasks = (await db
        .select({
          id: template_tasks.id,
          key: template_tasks.key,
          parent_template_task_id: template_tasks.parent_template_task_id,
          scheduling_rule: template_tasks.scheduling_rule,
          template_team_id: template_tasks.template_team_id,
          title: template_tasks.title,
        })
        .from(template_tasks)
        .where(
          and(
            eq(template_tasks.template_id, args.template_id),
            eq(template_tasks.church_id, args.church_id),
            isNull(template_tasks.deleted_at),
          ),
        )) as TemplateTaskRow[];
      const focusWindows = (await db
        .select({
          anchor_date: focus_windows.anchor_date,
          end_date: focus_windows.end_date,
          id: focus_windows.id,
          start_date: focus_windows.start_date,
        })
        .from(focus_windows)
        .where(
          and(
            eq(focus_windows.template_id, args.template_id),
            eq(focus_windows.church_id, args.church_id),
            isNull(focus_windows.deleted_at),
          ),
        )) as FocusWindowRow[];
      const keyDateOccurrences = (await db
        .select({
          key_date_id: key_date_occurrences.key_date_id,
          local_date: key_date_occurrences.local_date,
        })
        .from(key_date_occurrences)
        .where(
          and(
            eq(key_date_occurrences.church_id, args.church_id),
            isNull(key_date_occurrences.deleted_at),
          ),
        )) as KeyDateOccurrenceRow[];
      const adjustments = (await db
        .select({
          lifecycle: cycle_adjustments.lifecycle,
          overrides: cycle_adjustments.overrides,
          template_task_id: cycle_adjustments.template_task_id,
        })
        .from(cycle_adjustments)
        .where(
          and(
            eq(cycle_adjustments.church_id, args.church_id),
            eq(cycle_adjustments.cycle_id, args.cycle_id),
            isNull(cycle_adjustments.deleted_at),
          ),
        )) as CycleAdjustmentRow[];
      const existingProjectedTasks = (await db
        .select({
          id: tasks.id,
          source_template_occurrence_key: tasks.source_template_occurrence_key,
          source_template_schedule_id: tasks.source_template_schedule_id,
          source_template_task_id: tasks.source_template_task_id,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.church_id, args.church_id),
            eq(tasks.source_template_id, args.template_id),
            eq(tasks.cycle_id, args.cycle_id),
            isNull(tasks.deleted_at),
          ),
        )) as ExistingProjectedTaskRow[];
      const mappedTeamIds = templateTeams.map((templateTeam) => templateTeam.mapped_team_id);
      const teamRows = (await db
        .select({ id: teams.id, next_task_number: teams.next_task_number })
        .from(teams)
        .where(
          and(
            eq(teams.church_id, args.church_id),
            inArray(teams.id, mappedTeamIds),
            isNull(teams.deleted_at),
          ),
        )) as Array<{ readonly id: string; readonly next_task_number: number }>;
      const workflowRows = (await db
        .select({ id: workflows.id, team_id: workflows.team_id })
        .from(workflows)
        .where(
          and(
            eq(workflows.church_id, args.church_id),
            inArray(workflows.team_id, mappedTeamIds),
            isNull(workflows.deleted_at),
          ),
        )) as WorkflowRow[];
      const statusRows = (await db
        .select({ id: workflow_statuses.id, workflow_id: workflow_statuses.workflow_id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.church_id, args.church_id),
            eq(workflow_statuses.task_state, "todo"),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as TodoStatusRow[];

      const projection = buildTemplateCycleTaskInserts({
        adjustments,
        church_id: args.church_id,
        cycle,
        existing_projected_tasks: existingProjectedTasks,
        focus_windows: focusWindows,
        key_date_occurrences: keyDateOccurrences,
        now: new Date(),
        session_user_id: session.user_id,
        start_number_by_team_id: new Map(teamRows.map((team) => [team.id, team.next_task_number])),
        template_id: args.template_id,
        template_tasks: templateTasks,
        template_teams: templateTeams,
        todo_status_by_workflow_id: new Map(
          statusRows.map((status) => [status.workflow_id, status]),
        ),
        workflow_by_team_id: new Map(workflowRows.map((workflow) => [workflow.team_id, workflow])),
      });

      if (projection.inserts.length > 0) await db.insert(tasks).values(projection.inserts);
      await Promise.all(
        projection.inserts.map((task) =>
          writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            cycle_id: args.cycle_id,
            entity_id: task.id,
            entity_type: "task",
            event_type: "task.template_synced",
            metadata: {
              source_template_cycle_id: args.cycle_id,
              template_id: args.template_id,
              template_task_id: task.source_template_task_id,
            },
            occurred_at: task.created_at,
          }),
        ),
      );
      for (const [team_id, next_task_number] of projection.nextNumberByTeamId.entries()) {
        await db
          .update(teams)
          .set({ next_task_number, updated_at: new Date(), updated_by: session.user_id })
          .where(eq(teams.id, team_id));
      }
    }),
  },
  template_tasks: {
    delete: defineChurchTaskMutator(TemplateEntityMutationArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await softDeleteEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: template_tasks,
        user_id: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template_task",
        event_type: "template_task.deleted",
        metadata: {},
        occurred_at: now,
      });
    }),
    restore: defineChurchTaskMutator(TemplateEntityMutationArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await restoreEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: template_tasks,
        user_id: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template_task",
        event_type: "template_task.restored",
        metadata: {},
        occurred_at: now,
      });
    }),
  },
  template_schedules: {
    delete: defineChurchTaskMutator(DeleteTemplateScheduleArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await softDeleteEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: template_schedules,
        user_id: session.user_id,
      });
      if (args.cleanup_current_occurrence && args.current_occurrence_key) {
        await db
          .update(cycle_adjustments)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(cycle_adjustments.church_id, args.church_id),
              eq(cycle_adjustments.source_template_schedule_id, args.id),
              eq(cycle_adjustments.source_template_occurrence_key, args.current_occurrence_key),
              isNull(cycle_adjustments.deleted_at),
            ),
          );
        await db
          .update(tasks)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(tasks.church_id, args.church_id),
              eq(tasks.source_template_schedule_id, args.id),
              eq(tasks.source_template_occurrence_key, args.current_occurrence_key),
              gte(tasks.due_date, args.current_date),
              isNull(tasks.deleted_at),
            ),
          );
      }
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template_schedule",
        event_type: "template_schedule.deleted",
        metadata: {
          cleanup_current_occurrence: args.cleanup_current_occurrence,
          current_occurrence_key: args.current_occurrence_key,
        },
        occurred_at: now,
      });
    }),
    restore: defineChurchTaskMutator(TemplateEntityMutationArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;
      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      await restoreEntity({
        church_id: args.church_id,
        db,
        id: args.id,
        now,
        table: template_schedules,
        user_id: session.user_id,
      });
      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.id,
        entity_type: "template_schedule",
        event_type: "template_schedule.restored",
        metadata: {},
        occurred_at: now,
      });
    }),
  },
  cycle_adjustments: {
    set: defineChurchTaskMutator(SetCycleAdjustmentsArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTemplateManager(ctx, args.church_id);
      const now = new Date();
      for (const adjustment of args.adjustments) {
        const existing = (await db
          .select({ id: cycle_adjustments.id, overrides: cycle_adjustments.overrides })
          .from(cycle_adjustments)
          .where(
            and(
              eq(cycle_adjustments.church_id, args.church_id),
              eq(cycle_adjustments.cycle_id, adjustment.cycle_id),
              eq(
                cycle_adjustments.source_template_schedule_id,
                adjustment.source_template_schedule_id,
              ),
              eq(cycle_adjustments.template_task_id, adjustment.template_task_id),
              eq(
                cycle_adjustments.source_template_occurrence_key,
                adjustment.source_template_occurrence_key,
              ),
              isNull(cycle_adjustments.deleted_at),
            ),
          )) as Array<{ readonly id: string; readonly overrides: string }>;
        const mergedOverrides = existing[0]
          ? mergeCycleAdjustmentOverrides(
              parseJson<readonly CycleAdjustmentOverrideInput[]>(existing[0].overrides, []),
              adjustment.overrides,
            )
          : adjustment.overrides;
        const values = {
          lifecycle: adjustment.lifecycle,
          overrides: stringifyJson(mergedOverrides),
          updated_at: now,
          updated_by: session.user_id,
        };

        if (existing[0]) {
          await db
            .update(cycle_adjustments)
            .set(values)
            .where(eq(cycle_adjustments.id, existing[0].id));
          await writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            cycle_id: adjustment.cycle_id,
            entity_id: existing[0].id,
            entity_type: "cycle_adjustment",
            event_type: "cycle_adjustment.updated",
            metadata: {
              source_template_occurrence_key: adjustment.source_template_occurrence_key,
              source_template_schedule_id: adjustment.source_template_schedule_id,
              template_task_id: adjustment.template_task_id,
            },
            occurred_at: now,
          });
        } else {
          const cycleAdjustmentId = getCycleAdjustmentId();
          await db.insert(cycle_adjustments).values({
            ...values,
            _tag: "cycleadjustment",
            church_id: args.church_id,
            created_at: now,
            created_by: session.user_id,
            cycle_id: adjustment.cycle_id,
            id: cycleAdjustmentId,
            source_template_occurrence_key: adjustment.source_template_occurrence_key,
            source_template_schedule_id: adjustment.source_template_schedule_id,
            template_task_id: adjustment.template_task_id,
          });
          await writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            cycle_id: adjustment.cycle_id,
            entity_id: cycleAdjustmentId,
            entity_type: "cycle_adjustment",
            event_type: "cycle_adjustment.created",
            metadata: {
              source_template_occurrence_key: adjustment.source_template_occurrence_key,
              source_template_schedule_id: adjustment.source_template_schedule_id,
              template_task_id: adjustment.template_task_id,
            },
            occurred_at: now,
          });
        }
      }
    }),
  },
  task_comments: {
    create: defineChurchTaskMutator(CreateTaskCommentArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const body = args.body.trimEnd();
      if (!body.trim()) throw new Error("Comment body is required.");

      const taskRows = (await db
        .select({ cycle_id: tasks.cycle_id, id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, args.task_id),
            eq(tasks.church_id, args.church_id),
            isNull(tasks.deleted_at),
          ),
        )) as Array<{ readonly cycle_id: string | null; readonly id: string }>;
      const task = taskRows[0];
      if (!task) throw new Error("Task not found.");

      const parentCommentId = args.parent_comment_id ?? null;

      if (parentCommentId) {
        const parentRows = (await db
          .select({ id: task_comments.id, parent_comment_id: task_comments.parent_comment_id })
          .from(task_comments)
          .where(
            and(
              eq(task_comments.id, parentCommentId),
              eq(task_comments.church_id, args.church_id),
              eq(task_comments.task_id, args.task_id),
              isNull(task_comments.deleted_at),
            ),
          )) as Array<{ readonly id: string; readonly parent_comment_id: string | null }>;
        const parent = parentRows[0];
        if (!parent) throw new Error("Parent comment not found.");
        if (parent.parent_comment_id) throw new Error("Replies can only be one level deep.");
      }

      const now = new Date();
      const commentId = getTaskCommentId();
      await db.insert(task_comments).values({
        _tag: "taskcomment",
        authored_by_user_id: session.user_id,
        body,
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        deleted_at: null,
        deleted_by: null,
        id: commentId,
        parent_comment_id: parentCommentId,
        task_id: args.task_id,
        updated_at: now,
        updated_by: session.user_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        cycle_id: task.cycle_id,
        entity_id: args.task_id,
        entity_type: "task",
        event_type: parentCommentId ? "reply_created" : "comment_created",
        metadata: parentCommentId
          ? { comment_id: commentId, parent_comment_id: parentCommentId }
          : { comment_id: commentId },
        occurred_at: now,
      });
    }),
  },
  tasks: {
    create: defineChurchTaskMutator(CreateTaskArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const title = args.title.trim();
      if (!title) throw new Error("Task title is required.");

      const statusRows = (await db
        .select({
          id: workflow_statuses.id,
          task_state: workflow_statuses.task_state,
          workflow_id: workflow_statuses.workflow_id,
        })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.id, args.workflow_status_id),
            eq(workflow_statuses.church_id, args.church_id),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{
        readonly id: string;
        readonly task_state: string;
        readonly workflow_id: string;
      }>;
      const status = statusRows[0];
      if (!status) throw new Error("Workflow Status not found.");

      const teamRows = (await db
        .select({
          id: teams.id,
          identifier: teams.identifier,
          next_task_number: teams.next_task_number,
        })
        .from(teams)
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        )) as Array<{
        readonly id: string;
        readonly identifier: string;
        readonly next_task_number: number;
      }>;
      const team = teamRows[0];
      if (!team) throw new Error("Team not found.");

      const workflowRows = (await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, status.workflow_id),
            eq(workflows.team_id, team.id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      if (workflowRows.length === 0)
        throw new Error("Workflow Status is not in the Team Workflow.");

      const labelIds = args.label_ids ?? [];
      validateTaskLabelIds(await getChurchLabels(db, args.church_id), {
        label_ids: labelIds,
        team_id: team.id,
      });

      const boardRows = (await db
        .select({ board_order: tasks.board_order })
        .from(tasks)
        .where(and(eq(tasks.workflow_status_id, status.id), isNull(tasks.deleted_at)))) as Array<{
        readonly board_order: string;
      }>;
      const boardOrder = appendBoardOrderKey(
        boardRows.reduce<string | null>(
          (max, task) => (max === null || task.board_order > max ? task.board_order : max),
          null,
        ),
      );
      const now = new Date();
      const taskId = getTaskId();
      let cycleId: string | null = null;
      if (args.target_cycle) {
        cycleId = await ensureTargetCycle(db, {
          church_id: args.church_id,
          session_user_id: session.user_id,
          target_cycle: args.target_cycle,
        });
      } else if (status.task_state !== "todo") {
        cycleId = await requireCurrentCycleId(db, args.church_id);
      }

      await db.insert(tasks).values({
        _tag: "task",
        assigned_user_id: args.assigned_user_id ?? null,
        board_order: boardOrder,
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        created_by_user_id: session.user_id,
        cycle_id: cycleId,
        description: args.description ?? null,
        due_date: args.due_date ?? null,
        estimate: args.estimate ?? null,
        priority: args.priority ?? null,
        finished_at: status.task_state === "done" ? now : null,
        id: taskId,
        label_ids: serializeStringArray(labelIds),
        number: team.next_task_number,
        parent_task_id: args.parent_task_id ?? null,
        previous_identifiers: "[]",
        source_template_cycle_id: null,
        source_template_id: null,
        source_template_sync_enabled: false,
        source_template_task_id: null,
        task_state: status.task_state,
        team_id: team.id,
        title,
        updated_at: now,
        updated_by: session.user_id,
        workflow_id: status.workflow_id,
        workflow_status_id: status.id,
      });

      await db
        .update(teams)
        .set({
          next_task_number: team.next_task_number + 1,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(eq(teams.id, team.id));

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        cycle_id: cycleId,
        entity_id: taskId,
        entity_type: "task",
        event_type: "task.created",
        metadata: { parent_task_id: args.parent_task_id ?? null, team_id: team.id },
        occurred_at: now,
      });
    }),
    update: defineChurchTaskMutator(UpdateTaskArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const { changes, patch } = await taskPatchForFields(db, {
        church_id: args.church_id,
        fields: args.fields,
        session_user_id: session.user_id,
        task_id: args.task_id,
      });

      await db
        .update(tasks)
        .set(patch)
        .where(
          and(
            eq(tasks.id, args.task_id),
            eq(tasks.church_id, args.church_id),
            isNull(tasks.deleted_at),
          ),
        );

      await writeTaskActivityChanges(db, {
        actor_id: session.user_id,
        changes,
        church_id: args.church_id,
        cycle_id: patch.cycle_id ?? null,
        task_id: args.task_id,
      });
    }),
    update_batch: defineChurchTaskMutator(UpdateTasksBatchArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      for (const update of args.updates) {
        const { changes, patch } = await taskPatchForFields(db, {
          church_id: args.church_id,
          fields: update.fields,
          session_user_id: session.user_id,
          task_id: update.task_id,
        });
        await db
          .update(tasks)
          .set(patch)
          .where(
            and(
              eq(tasks.id, update.task_id),
              eq(tasks.church_id, args.church_id),
              isNull(tasks.deleted_at),
            ),
          );

        await writeTaskActivityChanges(db, {
          actor_id: session.user_id,
          changes,
          church_id: args.church_id,
          cycle_id: patch.cycle_id ?? null,
          task_id: update.task_id,
        });
      }
    }),
    materialize_projected: defineChurchTaskMutator(
      MaterializeProjectedTaskArgs,
      async ({ args, ctx, tx }) => {
        const db = serverDb(tx);
        if (!db) return;

        const session = requireActiveChurchAccess(ctx, args.church_id);
        const now = new Date();
        const existing = (await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.church_id, args.church_id),
              eq(tasks.source_template_schedule_id, args.source_template_schedule_id),
              eq(tasks.source_template_task_id, args.source_template_task_id),
              eq(tasks.source_template_occurrence_key, args.source_template_occurrence_key),
              isNull(tasks.deleted_at),
            ),
          )
          .limit(1)) as Array<{ readonly id: string }>;
        if (existing[0]) {
          const { patch } = await taskPatchForFields(db, {
            church_id: args.church_id,
            fields: { workflow_status_id: args.workflow_status_id },
            session_user_id: session.user_id,
            task_id: existing[0].id,
          });
          await db.update(tasks).set(patch).where(eq(tasks.id, existing[0].id));
          return;
        }

        const [team] = (await db
          .select({ id: teams.id, next_task_number: teams.next_task_number })
          .from(teams)
          .where(
            and(
              eq(teams.id, args.team_id),
              eq(teams.church_id, args.church_id),
              isNull(teams.deleted_at),
            ),
          )
          .limit(1)) as Array<{ readonly id: string; readonly next_task_number: number }>;
        if (!team) throw new Error("Team not found.");
        const [status] = (await db
          .select({
            id: workflow_statuses.id,
            task_state: workflow_statuses.task_state,
            workflow_id: workflow_statuses.workflow_id,
          })
          .from(workflow_statuses)
          .where(
            and(
              eq(workflow_statuses.id, args.workflow_status_id),
              eq(workflow_statuses.church_id, args.church_id),
              isNull(workflow_statuses.deleted_at),
            ),
          )
          .limit(1)) as Array<{
          readonly id: string;
          readonly task_state: string;
          readonly workflow_id: string;
        }>;
        if (!status) throw new Error("Workflow Status not found.");
        const [workflow] = (await db
          .select({ id: workflows.id })
          .from(workflows)
          .where(
            and(
              eq(workflows.id, status.workflow_id),
              eq(workflows.team_id, team.id),
              eq(workflows.church_id, args.church_id),
              isNull(workflows.deleted_at),
            ),
          )
          .limit(1)) as Array<{ readonly id: string }>;
        if (!workflow) throw new Error("Workflow Status is not in this Team's Workflow.");

        const taskId = getTaskId();
        await db.insert(tasks).values({
          _tag: "task",
          assigned_user_id: args.assigned_user_id ?? null,
          board_order: appendBoardOrderKey(null),
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          created_by_user_id: session.user_id,
          cycle_id: args.cycle_id,
          description: args.description ?? null,
          due_date: args.due_date ?? null,
          estimate: args.estimate ?? null,
          priority: args.priority ?? null,
          finished_at: status.task_state === "done" ? now : null,
          id: taskId,
          label_ids: serializeStringArray(args.label_ids ?? []),
          number: team.next_task_number,
          parent_task_id: null,
          previous_identifiers: "[]",
          source_template_cycle_id: null,
          source_template_id: args.source_template_id,
          source_template_occurrence_key: args.source_template_occurrence_key,
          source_template_schedule_id: args.source_template_schedule_id,
          source_template_sync_enabled: false,
          source_template_task_id: args.source_template_task_id,
          task_state: status.task_state,
          team_id: team.id,
          title: args.title.trim(),
          updated_at: now,
          updated_by: session.user_id,
          workflow_id: workflow.id,
          workflow_status_id: status.id,
        });
        await db
          .update(teams)
          .set({
            next_task_number: team.next_task_number + 1,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(eq(teams.id, team.id));
        await writeActivity(db, {
          actor_id: session.user_id,
          church_id: args.church_id,
          cycle_id: args.cycle_id,
          entity_id: taskId,
          entity_type: "task",
          event_type: "task.template_materialized",
          metadata: {
            source_template_occurrence_key: args.source_template_occurrence_key,
            source_template_schedule_id: args.source_template_schedule_id,
            source_template_task_id: args.source_template_task_id,
          },
        });
      },
    ),
    complete: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
      if (!task) throw new Error("Task not found.");
      const rows = (await db
        .select({ id: workflow_statuses.id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.workflow_id, task.workflow_id),
            eq(workflow_statuses.task_state, "done"),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      const status = rows[0];
      if (!status) throw new Error("Done Workflow Status not found.");
      const now = new Date();
      const cycleId =
        task.cycle_id === null ? await requireCurrentCycleId(db, args.church_id) : task.cycle_id;
      await db
        .update(tasks)
        .set({
          cycle_id: cycleId,
          finished_at: now,
          task_state: "done",
          updated_at: now,
          updated_by: session.user_id,
          workflow_status_id: status.id,
        })
        .where(eq(tasks.id, args.task_id));

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        cycle_id: cycleId,
        entity_id: args.task_id,
        entity_type: "task",
        event_type: "task.completed",
        metadata: {
          previous_task_state: task.task_state,
          previous_workflow_status_id: task.workflow_status_id,
          workflow_status_id: status.id,
        },
        occurred_at: now,
      });
    }),
    cancel: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
      if (!task) throw new Error("Task not found.");
      const now = new Date();
      const cycleId =
        task.cycle_id === null ? await requireCurrentCycleId(db, args.church_id) : task.cycle_id;
      await db
        .update(tasks)
        .set({
          cycle_id: cycleId,
          finished_at: now,
          task_state: "canceled",
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(tasks.id, args.task_id),
            eq(tasks.church_id, args.church_id),
            isNull(tasks.deleted_at),
          ),
        );

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        cycle_id: cycleId,
        entity_id: args.task_id,
        entity_type: "task",
        event_type: "task.canceled",
        metadata: {
          previous_task_state: task.task_state,
          previous_workflow_status_id: task.workflow_status_id,
        },
        occurred_at: now,
      });
    }),
    reopen: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
      if (!task) throw new Error("Task not found.");
      const rows = (await db
        .select({ id: workflow_statuses.id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.workflow_id, task.workflow_id),
            eq(workflow_statuses.task_state, "todo"),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      const status = rows[0];
      if (!status) throw new Error("To Do Workflow Status not found.");
      const now = new Date();
      await db
        .update(tasks)
        .set({
          finished_at: null,
          task_state: "todo",
          updated_at: now,
          updated_by: session.user_id,
          workflow_status_id: status.id,
        })
        .where(eq(tasks.id, args.task_id));

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.task_id,
        entity_type: "task",
        event_type: "task.reopened",
        metadata: {
          restored_task_state: "todo",
          restored_workflow_status_id: status.id,
        },
        occurred_at: now,
      });
    }),
  },
  workflows: {
    rename: defineChurchTaskMutator(RenameWorkflowArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Workflow name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(workflows)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );

      await writeActivity(serverTx.dbTransaction.wrappedTransaction, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.workflow_id,
        entity_type: "workflow",
        event_type: "workflow.renamed",
        metadata: { name },
      });
    }),
    reorder: defineChurchTaskMutator(ReorderWorkflowsArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const rows = (await db
        .select({ id: workflows.id, team_id: workflows.team_id })
        .from(workflows)
        .where(
          and(
            eq(workflows.church_id, args.church_id),
            inArray(workflows.id, args.workflow_ids),
            isNull(workflows.deleted_at),
          ),
        )) as Array<{ readonly id: string; readonly team_id: string }>;
      const teamIdByWorkflowId = new Map(rows.map((workflow) => [workflow.id, workflow.team_id]));
      if (teamIdByWorkflowId.size !== args.workflow_ids.length) {
        throw new Error("All Workflows must belong to the active Church.");
      }

      const now = new Date();
      await Promise.all(
        args.workflow_ids.map((workflow_id, sort_order) => {
          const team_id = teamIdByWorkflowId.get(workflow_id);
          if (!team_id) throw new Error("All Workflows must belong to the active Church.");

          return db
            .update(teams)
            .set({ sort_order, updated_at: now, updated_by: session.user_id })
            .where(
              and(
                eq(teams.id, team_id),
                eq(teams.church_id, args.church_id),
                isNull(teams.deleted_at),
              ),
            );
        }),
      );

      await Promise.all(
        args.workflow_ids.map((workflow_id, sort_order) =>
          writeActivity(db, {
            actor_id: session.user_id,
            church_id: args.church_id,
            entity_id: workflow_id,
            entity_type: "workflow",
            event_type: "workflow.reordered",
            metadata: { sort_order },
          }),
        ),
      );
    }),
    archive: defineChurchTaskMutator(ArchiveWorkflowArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly select: (fields: unknown) => any };
        };
      };
      const rows = await serverTx.dbTransaction.wrappedTransaction
        .select({ team_id: workflows.team_id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );

      if (rows.length === 0) throw new Error("Workflow was not found in the active Church.");
      throw new Error("A Workflow owned by an active Team cannot be archived.");
    }),
    add_status: defineChurchTaskMutator(AddWorkflowStatusArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.status.name.trim();
      const key = args.status.key.trim();
      if (!name) throw new Error("Workflow Status name is required.");
      if (!key) throw new Error("Workflow Status key is required.");

      const now = new Date();
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly insert: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingWorkflow = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );

      if (existingWorkflow.length === 0) {
        throw new Error("Workflow was not found in the active Church.");
      }

      const statusId = getWorkflowStatusId();
      await db.insert(workflow_statuses).values({
        _tag: "workflowstatus",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: statusId,
        key,
        name,
        sort_order: args.status.sort_order,
        task_state: args.status.task_state,
        updated_at: now,
        updated_by: session.user_id,
        workflow_id: args.workflow_id,
      });

      await writeActivity(db, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: statusId,
        entity_type: "workflow_status",
        event_type: "workflow.status.created",
        metadata: { name, task_state: args.status.task_state, workflow_id: args.workflow_id },
        occurred_at: now,
      });
    }),
    rename_status: defineChurchTaskMutator(RenameWorkflowStatusArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Workflow Status name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(workflow_statuses)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(workflow_statuses.id, args.status_id),
            eq(workflow_statuses.church_id, args.church_id),
            isNull(workflow_statuses.deleted_at),
          ),
        );

      await writeActivity(serverTx.dbTransaction.wrappedTransaction, {
        actor_id: session.user_id,
        church_id: args.church_id,
        entity_id: args.status_id,
        entity_type: "workflow_status",
        event_type: "workflow.status.renamed",
        metadata: { name },
      });
    }),
    reorder_statuses: defineChurchTaskMutator(
      ReorderWorkflowStatusesArgs,
      async ({ args, ctx, tx }) => {
        if (tx.location !== "server") {
          return;
        }

        const session = requireTeamManager(ctx, args.church_id);
        const serverTx = tx as typeof tx & {
          readonly dbTransaction: {
            readonly wrappedTransaction: { readonly update: (table: unknown) => any };
          };
        };
        const now = new Date();

        await Promise.all(
          args.status_ids.map((status_id, sort_order) =>
            serverTx.dbTransaction.wrappedTransaction
              .update(workflow_statuses)
              .set({ sort_order, updated_at: now, updated_by: session.user_id })
              .where(
                and(
                  eq(workflow_statuses.id, status_id),
                  eq(workflow_statuses.workflow_id, args.workflow_id),
                  eq(workflow_statuses.church_id, args.church_id),
                  isNull(workflow_statuses.deleted_at),
                ),
              ),
          ),
        );

        await Promise.all(
          args.status_ids.map((status_id, sort_order) =>
            writeActivity(serverTx.dbTransaction.wrappedTransaction, {
              actor_id: session.user_id,
              church_id: args.church_id,
              entity_id: status_id,
              entity_type: "workflow_status",
              event_type: "workflow.status.reordered",
              metadata: { sort_order, workflow_id: args.workflow_id },
            }),
          ),
        );
      },
    ),
    archive_status: defineChurchTaskMutator(
      ArchiveWorkflowStatusArgs,
      async ({ args, ctx, tx }) => {
        if (tx.location !== "server") {
          return;
        }

        const session = requireTeamManager(ctx, args.church_id);
        const now = new Date();
        const serverTx = tx as typeof tx & {
          readonly dbTransaction: {
            readonly wrappedTransaction: { readonly update: (table: unknown) => any };
          };
        };

        await serverTx.dbTransaction.wrappedTransaction
          .update(workflow_statuses)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(workflow_statuses.id, args.status_id),
              eq(workflow_statuses.church_id, args.church_id),
              isNull(workflow_statuses.deleted_at),
            ),
          );

        await writeActivity(serverTx.dbTransaction.wrappedTransaction, {
          actor_id: session.user_id,
          church_id: args.church_id,
          entity_id: args.status_id,
          entity_type: "workflow_status",
          event_type: "workflow.status.archived",
        });
      },
    ),
  },
});
