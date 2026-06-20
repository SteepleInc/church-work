import { mutators, queries } from "@church-task/zero";
import type { TemplateScheduleContract, TemplateScheduleRule } from "@church-task/domain";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useCallback } from "react";

export type TemplateCollectionItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly placementShape: string | null;
  readonly recurrence: string;
  readonly scheduleCount: number;
  readonly taskCount: number;
};

type TemplateMutationResult = Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: { readonly message: string } }
>;

export type DeleteTemplateScheduleOptions = {
  readonly cleanupCurrentOccurrence: boolean;
  readonly currentDate: string;
  readonly currentOccurrenceKey: string | null;
};

type TemplateTaskInput = {
  readonly assignedUserId: string | null;
  readonly description: string | null;
  readonly estimate: string | null;
  readonly key: string;
  readonly labelIds: readonly string[];
  readonly placementCycleOffset: number;
  readonly placementWeekday: number;
  readonly templateTeamKey: string;
  readonly title: string;
};

type PeriodTemplateShape = "monthly" | "quarterly" | "yearly";

type PeriodTemplateScheduleRule = Extract<
  TemplateScheduleRule,
  { readonly kind: PeriodTemplateShape }
>;
type PeriodTemplateScheduleDefaults = Pick<TemplateScheduleContract, "recurrence"> & {
  readonly rule: PeriodTemplateScheduleRule;
};

const mutationResult = async (
  run: () => {
    readonly server: Promise<
      | { readonly type: "success" }
      | { readonly type: "error"; readonly error: { readonly message: string } }
    >;
  },
): TemplateMutationResult => {
  try {
    const result = await run().server;
    if (result.type === "error") return { error: { message: result.error.message }, ok: false };
    return { ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not create Template." },
      ok: false,
    };
  }
};

const mondayFirstPosition = (weekday: number) => (weekday + 6) % 7;

const cycleDayOffset = (params: {
  readonly placementWeekday: number;
  readonly serviceWeekday: number;
}) => mondayFirstPosition(params.placementWeekday) - mondayFirstPosition(params.serviceWeekday);

export type TemplateScheduleCollectionItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly recurrence: string;
  readonly nextOccurrence: string | null;
  /**
   * The occurrence key for this Schedule's next/current occurrence, matching the
   * projection key format the cleanup mutator scopes by. Null when the Schedule
   * has no upcoming occurrence or uses a Cadence the cleanup prompt cannot scope
   * (so the cleanup toggle is hidden rather than silently a no-op).
   */
  readonly currentOccurrenceKey: string | null;
  readonly recentUsage: string;
};

const WEEKDAY_KEY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const scheduleOccurrenceKey = (params: {
  readonly kind: string;
  readonly occurrenceDate: string | null;
}): string | null => {
  if (!params.occurrenceDate) return null;
  const weekday = new Date(`${params.occurrenceDate}T00:00:00.000Z`).getUTCDay();
  switch (params.kind) {
    case "weekly":
      return `weekly:${params.occurrenceDate}:${WEEKDAY_KEY_NAMES[weekday]}`;
    default:
      return null;
  }
};

type TemplateRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly recurrence: string;
  readonly placement_shape?: string | null;
};

type TemplateScheduleRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly template_id: string;
  readonly kind: string;
  readonly recurrence: string;
  readonly start_date: string;
  readonly end_date?: string | null;
};

type TemplateTaskRow = { readonly template_id: string };

const NO_CHURCH_ID = "__no_church__";

export const templateScheduleKindLabel = (kind: string): string => {
  switch (kind) {
    case "key_date":
      return "Key Date";
    case "monthly":
      return "Monthly";
    case "one_off":
      return "One-off";
    case "quarterly":
      return "Quarterly";
    case "weekly":
      return "Weekly";
    case "yearly":
      return "Yearly";
    default:
      return kind.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
  }
};

export const formatTemplateScheduleOccurrence = (localDate: string | null): string => {
  if (!localDate) return "—";
  const parsed = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
};

