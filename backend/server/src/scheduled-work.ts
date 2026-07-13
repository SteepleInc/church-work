import {
  addLocalDateDays,
  assertValidTimeZone,
  cycleStartDateForLocalDate,
  localDateForInstant,
  localMidnightToUtcInstant,
} from "@church-work/domain";
import { getActivityId, getCycleId } from "@church-work/shared/get-ids";
import { buildTemplateCycleTaskInserts } from "@church-work/zero";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { Cause, DateTime, Effect, Exit } from "effect";

import {
  activities,
  cycle_adjustments,
  cycles,
  focus_windows,
  key_date_occurrences,
  organization,
  tasks,
  teams,
  template_tasks,
  template_teams,
  template_schedules,
  templates,
  workflow_statuses,
  workflows,
} from "@church-work/db/schema";

import type { ChurchWorkDb } from "@church-work/db";

export const sundayCycleMaintenanceCron = "0 8 * * 0";

type DbTransaction = Parameters<Parameters<ChurchWorkDb["transaction"]>[0]>[0];
type DbExecutor = ChurchWorkDb | DbTransaction;
const MATERIALIZATION_WINDOW_MIN_CYCLES = 1;
const MATERIALIZATION_WINDOW_MAX_CYCLES = 52;
const MATERIALIZATION_WINDOW_DEFAULT_CYCLES = 3;

export const normalizeMaterializationWindowCycles = (value: number | null | undefined) => {
  const cycles = value ?? MATERIALIZATION_WINDOW_DEFAULT_CYCLES;
  if (!Number.isFinite(cycles)) return MATERIALIZATION_WINDOW_DEFAULT_CYCLES;

  return Math.max(
    MATERIALIZATION_WINDOW_MIN_CYCLES,
    Math.min(MATERIALIZATION_WINDOW_MAX_CYCLES, Math.trunc(cycles)),
  );
};

const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dateWeekday = (localDate: string) => {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
const mondayFirstPosition = (weekday: number) => (weekday + 6) % 7;
const addDaysUntilWeekday = (localDate: string, weekday: number) =>
  addLocalDateDays(localDate, (weekday - dateWeekday(localDate) + 7) % 7);

const groupByCycleStartDate = <Task extends { readonly due_date: string }>(
  tasks: readonly Task[],
) => {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const cycleStartDate = cycleStartDateForLocalDate(task.due_date);
    groups.set(cycleStartDate, [...(groups.get(cycleStartDate) ?? []), task]);
  }
  return groups;
};

const parseWeeklyScheduleRule = (ruleJson: string): number | null => {
  try {
    const rule = JSON.parse(ruleJson || "{}") as { kind?: string; weekdays?: readonly number[] };
    const serviceWeekday = rule.weekdays?.[0];
    if (rule.kind !== "weekly") return null;
    if (!Number.isInteger(serviceWeekday)) return null;
    if (serviceWeekday === undefined || serviceWeekday < 0 || serviceWeekday > 6) return null;
    return serviceWeekday;
  } catch {
    return null;
  }
};

type ScheduledExistingProjectedTask = {
  readonly id: string;
  readonly source_template_occurrence_key: string | null;
  readonly source_template_schedule_id: string | null;
  readonly source_template_task_id: string;
};

const hasSourceTemplateTaskId = (task: {
  readonly id: string;
  readonly source_template_occurrence_key: string | null;
  readonly source_template_schedule_id: string | null;
  readonly source_template_task_id: string | null;
}): task is ScheduledExistingProjectedTask => task.source_template_task_id !== null;

type CycleMaintenanceResult = {
  readonly createdCycleIds: readonly string[];
  readonly ensuredCycleIds: readonly string[];
  readonly materializedTaskIds: readonly string[];
  readonly rolledOverTaskIds: readonly string[];
};

export type RolloverMaintenanceFailure = {
  readonly churchId: string;
  readonly error: string;
};

export type ScheduledCycleMaintenanceResult = {
  readonly failed: number;
  readonly failures: readonly RolloverMaintenanceFailure[];
  readonly maintainedChurchIds: readonly string[];
  readonly resultsByChurchId: Readonly<Record<string, CycleMaintenanceResult>>;
  readonly scanned: number;
  readonly skipped: number;
  readonly succeeded: number;
};

