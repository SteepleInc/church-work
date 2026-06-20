import {
  calculateKeyDateOccurrence,
  formatTaskIdentifier,
  KEY_DATE_PRESETS,
  type KeyDateRule,
  type TaskEstimate,
  type TaskStatus,
} from "@church-task/domain";
import {
  mutators,
  queries,
  type CycleAdjustment,
  type KeyDate,
  type Label,
  type ListArgs,
  type Task,
  type Team,
  type TemplateSchedule,
  type TemplateTask,
  type TemplateTeam,
  type Workflow,
  type WorkflowStatus,
} from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type TaskCollectionFilters = {
  readonly surface?: "my_work" | "our_work";
  readonly teamId?: string;
};

export type TaskCollectionItem = {
  readonly id: string;
  readonly churchId: string;
  readonly title: string;
  readonly description: string | null;
  readonly teamId: string;
  readonly number: number;
  readonly identifier: string;
  readonly previousIdentifiers: readonly string[];
  readonly assignedUserId: string | null;
  readonly cycleId: string | null;
  readonly dueDate: string | null;
  readonly createdAt: number;
  readonly createdByUserId: string | null;
  readonly parentTaskId: string | null;
  readonly labelIds: readonly string[];
  readonly workflowId: string;
  readonly workflowStatusId: string;
  readonly taskState: TaskStatus;
  readonly estimate: TaskEstimate | null;
  readonly boardOrder: string;
  readonly finishedAt: string | null;
  readonly sourceTemplateId: string | null;
  readonly sourceTemplateTaskId: string | null;
  readonly sourceTemplateCycleId: string | null;
  readonly sourceTemplateScheduleId: string | null;
  readonly sourceTemplateOccurrenceKey: string | null;
  readonly sourceTemplateSyncEnabled: boolean;
  readonly sourceBadge: TemplateSourceBadge | null;
  /**
   * True for UI-only Tasks projected from a Template Schedule that have not yet
   * been materialized into real Tasks. Surfaces use this to render a "planned"
   * (dashed/ghost) treatment so projections read distinctly from real Tasks.
   */
  readonly isProjected: boolean;
  /**
   * True when a projected Template Task carries a Cycle Adjustment with one or
   * more planning overrides for this occurrence. Surfaces use this to mark the
   * projection as edited-for-this-Cycle without it ceasing to be a projection.
   */
  readonly isAdjusted: boolean;
};

export type TemplateSourceBadge = {
  readonly scheduleId: string;
  readonly scheduleName: string;
  readonly occurrenceKey: string;
  readonly occurrenceLabel: string;
  readonly occurrenceDate: string | null;
  readonly occurrencePeriod: string | null;
  /**
   * The kind of Template Schedule occurrence this source chip represents,
   * derived from the occurrence key prefix. Drives the source-chip glyph so a
   * Key Date occurrence reads distinctly from a weekly Cadence occurrence.
   */
  readonly occurrenceKind: "keyDate" | "weekly" | "other";
  /** Human-friendly period label (e.g. "Jun 2026"), derived from the occurrence. */
  readonly periodLabel: string | null;
  /**
   * Full chip background/border/text class set, used where a strongly tinted
   * chip is appropriate. Kept stable per Template Schedule ID.
   */
  readonly colorClassName: string;
  /**
   * Solid dot color class (e.g. "bg-sky-500"), stable per Template Schedule ID.
   * Mirrors the Label colored-dot convention so source chips read as native.
   */
  readonly dotClassName: string;
};

type CycleProjectionContext = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
};

type ProjectedTaskAdjustmentOverride =
  | { readonly field: "title"; readonly value: string }
  | { readonly field: "description"; readonly value: string | null }
  | { readonly field: "assignedUserId"; readonly value: string | null }
  | { readonly field: "teamId"; readonly value: string }
  | { readonly field: "dueDate"; readonly value: string }
  | { readonly field: "labelIds"; readonly value: readonly string[] }
  | { readonly field: "estimate"; readonly value: TaskEstimate | null };