export function buildTemplatesCollection(params: {
  readonly templates: readonly TemplateRow[];
  readonly schedules: readonly TemplateScheduleRow[];
  readonly tasks: readonly TemplateTaskRow[];
}): readonly TemplateCollectionItem[] {
  const scheduleCounts = new Map<string, number>();
  const taskCounts = new Map<string, number>();
  for (const schedule of params.schedules) {
    scheduleCounts.set(schedule.template_id, (scheduleCounts.get(schedule.template_id) ?? 0) + 1);
  }
  for (const task of params.tasks) {
    taskCounts.set(task.template_id, (taskCounts.get(task.template_id) ?? 0) + 1);
  }

  return params.templates.map((template) => ({
    id: template.id,
    key: template.key,
    name: template.name,
    placementShape: template.placement_shape ?? null,
    recurrence: template.recurrence,
    scheduleCount: scheduleCounts.get(template.id) ?? 0,
    taskCount: taskCounts.get(template.id) ?? 0,
  }));
}

export function buildTemplateSchedulesCollection(params: {
  readonly templates: readonly TemplateRow[];
  readonly schedules: readonly TemplateScheduleRow[];
  readonly today?: string;
}): readonly TemplateScheduleCollectionItem[] {
  const templatesById = new Map(params.templates.map((template) => [template.id, template.name]));
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  return params.schedules.map((schedule) => {
    const nextOccurrence =
      schedule.end_date && schedule.end_date < today
        ? null
        : schedule.start_date >= today
          ? schedule.start_date
          : null;
    return {
      currentOccurrenceKey: scheduleOccurrenceKey({
        kind: schedule.kind,
        occurrenceDate: nextOccurrence,
      }),
      id: schedule.id,
      key: schedule.key,
      kind: schedule.kind,
      kindLabel: templateScheduleKindLabel(schedule.kind),
      name: schedule.name,
      nextOccurrence,
      recentUsage: "Usage history coming soon",
      recurrence: schedule.recurrence,
      templateId: schedule.template_id,
      templateName: templatesById.get(schedule.template_id) ?? "Unknown Template",
    };
  });
}

export function useTemplatesCollection(params: { readonly churchId: string | null }) {
  const queryChurchId = params.churchId ?? NO_CHURCH_ID;
  const [templateRows, templatesResult] = useQuery(
    queries.templates.by_church({ church_id: queryChurchId }),
  );
  const [scheduleRows, schedulesResult] = useQuery(
    queries.template_schedules.by_church({ church_id: queryChurchId }),
  );
  const [taskRows, tasksResult] = useQuery(
    queries.template_tasks.by_church({ church_id: queryChurchId }),
  );
  const collection = params.churchId
    ? buildTemplatesCollection({
        schedules: scheduleRows,
        tasks: taskRows,
        templates: templateRows,
      })
    : [];

  return {
    collection,
    loading:
      params.churchId !== null &&
      (templatesResult.type !== "complete" ||
        schedulesResult.type !== "complete" ||
        tasksResult.type !== "complete"),
    templatesCollection: collection,
  };
}