export const isRolloverMaintenanceDue = (args: {
  readonly completed_cycle_start_date: string | null;
  readonly completed_cycle_ends_at: Date | null;
  readonly now: Date;
}) =>
  args.completed_cycle_start_date === null ||
  args.completed_cycle_ends_at === null ||
  args.now >= args.completed_cycle_ends_at;

export const buildCycleForLocalDate = (args: {
  readonly churchTimeZone: string;
  readonly localDate: string;
}) => {
  assertValidTimeZone(args.churchTimeZone);
  const startDate = cycleStartDateForLocalDate(args.localDate);
  const endDate = addLocalDateDays(startDate, 6);

  return {
    church_time_zone: args.churchTimeZone,
    end_date: endDate,
    ends_at: localMidnightToUtcInstant(addLocalDateDays(startDate, 7), args.churchTimeZone),
    start_date: startDate,
    starts_at: localMidnightToUtcInstant(startDate, args.churchTimeZone),
  };
};

export const buildCycleForInstant = (args: {
  readonly churchTimeZone: string;
  readonly instant: Date;
}) =>
  buildCycleForLocalDate({
    churchTimeZone: args.churchTimeZone,
    localDate: localDateForInstant(args.instant, args.churchTimeZone),
  });

const writeSystemActivity = (
  db: DbExecutor,
  args: {
    readonly church_id: string;
    readonly cycle_id?: string | null;
    readonly entity_id: string;
    readonly entity_type: string;
    readonly event_type: string;
    readonly metadata?: unknown;
    readonly occurred_at: Date;
  },
) =>
  db.insert(activities).values({
    _tag: "activity",
    actor_id: null,
    actor_type: "system",
    church_id: args.church_id,
    created_by: null,
    cycle_id: args.cycle_id ?? null,
    entity_id: args.entity_id,
    entity_type: args.entity_type,
    event_type: args.event_type,
    id: getActivityId(),
    metadata: JSON.stringify(args.metadata ?? {}),
    occurred_at: args.occurred_at,
    updated_by: null,
  });

const ensureCycle = async (
  db: DbExecutor,
  args: {
    readonly church_id: string;
    readonly church_time_zone: string;
    readonly local_date: string;
  },
) => {
  const cycleFields = buildCycleForLocalDate({
    churchTimeZone: args.church_time_zone,
    localDate: args.local_date,
  });
  const [existing] = await db
    .select()
    .from(cycles)
    .where(
      and(
        eq(cycles.church_id, args.church_id),
        eq(cycles.start_date, cycleFields.start_date),
        isNull(cycles.deleted_at),
      ),
    )
    .limit(1);

  if (existing) return { created: false as const, cycle: existing };

  const [created] = await db
    .insert(cycles)
    .values({
      ...cycleFields,
      _tag: "cycle",
      church_id: args.church_id,
      created_by: null,
      id: getCycleId(),
      updated_by: null,
    })
    .onConflictDoNothing({
      target: [cycles.church_id, cycles.start_date],
      where: sql`${cycles.deleted_at} IS NULL`,
    })
    .returning();

  if (!created) {
    const [conflicted] = await db
      .select()
      .from(cycles)
      .where(
        and(
          eq(cycles.church_id, args.church_id),
          eq(cycles.start_date, cycleFields.start_date),
          isNull(cycles.deleted_at),
        ),
      )
      .limit(1);
    if (conflicted) return { created: false as const, cycle: conflicted };
    throw new Error("Cycle creation did not return a row.");
  }
  return { created: true as const, cycle: created };
};