export type TaskUpdateFields = {
  readonly title?: string;
  readonly description?: string | null;
  readonly assignedUserId?: string | null;
  readonly teamId?: string;
  readonly workflowStatusId?: string;
  readonly dueDate?: string | null;
  readonly cycleId?: string | null;
  readonly targetCycle?: {
    readonly churchTimeZone: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly startsAt: string;
    readonly endsAt: string;
  };
  readonly parentTaskId?: string | null;
  readonly boardOrder?: string;
  readonly labelIds?: readonly string[];
  readonly estimate?: TaskEstimate | null;
};

const applyProjectedTaskOverrides = (
  task: TaskCollectionItem,
  overrides: readonly ProjectedTaskAdjustmentOverride[],
): TaskCollectionItem => {
  let next = task;
  for (const override of overrides) {
    switch (override.field) {
      case "assignedUserId":
        next = { ...next, assignedUserId: override.value };
        break;
      case "description":
        next = { ...next, description: override.value };
        break;
      case "dueDate":
        next = { ...next, dueDate: override.value };
        break;
      case "estimate":
        next = { ...next, estimate: override.value };
        break;
      case "labelIds":
        next = { ...next, labelIds: override.value };
        break;
      case "teamId":
        next = { ...next, teamId: override.value };
        break;
      case "title":
        next = { ...next, title: override.value };
        break;
    }
  }
  return next;
};

const scopedLabelIdsForTeam = (
  labelIds: readonly string[],
  teamId: string,
  labels: readonly Pick<Label, "id" | "team_id">[],
) => {
  if (labels.length === 0) return labelIds;
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  return labelIds.filter((labelId) => {
    const label = labelsById.get(labelId);
    return !label || label.team_id === null || label.team_id === teamId;
  });
};

type TargetCycleFields = NonNullable<TaskUpdateFields["targetCycle"]>;

type MutationResult<Data = undefined> = Promise<
  | { readonly ok: true; readonly data: Data }
  | { readonly ok: false; readonly error: { readonly message: string } }
>;

const parseStringArray = (value: string | null | undefined): readonly string[] => {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const taskStatus = (value: string): TaskStatus => {
  if (value === "todo" || value === "in_progress" || value === "done" || value === "canceled") {
    return value;
  }

  return "todo";
};

const taskEstimate = (value: string | null | undefined): TaskEstimate | null => {
  if (value === "xs" || value === "s" || value === "m" || value === "l" || value === "xl") {
    return value;
  }

  return null;
};

const timestampToIso = (value: number | null | undefined): string | null =>
  typeof value === "number" ? new Date(value).toISOString() : null;

const SCHEDULE_COLOR_CLASSES = [
  "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
] as const;

// Solid dot colors, parallel to SCHEDULE_COLOR_CLASSES, matching the Label
// colored-dot convention so projected/materialized source chips read as native
// alongside Label badges on Task cards and rows.
const SCHEDULE_DOT_CLASSES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
] as const;

const scheduleColorIndex = (scheduleId: string): number => {
  let hash = 0;
  for (const char of scheduleId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % SCHEDULE_COLOR_CLASSES.length;
};

export const getTemplateScheduleColorClassName = (scheduleId: string): string =>
  SCHEDULE_COLOR_CLASSES[scheduleColorIndex(scheduleId)] ?? SCHEDULE_COLOR_CLASSES[0];

export const getTemplateScheduleDotClassName = (scheduleId: string): string =>
  SCHEDULE_DOT_CLASSES[scheduleColorIndex(scheduleId)] ?? SCHEDULE_DOT_CLASSES[0];

const weekdayName = (weekday: number) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ?? "day";

const mondayFirstPosition = (weekday: number) => (weekday + 6) % 7;

const addDays = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const dateWeekday = (date: string): number => new Date(`${date}T00:00:00.000Z`).getUTCDay();

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
};