export function useCreateWeeklyServiceTemplate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly key: string;
      readonly name: string;
      readonly serviceWeekday: number;
      readonly startDate: string;
      readonly schedule: boolean;
      readonly tasks: readonly TemplateTaskInput[];
      readonly templateTeams: readonly {
        readonly key: string;
        readonly mapped_team_id: string;
        readonly name: string;
      }[];
    }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.templates.create({
            church_id: params.churchId,
            focus_windows: [],
            key: params.key,
            name: params.name,
            placement_shape: "weekly_service",
            recurrence: "weekly",
            template_schedule: params.schedule
              ? {
                  end_date: null,
                  key: `${params.key}-schedule`,
                  kind: "weekly",
                  name: params.name,
                  recurrence: "repeating",
                  rule: { kind: "weekly", weekdays: [params.serviceWeekday] },
                  start_date: params.startDate,
                }
              : null,
            template_tasks: params.tasks.map((task) => ({
              assigned_user_id: task.assignedUserId,
              description: task.description,
              estimate: task.estimate,
              key: task.key,
              label_ids: [...task.labelIds],
              parent_template_task_key: null,
              placement_cycle_offset: task.placementCycleOffset,
              placement_weekday: task.placementWeekday,
              scheduling_rule: {
                baseLocalDate: params.startDate,
                dayOffset: cycleDayOffset({
                  placementWeekday: task.placementWeekday,
                  serviceWeekday: params.serviceWeekday,
                }),
                kind: "cycleOffset",
                offsetCycles: task.placementCycleOffset,
              },
              template_team_key: task.templateTeamKey,
              title: task.title,
            })),
            template_teams: [...params.templateTeams],
          }),
        ),
      ),
    [zero],
  );
}

export function useCreatePeriodTemplate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly key: string;
      readonly name: string;
      readonly periodStartDate: string;
      readonly schedule: boolean;
      readonly scheduleDefaults: PeriodTemplateScheduleDefaults;
      readonly shape: PeriodTemplateShape;
      readonly tasks: readonly TemplateTaskInput[];
      readonly templateTeams: readonly {
        readonly key: string;
        readonly mapped_team_id: string;
        readonly name: string;
      }[];
    }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.templates.create({
            church_id: params.churchId,
            focus_windows: [],
            key: params.key,
            name: params.name,
            placement_shape: params.shape,
            recurrence: params.scheduleDefaults.rule.kind,
            template_schedule: params.schedule
              ? {
                  end_date: null,
                  key: `${params.key}-schedule`,
                  kind: params.shape,
                  name: params.name,
                  recurrence: params.scheduleDefaults.recurrence,
                  rule: params.scheduleDefaults.rule,
                  start_date: params.periodStartDate,
                }
              : null,
            template_tasks: params.tasks.map((task) => ({
              assigned_user_id: task.assignedUserId,
              description: task.description,
              estimate: task.estimate,
              key: task.key,
              label_ids: [...task.labelIds],
              parent_template_task_key: null,
              placement_cycle_offset: task.placementCycleOffset,
              placement_weekday: task.placementWeekday,
              scheduling_rule: {
                baseLocalDate: params.periodStartDate,
                dayOffset: task.placementWeekday,
                kind: "cycleOffset",
                offsetCycles: task.placementCycleOffset,
              },
              template_team_key: task.templateTeamKey,
              title: task.title,
            })),
            template_teams: [...params.templateTeams],
          }),
        ),
      ),
    [zero],
  );
}

export function useCreateKeyDateTemplate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly key: string;
      readonly name: string;
      readonly keyDateId: string;
      readonly occurrenceDate: string;
      readonly repeatYearly: boolean;
      readonly tasks: readonly TemplateTaskInput[];
      readonly templateTeams: readonly {
        readonly key: string;
        readonly mapped_team_id: string;
        readonly name: string;
      }[];
    }) => {
      const occurrenceWeekday = new Date(`${params.occurrenceDate}T00:00:00.000Z`).getUTCDay();
      return mutationResult(() =>
        zero.mutate(
          mutators.templates.create({
            church_id: params.churchId,
            focus_windows: [
              {
                anchor_date: params.occurrenceDate,
                end_date: params.occurrenceDate,
                key: `${params.key}-key-date`,
                key_date_id: params.keyDateId,
                name: params.name,
                start_date: params.occurrenceDate,
                type: "key_date",
              },
            ],
            key: params.key,
            name: params.name,
            placement_shape: "key_date",
            recurrence: params.repeatYearly ? "yearly" : "one_off",
            template_schedule: {
              end_date: params.repeatYearly ? null : params.occurrenceDate,
              key: `${params.key}-schedule`,
              kind: "key_date",
              name: params.name,
              recurrence: params.repeatYearly ? "repeating" : "oneOff",
              rule: {
                keyDateId: params.keyDateId,
                kind: "keyDate",
                repeat: params.repeatYearly ? "yearly" : "none",
              },
              start_date: params.occurrenceDate,
            },
            template_tasks: params.tasks.map((task) => ({
              assigned_user_id: task.assignedUserId,
              description: task.description,
              estimate: task.estimate,
              key: task.key,
              label_ids: [...task.labelIds],
              parent_template_task_key: null,
              placement_cycle_offset: task.placementCycleOffset,
              placement_weekday: task.placementWeekday,
              scheduling_rule: {
                baseLocalDate: params.occurrenceDate,
                dayOffset: cycleDayOffset({
                  placementWeekday: task.placementWeekday,
                  serviceWeekday: occurrenceWeekday,
                }),
                kind: "cycleOffset",
                offsetCycles: task.placementCycleOffset,
              },
              template_team_key: task.templateTeamKey,
              title: task.title,
            })),
            template_teams: [...params.templateTeams],
          }),
        ),
      );
    },
    [zero],
  );
}