const materializeLegacyTemplateCycleTasks = async (
  db: DbExecutor,
  args: {
    readonly church_id: string;
    readonly cycle: typeof cycles.$inferSelect;
    readonly now: Date;
  },
) => {
  const templateRows = await db
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.church_id, args.church_id), isNull(templates.deleted_at)));
  const createdTaskIds: string[] = [];

  for (const template of templateRows) {
    const templateTaskRows = await db
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
          eq(template_tasks.church_id, args.church_id),
          eq(template_tasks.template_id, template.id),
          isNull(template_tasks.deleted_at),
        ),
      );
    if (templateTaskRows.length === 0) continue;

    const templateTeamRows = await db
      .select({ id: template_teams.id, mapped_team_id: template_teams.mapped_team_id })
      .from(template_teams)
      .where(
        and(
          eq(template_teams.church_id, args.church_id),
          eq(template_teams.template_id, template.id),
          isNull(template_teams.deleted_at),
        ),
      );
    const focusWindowRows = await db
      .select({
        anchor_date: focus_windows.anchor_date,
        end_date: focus_windows.end_date,
        id: focus_windows.id,
        start_date: focus_windows.start_date,
      })
      .from(focus_windows)
      .where(
        and(
          eq(focus_windows.church_id, args.church_id),
          eq(focus_windows.template_id, template.id),
          isNull(focus_windows.deleted_at),
        ),
      );
    const keyDateOccurrenceRows = await db
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
      );
    const adjustmentRows = await db
      .select({
        lifecycle: cycle_adjustments.lifecycle,
        overrides: cycle_adjustments.overrides,
        template_task_id: cycle_adjustments.template_task_id,
      })
      .from(cycle_adjustments)
      .where(
        and(
          eq(cycle_adjustments.church_id, args.church_id),
          eq(cycle_adjustments.cycle_id, args.cycle.id),
          isNull(cycle_adjustments.source_template_schedule_id),
          isNull(cycle_adjustments.deleted_at),
        ),
      );
    const existingProjectedTasks = await db
      .select({ id: tasks.id, source_template_task_id: tasks.source_template_task_id })
      .from(tasks)
      .where(
        and(
          eq(tasks.church_id, args.church_id),
          eq(tasks.source_template_id, template.id),
          eq(tasks.source_template_cycle_id, args.cycle.id),
          isNull(tasks.source_template_schedule_id),
          isNull(tasks.deleted_at),
        ),
      );
    const mappedTeamIds = templateTeamRows.map((templateTeam) => templateTeam.mapped_team_id);
    const teamRows =
      mappedTeamIds.length === 0
        ? []
        : await db
            .select({ id: teams.id, next_task_number: teams.next_task_number })
            .from(teams)
            .where(
              and(
                eq(teams.church_id, args.church_id),
                inArray(teams.id, mappedTeamIds),
                isNull(teams.deleted_at),
              ),
            );
    const taskNumberRows =
      mappedTeamIds.length === 0
        ? []
        : await db
            .select({
              max_number: sql<number | null>`max(${tasks.number})`,
              team_id: tasks.team_id,
            })
            .from(tasks)
            .where(
              and(
                eq(tasks.church_id, args.church_id),
                inArray(tasks.team_id, mappedTeamIds),
                isNull(tasks.deleted_at),
              ),
            )
            .groupBy(tasks.team_id);
    const highestTaskNumberByTeamId = new Map(
      taskNumberRows.map((row) => [row.team_id, row.max_number ?? 0]),
    );
    const startNumberByTeamId = new Map(
      teamRows.map((team) => [
        team.id,
        Math.max(team.next_task_number, (highestTaskNumberByTeamId.get(team.id) ?? 0) + 1),
      ]),
    );
    const workflowRows =
      mappedTeamIds.length === 0
        ? []
        : await db
            .select({ id: workflows.id, team_id: workflows.team_id })
            .from(workflows)
            .where(
              and(
                eq(workflows.church_id, args.church_id),
                inArray(workflows.team_id, mappedTeamIds),
                isNull(workflows.deleted_at),
              ),
            );
    const statusRows = await db
      .select({ id: workflow_statuses.id, workflow_id: workflow_statuses.workflow_id })
      .from(workflow_statuses)
      .where(
        and(
          eq(workflow_statuses.church_id, args.church_id),
          eq(workflow_statuses.task_state, "todo"),
          isNull(workflow_statuses.deleted_at),
        ),
      );

    const projection = buildTemplateCycleTaskInserts({
      adjustments: adjustmentRows,
      church_id: args.church_id,
      cycle: args.cycle,
      existing_projected_tasks: existingProjectedTasks.filter(
        (task): task is { readonly id: string; readonly source_template_task_id: string } =>
          task.source_template_task_id !== null,
      ),
      focus_windows: focusWindowRows,
      key_date_occurrences: keyDateOccurrenceRows,
      now: args.now,
      session_user_id: "system",
      start_number_by_team_id: startNumberByTeamId,
      template_id: template.id,
      template_tasks: templateTaskRows,
      template_teams: templateTeamRows,
      todo_status_by_workflow_id: new Map(statusRows.map((status) => [status.workflow_id, status])),
      workflow_by_team_id: new Map(workflowRows.map((workflow) => [workflow.team_id, workflow])),
    });

    const systemInserts = projection.inserts.map((insert) => ({
      ...insert,
      created_by: null,
      created_by_user_id: null,
      updated_by: null,
    }));
    if (systemInserts.length > 0) await db.insert(tasks).values(systemInserts);

    for (const task of systemInserts) {
      await writeSystemActivity(db, {
        church_id: args.church_id,
        cycle_id: args.cycle.id,
        entity_id: task.id,
        entity_type: "task",
        event_type: "task.template_synced",
        metadata: {
          source_template_cycle_id: args.cycle.id,
          template_id: template.id,
          template_task_id: task.source_template_task_id,
        },
        occurred_at: args.now,
      });
      createdTaskIds.push(task.id);
    }

    for (const [team_id, next_task_number] of projection.nextNumberByTeamId.entries()) {
      await db
        .update(teams)
        .set({ next_task_number, updated_at: args.now, updated_by: null })
        .where(eq(teams.id, team_id));
    }
  }

  return createdTaskIds;
};