const isKeyDatePreset = (value: unknown) =>
  typeof value === "string" && KEY_DATE_PRESETS.some((preset) => preset === value);

const isKeyDateRule = (value: unknown): value is KeyDateRule => {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  if (value.kind === "fixedYearly") {
    return (
      "month" in value &&
      "day" in value &&
      typeof value.month === "number" &&
      typeof value.day === "number"
    );
  }
  if (value.kind === "computedYearly") {
    return "rule" in value && isKeyDatePreset(value.rule);
  }
  return value.kind === "oneTime" && "localDate" in value && typeof value.localDate === "string";
};

const parseKeyDateSchedule = (value: string | null | undefined): KeyDateRule | null => {
  const parsed = parseJson<unknown>(value, null);
  return isKeyDateRule(parsed) ? parsed : null;
};

const templateOccurrenceKind = (occurrenceKey: string): TemplateSourceBadge["occurrenceKind"] => {
  if (occurrenceKey.startsWith("keydate:")) return "keyDate";
  if (occurrenceKey.startsWith("weekly:")) return "weekly";
  return "other";
};

const occurrenceLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return `${weekdayName(parsed.getUTCDay())} ${parsed.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })}`;
};

const periodLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
};

export const buildTemplateSourceBadge = (args: {
  readonly schedule: Pick<TemplateSchedule, "id" | "name">;
  readonly occurrenceKey: string | null;
}): TemplateSourceBadge | null => {
  if (!args.occurrenceKey) return null;
  const date = args.occurrenceKey.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return {
    colorClassName: getTemplateScheduleColorClassName(args.schedule.id),
    dotClassName: getTemplateScheduleDotClassName(args.schedule.id),
    occurrenceDate: date,
    occurrenceKey: args.occurrenceKey,
    occurrenceKind: templateOccurrenceKind(args.occurrenceKey),
    occurrenceLabel: date ? occurrenceLabel(date) : args.occurrenceKey,
    occurrencePeriod: date ? date.slice(0, 7) : null,
    periodLabel: date ? periodLabel(date) : null,
    scheduleId: args.schedule.id,
    scheduleName: args.schedule.name,
  };
};

const buildMaterializedTaskSourceBadge = (
  task: Task,
  schedulesById: ReadonlyMap<string, TemplateSchedule>,
): TemplateSourceBadge | null => {
  if (!task.source_template_schedule_id) return null;
  const schedule = schedulesById.get(task.source_template_schedule_id);
  return schedule
    ? buildTemplateSourceBadge({
        occurrenceKey: task.source_template_occurrence_key ?? null,
        schedule,
      })
    : null;
};

const mapTask = (
  task: Task,
  teamsById: ReadonlyMap<string, Team>,
  schedulesById: ReadonlyMap<string, TemplateSchedule> = new Map(),
): TaskCollectionItem => ({
  assignedUserId: task.assigned_user_id ?? null,
  boardOrder: task.board_order,
  churchId: task.church_id,
  createdAt: task.created_at ?? 0,
  createdByUserId: task.created_by_user_id ?? task.created_by ?? null,
  cycleId: task.cycle_id ?? null,
  description: task.description ?? null,
  dueDate: task.due_date ?? null,
  estimate: taskEstimate(task.estimate),
  finishedAt: timestampToIso(task.finished_at),
  id: task.id,
  identifier: formatTaskIdentifier(teamsById.get(task.team_id)?.identifier ?? "TEAM", task.number),
  isAdjusted: false,
  isProjected: false,
  labelIds: parseStringArray(task.label_ids),
  number: task.number,
  parentTaskId: task.parent_task_id ?? null,
  previousIdentifiers: parseStringArray(task.previous_identifiers),
  sourceTemplateCycleId: task.source_template_cycle_id ?? null,
  sourceTemplateId: task.source_template_id ?? null,
  sourceTemplateOccurrenceKey: task.source_template_occurrence_key ?? null,
  sourceTemplateScheduleId: task.source_template_schedule_id ?? null,
  sourceTemplateSyncEnabled: task.source_template_sync_enabled ?? false,
  sourceTemplateTaskId: task.source_template_task_id ?? null,
  sourceBadge: buildMaterializedTaskSourceBadge(task, schedulesById),
  taskState: taskStatus(task.task_state),
  teamId: task.team_id,
  title: task.title,
  workflowId: task.workflow_id,
  workflowStatusId: task.workflow_status_id,
});

