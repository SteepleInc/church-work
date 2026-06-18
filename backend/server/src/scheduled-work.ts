import {
  addLocalDateDays,
  assertValidTimeZone,
  cycleStartDateForLocalDate,
  localDateForInstant,
  localMidnightToUtcInstant,
} from "@church-task/domain";
import { getActivityId, getCycleId } from "@church-task/shared/get-ids";
import { buildTemplateCycleTaskInserts } from "@church-task/zero";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { Effect } from "effect";

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
  templates,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";

import type { ChurchTaskDb } from "@church-task/db";

export const sundayCycleMaintenanceCron = "0 8 * * 0";

type DbTransaction = Parameters<Parameters<ChurchTaskDb["transaction"]>[0]>[0];
type DbExecutor = ChurchTaskDb | DbTransaction;

type CycleMaintenanceResult = {
  readonly createdCycleIds: readonly string[];
  readonly ensuredCycleIds: readonly string[];
  readonly materializedTaskIds: readonly string[];
  readonly rolledOverTaskIds: readonly string[];
};

type ScheduledCycleMaintenanceResult = {
  readonly maintainedChurchIds: readonly string[];
  readonly resultsByChurchId: Readonly<Record<string, CycleMaintenanceResult>>;
};

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

const materializeTemplateCycleTasks = async (
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
            .select({ number: tasks.number, team_id: tasks.team_id })
            .from(tasks)
            .where(
              and(
                eq(tasks.church_id, args.church_id),
                inArray(tasks.team_id, mappedTeamIds),
                isNull(tasks.deleted_at),
              ),
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
      adjustments: adjustmentRows as never,
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
      start_number_by_team_id: new Map(
        teamRows.map((team) => {
          const highestLiveTaskNumber = taskNumberRows.reduce(
            (highest, task) =>
              task.team_id === team.id && task.number > highest ? task.number : highest,
            0,
          );
          return [team.id, Math.max(team.next_task_number, highestLiveTaskNumber + 1)];
        }),
      ),
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

export const maintainCyclesForChurch = Effect.fn("maintainCyclesForChurch")(function* (
  db: ChurchTaskDb,
  args: {
    readonly church_id: string;
    readonly church_time_zone: string;
    readonly now?: Date | string;
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
        for (const cycleId of ensuredCycleIds) {
          const [cycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
          if (!cycle) continue;
          materializedTaskIds.push(
            ...(await materializeTemplateCycleTasks(tx, { church_id: args.church_id, cycle, now })),
          );
        }

        return { createdCycleIds, ensuredCycleIds, materializedTaskIds, rolledOverTaskIds };
      }),
  });
});

export const runScheduledCycleMaintenance = Effect.fn("runScheduledCycleMaintenance")(function* (
  db: ChurchTaskDb,
  args: { readonly now?: Date | string } = {},
) {
  const churches = yield* Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      db
        .select({ church_time_zone: organization.churchTimeZone, id: organization.id })
        .from(organization),
  });
  const resultsByChurchId: Record<string, CycleMaintenanceResult> = {};
  const maintainedChurchIds: string[] = [];

  for (const church of churches) {
    const result = yield* maintainCyclesForChurch(db, {
      church_id: church.id,
      church_time_zone: church.church_time_zone,
      now: args.now,
    });
    resultsByChurchId[church.id] = result;
    maintainedChurchIds.push(church.id);
  }

  return { maintainedChurchIds, resultsByChurchId } satisfies ScheduledCycleMaintenanceResult;
});