const materializeScheduledTemplateTasksForWindow = async (
  db: DbExecutor,
  args: {
    readonly church_id: string;
    readonly church_time_zone: string;
    readonly current_cycle_start_date: string;
    readonly now: Date;
    readonly window_cycles: number;
  },
) => {
  const windowEndDate = addLocalDateDays(args.current_cycle_start_date, args.window_cycles * 7 - 1);
  const scheduleRows = await db
    .select()
    .from(template_schedules)
    .where(
      and(eq(template_schedules.church_id, args.church_id), isNull(template_schedules.deleted_at)),
    );
  const createdTaskIds: string[] = [];

  for (const schedule of scheduleRows) {
    if (schedule.kind !== "weekly") continue;
    const serviceWeekday = parseWeeklyScheduleRule(schedule.rule);
    if (serviceWeekday === null) continue;

    for (
      let occurrenceDate = addDaysUntilWeekday(schedule.start_date, serviceWeekday);
      occurrenceDate <= addLocalDateDays(windowEndDate, 371);
      occurrenceDate = addLocalDateDays(occurrenceDate, 7)
    ) {
      if (schedule.end_date && occurrenceDate > schedule.end_date) break;

      const templateTaskRows = await db
        .select({
          assigned_user_id: template_tasks.assigned_user_id,
          description: template_tasks.description,
          estimate: template_tasks.estimate,
          id: template_tasks.id,
          key: template_tasks.key,
          label_ids: template_tasks.label_ids,
          parent_template_task_id: template_tasks.parent_template_task_id,
          placement_cycle_offset: template_tasks.placement_cycle_offset,
          placement_weekday: template_tasks.placement_weekday,
          priority: template_tasks.priority,
          scheduling_rule: template_tasks.scheduling_rule,
          template_team_id: template_tasks.template_team_id,
          title: template_tasks.title,
        })
        .from(template_tasks)
        .where(
          and(
            eq(template_tasks.church_id, args.church_id),
            eq(template_tasks.template_id, schedule.template_id),
            isNull(template_tasks.deleted_at),
          ),
        );
      const effectiveTemplateTasks = templateTaskRows
        .map((task) => {
          const placementCycleOffset = task.placement_cycle_offset ?? 0;
          const placementWeekday = task.placement_weekday ?? serviceWeekday;
          const dueDate = addLocalDateDays(
            occurrenceDate,
            placementCycleOffset * 7 +
              (mondayFirstPosition(placementWeekday) - mondayFirstPosition(serviceWeekday)),
          );
          return {
            ...task,
            due_date: dueDate,
            scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: dueDate }),
          };
        })
        .filter(
          (task) =>
            task.due_date >= args.current_cycle_start_date && task.due_date <= windowEndDate,
        );
      if (effectiveTemplateTasks.length === 0) continue;

      const effectiveTemplateTasksByCycleStartDate = groupByCycleStartDate(effectiveTemplateTasks);

      const templateTeamRows = await db
        .select({ id: template_teams.id, mapped_team_id: template_teams.mapped_team_id })
        .from(template_teams)
        .where(
          and(
            eq(template_teams.church_id, args.church_id),
            eq(template_teams.template_id, schedule.template_id),
            isNull(template_teams.deleted_at),
          ),
        );
      const mappedTeamIds = templateTeamRows.map((templateTeam) => templateTeam.mapped_team_id);
      if (mappedTeamIds.length === 0) continue;
      const existingProjectedTasks = await db
        .select({
          id: tasks.id,
          source_template_occurrence_key: tasks.source_template_occurrence_key,
          source_template_schedule_id: tasks.source_template_schedule_id,
          source_template_task_id: tasks.source_template_task_id,
        })
        .from(tasks)
        .where(and(eq(tasks.church_id, args.church_id), isNull(tasks.deleted_at)));
      const teamRows = await db
        .select({ id: teams.id, next_task_number: teams.next_task_number })
        .from(teams)
        .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)));
      const workflowRows = await db
        .select({ id: workflows.id, team_id: workflows.team_id })
        .from(workflows)
        .where(and(eq(workflows.church_id, args.church_id), isNull(workflows.deleted_at)));
      const statusRows = await db
        .select({ id: workflow_statuses.id, workflow_id: workflow_statuses.workflow_id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.church_id, args.church_id),
            eq(workflow_statuses.task_state, "todo"),
            isNull(workflow_statuses.deleted_at),
          ),
        );
      const occurrenceKey = `weekly:${occurrenceDate}:${weekdayNames[serviceWeekday]}`;
      let nextNumberByTeamId = new Map(teamRows.map((team) => [team.id, team.next_task_number]));
      for (const [cycleStartDate, cycleTemplateTasks] of effectiveTemplateTasksByCycleStartDate) {
        const cycle = await ensureCycle(db, {
          church_id: args.church_id,
          church_time_zone: args.church_time_zone,
          local_date: cycleStartDate,
        });
        const adjustmentRows = await db
          .select({
            lifecycle: cycle_adjustments.lifecycle,
            overrides: cycle_adjustments.overrides,
            template_task_id: cycle_adjustments.template_task_id,
          })
          .from(cycle_adjustments)
          .where(
            and(
              eq(cycle_adjustments.church_id, args.church_id),
              eq(cycle_adjustments.cycle_id, cycle.cycle.id),
              eq(cycle_adjustments.source_template_schedule_id, schedule.id),
              eq(cycle_adjustments.source_template_occurrence_key, occurrenceKey),
              isNull(cycle_adjustments.deleted_at),
            ),
          );
        const projection = buildTemplateCycleTaskInserts({
          adjustments: adjustmentRows,
          church_id: args.church_id,
          cycle: cycle.cycle,
          existing_projected_tasks: existingProjectedTasks.filter(hasSourceTemplateTaskId),
          focus_windows: [],
          key_date_occurrences: [],
          now: args.now,
          session_user_id: "system",
          source_template_occurrence_key: occurrenceKey,
          source_template_schedule_id: schedule.id,
          start_number_by_team_id: nextNumberByTeamId,
          template_id: schedule.template_id,
          template_tasks: cycleTemplateTasks,
          template_teams: templateTeamRows,
          todo_status_by_workflow_id: new Map(
            statusRows.map((status) => [status.workflow_id, status]),
          ),
          workflow_by_team_id: new Map(
            workflowRows.map((workflow) => [workflow.team_id, workflow]),
          ),
        });
        nextNumberByTeamId = projection.nextNumberByTeamId;
        const systemInserts = projection.inserts.map((insert) => ({
          ...insert,
          created_by: null,
          created_by_user_id: null,
          updated_by: null,
        }));
        if (systemInserts.length > 0) await db.insert(tasks).values(systemInserts);
        for (const task of systemInserts) {
          await writeSystemActivity(db, {
            church_id: args.church_id,
            cycle_id: cycle.cycle.id,
            entity_id: task.id,
            entity_type: "task",
            event_type: "task.template_materialized",
            metadata: {
              cycle_id: cycle.cycle.id,
              source_template_occurrence_key: occurrenceKey,
              source_template_schedule_id: schedule.id,
              template_id: schedule.template_id,
              template_task_id: task.source_template_task_id,
            },
            occurred_at: args.now,
          });
        }
        createdTaskIds.push(...systemInserts.map((task) => task.id));
      }
      for (const [team_id, next_task_number] of nextNumberByTeamId.entries()) {
        await db
          .update(teams)
          .set({ next_task_number, updated_at: args.now, updated_by: null })
          .where(eq(teams.id, team_id));
      }
    }
  }
  return createdTaskIds;
};