const keyDateScheduleOccurrences = (args: {
  readonly cycleEndDate: string;
  readonly keyDateId: string;
  readonly keyDateSchedule: KeyDateRule;
  readonly schedule: TemplateSchedule;
}) => {
  const occurrences: { occurrenceDate: string; occurrenceKey: string }[] = [];
  const startYear = Number(args.schedule.start_date.slice(0, 4));
  const endYear = Number(addDays(args.cycleEndDate, 371).slice(0, 4));

  for (let year = startYear; year <= endYear; year += 1) {
    const occurrenceDate = calculateKeyDateOccurrence(args.keyDateSchedule, year);
    if (!occurrenceDate || occurrenceDate < args.schedule.start_date) continue;
    if (args.schedule.end_date && occurrenceDate > args.schedule.end_date) break;
    if (args.schedule.recurrence !== "repeating" && occurrenceDate !== args.schedule.start_date) {
      continue;
    }
    occurrences.push({
      occurrenceDate,
      occurrenceKey: `keydate:${occurrenceDate}:${args.keyDateId}`,
    });
  }

  return occurrences;
};

export function buildProjectedTemplateTasksForCycle(args: {
  readonly cycle: CycleProjectionContext;
  readonly existingTasks: readonly TaskCollectionItem[];
  readonly keyDates?: readonly KeyDate[];
  readonly schedules: readonly TemplateSchedule[];
  readonly templateTasks: readonly TemplateTask[];
  readonly templateTeams: readonly TemplateTeam[];
  readonly workflows: readonly Workflow[];
  readonly workflowStatuses: readonly WorkflowStatus[];
  readonly cycleAdjustments?: readonly CycleAdjustment[];
  readonly labels?: readonly Label[];
  readonly teamFilterId?: string;
}): readonly TaskCollectionItem[] {
  const templateTeamsById = new Map(args.templateTeams.map((team) => [team.id, team]));
  const keyDatesById = new Map((args.keyDates ?? []).map((keyDate) => [keyDate.id, keyDate]));
  const workflowsByTeamId = new Map(args.workflows.map((workflow) => [workflow.team_id, workflow]));
  const todoByWorkflowId = new Map(
    args.workflowStatuses
      .filter((status) => status.task_state === "todo")
      .map((status) => [status.workflow_id, status]),
  );
  const existingSourceKeys = new Set(
    args.existingTasks.flatMap((task) =>
      task.sourceTemplateScheduleId && task.sourceTemplateTaskId && task.sourceTemplateOccurrenceKey
        ? [
            `${task.sourceTemplateScheduleId}:${task.sourceTemplateTaskId}:${task.sourceTemplateOccurrenceKey}:${args.cycle.id}`,
          ]
        : [],
    ),
  );
  const projected: TaskCollectionItem[] = [];
  const adjustmentBySourceKey = new Map(
    (args.cycleAdjustments ?? []).map((adjustment) => [
      `${adjustment.source_template_schedule_id ?? ""}:${adjustment.template_task_id}:${adjustment.source_template_occurrence_key ?? ""}:${adjustment.cycle_id}`,
      adjustment,
    ]),
  );

  const projectOccurrence = (params: {
    readonly schedule: TemplateSchedule;
    readonly scheduleTasks: readonly TemplateTask[];
    readonly occurrenceDate: string;
    readonly occurrenceKey: string;
    readonly anchorWeekday: number;
  }) => {
    for (const templateTask of params.scheduleTasks) {
      const templateTeam = templateTeamsById.get(templateTask.template_team_id);
      const teamId = templateTeam?.mapped_team_id;
      if (!teamId) continue;
      const placementWeekday = templateTask.placement_weekday ?? params.anchorWeekday;
      const dueDate = addDays(
        params.occurrenceDate,
        (templateTask.placement_cycle_offset ?? 0) * 7 +
          (mondayFirstPosition(placementWeekday) - mondayFirstPosition(params.anchorWeekday)),
      );
      if (dueDate < args.cycle.startDate || dueDate > args.cycle.endDate) continue;
      const sourceKey = `${params.schedule.id}:${templateTask.id}:${params.occurrenceKey}:${args.cycle.id}`;
      if (existingSourceKeys.has(sourceKey)) continue;
      const baseLabelIds = parseStringArray(templateTask.label_ids);
      const adjustment = adjustmentBySourceKey.get(sourceKey);
      const overrides = parseJson<readonly ProjectedTaskAdjustmentOverride[]>(
        adjustment?.overrides,
        [],
      );
      const adjustedTeamOverride = overrides.find((override) => override.field === "teamId");
      const effectiveTeamId = adjustedTeamOverride?.value ?? teamId;
      const adjustedLabelsOverride = overrides.find((override) => override.field === "labelIds");
      const effectiveLabelIds = scopedLabelIdsForTeam(
        adjustedLabelsOverride?.value ?? baseLabelIds,
        effectiveTeamId,
        args.labels ?? [],
      );
      if (args.teamFilterId && args.teamFilterId !== effectiveTeamId) continue;
      const effectiveWorkflow = workflowsByTeamId.get(effectiveTeamId);
      const todo = effectiveWorkflow ? todoByWorkflowId.get(effectiveWorkflow.id) : null;
      if (!effectiveWorkflow || !todo) continue;
      const baseProjection: TaskCollectionItem = {
        assignedUserId: templateTask.assigned_user_id ?? null,
        boardOrder: `template:${params.schedule.id}:${params.occurrenceKey}:${templateTask.id}`,
        churchId: params.schedule.church_id,
        createdAt: 0,
        createdByUserId: null,
        cycleId: args.cycle.id,
        description: templateTask.description ?? null,
        dueDate,
        estimate: taskEstimate(templateTask.estimate),
        finishedAt: null,
        id: `projected-template-task:${params.schedule.id}:${templateTask.id}:${params.occurrenceKey}:${args.cycle.id}`,
        identifier: "Projected",
        isAdjusted: overrides.length > 0,
        isProjected: true,
        labelIds: effectiveLabelIds,
        number: 0,
        parentTaskId: null,
        previousIdentifiers: [],
        sourceBadge: buildTemplateSourceBadge({
          occurrenceKey: params.occurrenceKey,
          schedule: params.schedule,
        }),
        sourceTemplateCycleId: null,
        sourceTemplateId: params.schedule.template_id,
        sourceTemplateOccurrenceKey: params.occurrenceKey,
        sourceTemplateScheduleId: params.schedule.id,
        sourceTemplateSyncEnabled: true,
        sourceTemplateTaskId: templateTask.id,
        taskState: "todo",
        teamId: effectiveTeamId,
        title: templateTask.title,
        workflowId: effectiveWorkflow.id,
        workflowStatusId: todo.id,
      };
      if (adjustment?.lifecycle === "skipped") continue;
      projected.push(applyProjectedTaskOverrides(baseProjection, overrides));
    }
  };

  for (const schedule of args.schedules) {
    if (schedule.kind !== "weekly" && schedule.kind !== "key_date") continue;
    const rule = parseJson<{
      kind?: string;
      weekdays?: readonly number[];
      keyDateId?: string;
      repeat?: string;
    }>(schedule.rule, {});
    const scheduleTasks = args.templateTasks.filter(
      (task) => task.template_id === schedule.template_id,
    );

    if (schedule.kind === "key_date") {
      if (rule.kind !== "keyDate" || !rule.keyDateId) continue;
      const keyDateSchedule = parseKeyDateSchedule(keyDatesById.get(rule.keyDateId)?.schedule);
      if (!keyDateSchedule) continue;
      for (const { occurrenceDate, occurrenceKey } of keyDateScheduleOccurrences({
        cycleEndDate: args.cycle.endDate,
        keyDateId: rule.keyDateId,
        keyDateSchedule,
        schedule,
      })) {
        projectOccurrence({
          anchorWeekday: dateWeekday(occurrenceDate),
          occurrenceDate,
          occurrenceKey,
          schedule,
          scheduleTasks,
        });
      }
      continue;
    }

    const serviceWeekday = rule.weekdays?.[0];
    if (rule.kind !== "weekly" || serviceWeekday == null) continue;
    for (
      let occurrenceDate = schedule.start_date;
      occurrenceDate <= addDays(args.cycle.endDate, 371);
      occurrenceDate = addDays(occurrenceDate, 7)
    ) {
      if (schedule.end_date && occurrenceDate > schedule.end_date) break;
      if (dateWeekday(occurrenceDate) !== serviceWeekday) continue;
      const occurrenceKey = `weekly:${occurrenceDate}:${weekdayName(serviceWeekday).toLowerCase()}`;
      projectOccurrence({
        occurrenceDate,
        occurrenceKey,
        anchorWeekday: serviceWeekday,
        schedule,
        scheduleTasks,
      });
    }
  }

  return projected;
}