export function useTemplateSchedulesCollection(params: { readonly churchId: string | null }) {
  const queryChurchId = params.churchId ?? NO_CHURCH_ID;
  const [templateRows, templatesResult] = useQuery(
    queries.templates.by_church({ church_id: queryChurchId }),
  );
  const [scheduleRows, schedulesResult] = useQuery(
    queries.template_schedules.by_church({ church_id: queryChurchId }),
  );
  const collection = params.churchId
    ? buildTemplateSchedulesCollection({ schedules: scheduleRows, templates: templateRows })
    : [];

  return {
    collection,
    loading:
      params.churchId !== null &&
      (templatesResult.type !== "complete" || schedulesResult.type !== "complete"),
    templateSchedulesCollection: collection,
  };
}

export function useTemplateSoftDeleteActions() {
  const zero = useZero();
  return {
    deleteTemplate: useCallback(
      (params: { readonly churchId: string; readonly templateId: string }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.templates.delete({ church_id: params.churchId, id: params.templateId }),
          ),
        ),
      [zero],
    ),
    deleteTemplateSchedule: useCallback(
      (params: {
        readonly churchId: string;
        readonly scheduleId: string;
        readonly options: DeleteTemplateScheduleOptions;
      }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.template_schedules.delete({
              church_id: params.churchId,
              cleanup_current_occurrence: params.options.cleanupCurrentOccurrence,
              current_date: params.options.currentDate,
              current_occurrence_key: params.options.currentOccurrenceKey,
              id: params.scheduleId,
            }),
          ),
        ),
      [zero],
    ),
    deleteTemplateTask: useCallback(
      (params: { readonly churchId: string; readonly templateTaskId: string }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.template_tasks.delete({
              church_id: params.churchId,
              id: params.templateTaskId,
            }),
          ),
        ),
      [zero],
    ),
    restoreTemplate: useCallback(
      (params: { readonly churchId: string; readonly templateId: string }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.templates.restore({ church_id: params.churchId, id: params.templateId }),
          ),
        ),
      [zero],
    ),
    restoreTemplateSchedule: useCallback(
      (params: { readonly churchId: string; readonly scheduleId: string }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.template_schedules.restore({
              church_id: params.churchId,
              id: params.scheduleId,
            }),
          ),
        ),
      [zero],
    ),
    restoreTemplateTask: useCallback(
      (params: { readonly churchId: string; readonly templateTaskId: string }) =>
        mutationResult(() =>
          zero.mutate(
            mutators.template_tasks.restore({
              church_id: params.churchId,
              id: params.templateTaskId,
            }),
          ),
        ),
      [zero],
    ),
  };
}

export function useDuplicateTemplateAction() {
  const zero = useZero();
  return useCallback(
    (params: { readonly churchId: string; readonly templateId: string }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.templates.duplicate({
            church_id: params.churchId,
            template_id: params.templateId,
          }),
        ),
      ),
    [zero],
  );
}