export const maintainCyclesForChurch = Effect.fn("maintainCyclesForChurch")(function* (
  db: ChurchWorkDb,
  args: {
    readonly church_id: string;
    readonly church_time_zone: string;
    readonly now?: Date | string;
    readonly rolling_materialization_window_cycles?: number;
  },
) {
  const now = typeof args.now === "string" ? new Date(args.now) : (args.now ?? new Date());
  if (Number.isNaN(now.getTime())) throw new Error("now must be a valid UTC instant.");

  return yield* Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      db.transaction(async (tx) => {
        const currentCycleFields = buildCycleForInstant({
          churchTimeZone: args.church_time_zone,
          instant: now,
        });
        const cycleLocalDates = [
          currentCycleFields.start_date,
          addLocalDateDays(currentCycleFields.start_date, 7),
          addLocalDateDays(currentCycleFields.start_date, 14),
        ];
        const ensuredCycleIds: string[] = [];
        const createdCycleIds: string[] = [];

        for (const localDate of cycleLocalDates) {
          const ensured = await ensureCycle(tx, {
            church_id: args.church_id,
            church_time_zone: args.church_time_zone,
            local_date: localDate,
          });
          ensuredCycleIds.push(ensured.cycle.id);
          if (ensured.created) {
            createdCycleIds.push(ensured.cycle.id);
            await writeSystemActivity(tx, {
              church_id: args.church_id,
              cycle_id: ensured.cycle.id,
              entity_id: ensured.cycle.id,
              entity_type: "cycle",
              event_type: "cycle.created",
              metadata: {
                church_time_zone: ensured.cycle.church_time_zone,
                end_date: ensured.cycle.end_date,
                start_date: ensured.cycle.start_date,
              },
              occurred_at: now,
            });
          }
        }

        const closedCycles = await tx
          .select()
          .from(cycles)
          .where(
            and(
              eq(cycles.church_id, args.church_id),
              lte(cycles.ends_at, now),
              isNull(cycles.deleted_at),
            ),
          );
        const rolledOverTaskIds: string[] = [];

        for (const cycle of closedCycles) {
          let targetCycle = cycle;
          do {
            const nextCycle = await ensureCycle(tx, {
              church_id: args.church_id,
              church_time_zone: targetCycle.church_time_zone,
              local_date: addLocalDateDays(targetCycle.start_date, 7),
            });
            targetCycle = nextCycle.cycle;
            if (nextCycle.created) {
              createdCycleIds.push(nextCycle.cycle.id);
              await writeSystemActivity(tx, {
                church_id: args.church_id,
                cycle_id: nextCycle.cycle.id,
                entity_id: nextCycle.cycle.id,
                entity_type: "cycle",
                event_type: "cycle.created",
                metadata: {
                  church_time_zone: nextCycle.cycle.church_time_zone,
                  end_date: nextCycle.cycle.end_date,
                  start_date: nextCycle.cycle.start_date,
                },
                occurred_at: now,
              });
            }
          } while (targetCycle.ends_at <= now);

          const rolloverTasks = await tx
            .select()
            .from(tasks)
            .where(
              and(
                eq(tasks.church_id, args.church_id),
                eq(tasks.cycle_id, cycle.id),
                inArray(tasks.task_state, ["todo", "in_progress"]),
                isNull(tasks.deleted_at),
              ),
            );

          for (const task of rolloverTasks) {
            const [previousStatus] = await tx
              .select({ name: workflow_statuses.name })
              .from(workflow_statuses)
              .where(eq(workflow_statuses.id, task.workflow_status_id))
              .limit(1);
            await tx
              .update(tasks)
              .set({
                cycle_id: targetCycle.id,
                source_template_sync_enabled: false,
                updated_at: now,
                updated_by: null,
              })
              .where(eq(tasks.id, task.id));
            await writeSystemActivity(tx, {
              church_id: args.church_id,
              cycle_id: targetCycle.id,
              entity_id: task.id,
              entity_type: "task",
              event_type: "task.rolled_over",
              metadata: {
                from_cycle_id: cycle.id,
                previous_task_state: task.task_state,
                previous_workflow_status_id: task.workflow_status_id,
                previous_workflow_status_name: previousStatus?.name ?? null,
                to_cycle_id: targetCycle.id,
              },
              occurred_at: now,
            });
            rolledOverTaskIds.push(task.id);
          }
        }

        const materializedTaskIds: string[] = [];
        const currentCycleId = ensuredCycleIds[0];
        if (currentCycleId) {
          const [currentCycle] = await tx
            .select()
            .from(cycles)
            .where(eq(cycles.id, currentCycleId))
            .limit(1);
          if (currentCycle) {
            materializedTaskIds.push(
              ...(await materializeLegacyTemplateCycleTasks(tx, {
                church_id: args.church_id,
                cycle: currentCycle,
                now,
              })),
              ...(await materializeScheduledTemplateTasksForWindow(tx, {
                church_id: args.church_id,
                church_time_zone: args.church_time_zone,
                current_cycle_start_date: currentCycle.start_date,
                now,
                window_cycles: normalizeMaterializationWindowCycles(
                  (args as { rolling_materialization_window_cycles?: number })
                    .rolling_materialization_window_cycles,
                ),
              })),
            );
          }
        }

        await tx
          .update(organization)
          .set({ rolloverMaintenanceCompletedCycleStartDate: currentCycleFields.start_date })
          .where(eq(organization.id, args.church_id));

        return { createdCycleIds, ensuredCycleIds, materializedTaskIds, rolledOverTaskIds };
      }),
  });
});