const zeroMutationResult = async <Data>(
  run: () => {
    readonly server: Promise<{
      readonly type: string;
      readonly error?: { readonly message?: string };
      readonly value?: Data;
    }>;
  },
  fallbackMessage: string,
): MutationResult<Data> => {
  try {
    const result = await run().server;
    if (result.type === "error") {
      return { error: { message: result.error?.message ?? fallbackMessage }, ok: false };
    }
    return { data: result.value as Data, ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : fallbackMessage },
      ok: false,
    };
  }
};

const targetCycleToZero = (targetCycle: TargetCycleFields) => ({
  church_time_zone: targetCycle.churchTimeZone,
  end_date: targetCycle.endDate,
  ends_at: targetCycle.endsAt,
  start_date: targetCycle.startDate,
  starts_at: targetCycle.startsAt,
});

const taskFieldsToZero = (fields: TaskUpdateFields) => ({
  ...(fields.assignedUserId !== undefined ? { assigned_user_id: fields.assignedUserId } : {}),
  ...(fields.boardOrder !== undefined ? { board_order: fields.boardOrder } : {}),
  ...(fields.description !== undefined ? { description: fields.description } : {}),
  ...(fields.cycleId !== undefined ? { cycle_id: fields.cycleId } : {}),
  ...(fields.dueDate !== undefined ? { due_date: fields.dueDate } : {}),
  ...(fields.estimate !== undefined ? { estimate: fields.estimate } : {}),
  ...(fields.labelIds !== undefined ? { label_ids: [...fields.labelIds] } : {}),
  ...(fields.parentTaskId !== undefined ? { parent_task_id: fields.parentTaskId } : {}),
  ...(fields.teamId !== undefined ? { team_id: fields.teamId } : {}),
  ...(fields.title !== undefined ? { title: fields.title } : {}),
  ...(fields.targetCycle !== undefined
    ? {
        target_cycle: targetCycleToZero(fields.targetCycle),
      }
    : {}),
  ...(fields.workflowStatusId !== undefined ? { workflow_status_id: fields.workflowStatusId } : {}),
});