const toMaintenanceInstant = (now: Date | DateTime.Utc | string | undefined): Date => {
  if (now === undefined) {
    return new Date();
  }
  if (DateTime.isDateTime(now)) {
    return DateTime.toDateUtc(now);
  }
  if (typeof now === "string") {
    return new Date(now);
  }
  return now;
};

export const runScheduledCycleMaintenance = Effect.fn("runScheduledCycleMaintenance")(function* (
  db: ChurchWorkDb,
  args: { readonly now?: Date | DateTime.Utc | string } = {},
) {
  const maintenanceInstant = toMaintenanceInstant(args.now);
  const churches = yield* Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      db
        .select({
          church_time_zone: organization.churchTimeZone,
          id: organization.id,
          rollover_maintenance_completed_cycle_start_date:
            organization.rolloverMaintenanceCompletedCycleStartDate,
          rolling_materialization_window_cycles: organization.rollingMaterializationWindowCycles,
        })
        .from(organization),
  });
  const outcomes = yield* Effect.forEach(
    churches,
    (church) =>
      Effect.gen(function* () {
        const outcome = yield* Effect.gen(function* () {
          const completedCycleStartDate = church.rollover_maintenance_completed_cycle_start_date;
          if (completedCycleStartDate) {
            const [completedCycle] = yield* Effect.tryPromise({
              catch: (cause) => cause,
              try: () =>
                db
                  .select({ ends_at: cycles.ends_at })
                  .from(cycles)
                  .where(
                    and(
                      eq(cycles.church_id, church.id),
                      eq(cycles.start_date, completedCycleStartDate),
                      isNull(cycles.deleted_at),
                    ),
                  )
                  .limit(1),
            });
            if (
              !isRolloverMaintenanceDue({
                completed_cycle_ends_at: completedCycle?.ends_at ?? null,
                completed_cycle_start_date: completedCycleStartDate,
                now: maintenanceInstant,
              })
            ) {
              return { status: "skipped" as const };
            }
          }

          const result = yield* maintainCyclesForChurch(db, {
            church_id: church.id,
            church_time_zone: church.church_time_zone,
            now: maintenanceInstant,
            rolling_materialization_window_cycles: church.rolling_materialization_window_cycles,
          });
          return { result, status: "succeeded" as const };
        }).pipe(Effect.exit);

        return { churchId: church.id, outcome };
      }),
    { concurrency: "unbounded" },
  );
  const resultsByChurchId: Record<string, CycleMaintenanceResult> = {};
  const maintainedChurchIds: string[] = [];
  const failures: RolloverMaintenanceFailure[] = [];
  let skipped = 0;

  for (const { churchId, outcome } of outcomes) {
    if (Exit.isFailure(outcome)) {
      failures.push({
        churchId,
        error: Cause.pretty(outcome.cause),
      });
    } else if (outcome.value.status === "skipped") {
      skipped += 1;
    } else {
      resultsByChurchId[churchId] = outcome.value.result;
      maintainedChurchIds.push(churchId);
    }
  }

  return {
    failed: failures.length,
    failures,
    maintainedChurchIds,
    resultsByChurchId,
    scanned: churches.length,
    skipped,
    succeeded: maintainedChurchIds.length,
  } satisfies ScheduledCycleMaintenanceResult;
});