const taskFieldsToProjectedOverrides = (
  fields: TaskUpdateFields,
): readonly ProjectedTaskAdjustmentOverride[] => [
  ...(fields.title !== undefined ? [{ field: "title" as const, value: fields.title }] : []),
  ...(fields.description !== undefined
    ? [{ field: "description" as const, value: fields.description }]
    : []),
  ...(fields.assignedUserId !== undefined
    ? [{ field: "assignedUserId" as const, value: fields.assignedUserId }]
    : []),
  ...(fields.teamId !== undefined ? [{ field: "teamId" as const, value: fields.teamId }] : []),
  ...(fields.dueDate !== undefined && fields.dueDate !== null
    ? [{ field: "dueDate" as const, value: fields.dueDate }]
    : []),
  ...(fields.labelIds !== undefined
    ? [{ field: "labelIds" as const, value: fields.labelIds }]
    : []),
  ...(fields.estimate !== undefined
    ? [{ field: "estimate" as const, value: fields.estimate }]
    : []),
];

export function useTasksCollection(params: {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
  readonly filters?: TaskCollectionFilters;
  readonly listArgs?: ListArgs;
  readonly projectionCycle?: CycleProjectionContext | null;
}) {
  const [taskRows] = useQuery(
    queries.tasks.filtered({
      assigned_user_id:
        params.filters?.surface === "my_work" ? (params.currentUserId ?? undefined) : undefined,
      church_id: params.churchId ?? "__no_church__",
      list_args: params.listArgs ?? {},
      team_id: params.filters?.teamId,
    }),
  );
  const activeTaskRows = taskRows ?? [];
  const [teamRows] = useQuery(
    queries.teams.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [scheduleRows] = useQuery(
    queries.template_schedules.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [templateTaskRows] = useQuery(
    queries.template_tasks.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [templateTeamRows] = useQuery(
    queries.template_teams.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [keyDateRows] = useQuery(
    queries.key_dates.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [workflowRows] = useQuery(
    queries.workflows.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [workflowStatusRows] = useQuery(
    queries.workflow_statuses.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [cycleAdjustmentRows] = useQuery(
    queries.cycle_adjustments.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [labelRows] = useQuery(
    queries.labels.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const teamsById = new Map(teamRows.map((team) => [team.id, team]));
  const schedulesById = new Map(scheduleRows.map((schedule) => [schedule.id, schedule]));
  const materializedCollection =
    params.churchId === null
      ? []
      : activeTaskRows.map((task) => mapTask(task, teamsById, schedulesById));
  const projectedCollection =
    params.churchId !== null && params.projectionCycle
      ? buildProjectedTemplateTasksForCycle({
          cycle: params.projectionCycle,
          existingTasks: materializedCollection,
          keyDates: keyDateRows,
          schedules: scheduleRows,
          cycleAdjustments: cycleAdjustmentRows,
          labels: labelRows,
          teamFilterId: params.filters?.teamId,
          templateTasks: templateTaskRows,
          templateTeams: templateTeamRows,
          workflows: workflowRows,
          workflowStatuses: workflowStatusRows,
        })
      : [];
  const collection = [...materializedCollection, ...projectedCollection];

  return {
    loading: false,
    collection,
    tasksCollection: collection,
  };
}

export function useCreateTaskMutation() {
  const zero = useZero();

  return async (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly title: string;
    readonly description?: string | null;
    readonly teamId: string;
    readonly assignedUserId?: string | null;
    readonly workflowStatusId: string;
    readonly dueDate?: string | null;
    readonly parentTaskId?: string | null;
    readonly labelIds?: readonly string[];
    readonly estimate?: TaskEstimate | null;
    readonly targetCycle?: TargetCycleFields;
  }) => {
    const result = await zeroMutationResult<{
      readonly tasks: readonly { readonly id: string; readonly identifier: string }[];
    }>(
      () =>
        zero.mutate(
          mutators.tasks.create({
            assigned_user_id: params.assignedUserId ?? null,
            church_id: params.churchId,
            description: params.description ?? null,
            due_date: params.dueDate ?? null,
            estimate: params.estimate ?? null,
            label_ids: [...(params.labelIds ?? [])],
            parent_task_id: params.parentTaskId ?? null,
            ...(params.targetCycle
              ? {
                  target_cycle: targetCycleToZero(params.targetCycle),
                }
              : {}),
            team_id: params.teamId,
            title: params.title,
            workflow_status_id: params.workflowStatusId,
          }),
        ),
      "Could not create Task.",
    );
    if (!result.ok) return result;
    return { data: result.data ?? { tasks: [] }, ok: true as const };
  };
}

export function useUpdateTaskMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly taskId: string;
    readonly fields: TaskUpdateFields;
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(
          mutators.tasks.update({
            church_id: params.churchId,
            fields: taskFieldsToZero(params.fields),
            task_id: params.taskId,
          }),
        ),
      "Could not update Task.",
    );
}

export function useAdjustProjectedTemplateTaskMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly cycleId: string;
    readonly sourceTemplateScheduleId: string;
    readonly sourceTemplateOccurrenceKey: string;
    readonly sourceTemplateTaskId: string;
    readonly fields: TaskUpdateFields;
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(
          mutators.cycle_adjustments.set({
            adjustments: [
              {
                cycle_id: params.cycleId,
                lifecycle: "active",
                overrides: taskFieldsToProjectedOverrides(params.fields),
                source_template_occurrence_key: params.sourceTemplateOccurrenceKey,
                source_template_schedule_id: params.sourceTemplateScheduleId,
                template_task_id: params.sourceTemplateTaskId,
              },
            ],
            church_id: params.churchId,
          }),
        ),
      "Could not adjust projected Template Task.",
    );
}

export function useMaterializeProjectedTemplateTaskMutation() {
  const zero = useZero();

  return (params: { readonly task: TaskCollectionItem; readonly workflowStatusId: string }) =>
    zeroMutationResult(
      () =>
        zero.mutate(
          mutators.tasks.materialize_projected({
            assigned_user_id: params.task.assignedUserId,
            church_id: params.task.churchId,
            cycle_id: params.task.cycleId ?? "",
            description: params.task.description,
            due_date: params.task.dueDate,
            estimate: params.task.estimate,
            label_ids: [...params.task.labelIds],
            source_template_id: params.task.sourceTemplateId ?? "",
            source_template_occurrence_key: params.task.sourceTemplateOccurrenceKey ?? "",
            source_template_schedule_id: params.task.sourceTemplateScheduleId ?? "",
            source_template_task_id: params.task.sourceTemplateTaskId ?? "",
            team_id: params.task.teamId,
            title: params.task.title,
            workflow_status_id: params.workflowStatusId,
          }),
        ),
      "Could not materialize projected Template Task.",
    );
}

export function useUpdateTasksBatchMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly updates: readonly { readonly taskId: string; readonly fields: TaskUpdateFields }[];
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(
          mutators.tasks.update_batch({
            church_id: params.churchId,
            updates: params.updates.map((update) => ({
              fields: taskFieldsToZero(update.fields),
              task_id: update.taskId,
            })),
          }),
        ),
      "Could not update Tasks.",
    );
}

export function useCompleteTaskMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly taskId: string;
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(
          mutators.tasks.complete({ church_id: params.churchId, task_id: params.taskId }),
        ),
      "Could not complete Task.",
    );
}

export function useCancelTaskMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly taskId: string;
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(mutators.tasks.cancel({ church_id: params.churchId, task_id: params.taskId })),
      "Could not cancel Task.",
    );
}

export function useReopenTaskMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly actorUserId: string | null;
    readonly taskId: string;
  }) =>
    zeroMutationResult(
      () =>
        zero.mutate(mutators.tasks.reopen({ church_id: params.churchId, task_id: params.taskId })),
      "Could not reopen Task.",
    );
}
