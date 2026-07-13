import { startPostgresHarness } from "@church-work/test-harness";
import { cycleStartDateForLocalDate } from "@church-work/domain";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import {
  activities,
  cycle_adjustments,
  cycles,
  organization,
  tasks,
  teams,
  template_tasks,
  template_schedules,
  template_teams,
  templates,
  workflow_statuses,
  workflows,
} from "@church-work/db/schema";

import {
  buildCycleForInstant,
  buildCycleForLocalDate,
  isRolloverMaintenanceDue,
  normalizeMaterializationWindowCycles,
  runScheduledCycleMaintenance,
} from "./scheduled-work";

const now = new Date("2026-06-16T12:00:00.000Z");
const churchId = "org_scheduled_work";

const baseEntity = (tag: string) => ({
  _tag: tag,
  created_at: now,
  created_by: null,
  updated_at: now,
  updated_by: null,
});

describe("scheduled work", () => {
  test("derives Week boundaries from the Church Time Zone around UTC date edges", () => {
    const cycle = buildCycleForInstant({
      churchTimeZone: "America/Los_Angeles",
      instant: new Date("2026-06-22T06:30:00.000Z"),
    });

    expect(cycle.start_date).toBe("2026-06-15");
    expect(cycle.end_date).toBe("2026-06-21");
    expect(cycle.starts_at.toISOString()).toBe("2026-06-15T07:00:00.000Z");
    expect(cycle.ends_at.toISOString()).toBe("2026-06-22T07:00:00.000Z");
  });

  test("constrains Rolling Materialization Window to one through fifty-two Cycles", () => {
    expect(normalizeMaterializationWindowCycles(undefined)).toBe(3);
    expect(normalizeMaterializationWindowCycles(0)).toBe(1);
    expect(normalizeMaterializationWindowCycles(53)).toBe(52);
    expect(normalizeMaterializationWindowCycles(6.9)).toBe(6);
    expect(normalizeMaterializationWindowCycles(Number.NaN)).toBe(3);
  });

  test("makes missing checkpoints due immediately and completed Cycles due only at their persisted boundary", () => {
    const boundary = new Date("2026-06-22T04:00:00.000Z");
    expect(
      isRolloverMaintenanceDue({
        completed_cycle_ends_at: null,
        completed_cycle_start_date: null,
        now,
      }),
    ).toBe(true);
    expect(
      isRolloverMaintenanceDue({
        completed_cycle_ends_at: boundary,
        completed_cycle_start_date: "2026-06-15",
        now: new Date("2026-06-22T03:59:59.999Z"),
      }),
    ).toBe(false);
    expect(
      isRolloverMaintenanceDue({
        completed_cycle_ends_at: boundary,
        completed_cycle_start_date: "2026-06-15",
        now: boundary,
      }),
    ).toBe(true);
  });

  test("isolates Church failures and leaves failed Churches due for retry", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;
    const successfulChurchId = `${churchId}_isolated_success`;
    const failedChurchId = `${churchId}_isolated_failure`;

    try {
      await db.insert(organization).values([
        {
          _tag: "org",
          churchTimeZone: "Pacific/Kiritimati",
          completedOnboarding: false,
          id: successfulChurchId,
          name: "Successful Church",
          slug: "successful-church",
        },
        {
          _tag: "org",
          churchTimeZone: "Invalid/Time_Zone",
          completedOnboarding: false,
          id: failedChurchId,
          name: "Failed Church",
          slug: "failed-church",
        },
      ]);

      const firstResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));

      expect(firstResult).toMatchObject({ failed: 1, scanned: 2, skipped: 0, succeeded: 1 });
      expect(firstResult.failures[0]).toMatchObject({ churchId: failedChurchId });
      expect(firstResult.maintainedChurchIds).toEqual([successfulChurchId]);

      await db
        .update(organization)
        .set({ churchTimeZone: "Etc/GMT+12" })
        .where(eq(organization.id, failedChurchId));
      const retryResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));

      expect(retryResult).toMatchObject({ failed: 0, scanned: 2, skipped: 1, succeeded: 1 });
      expect(retryResult.maintainedChurchIds).toEqual([failedChurchId]);
    } finally {
      await harness.stop();
    }
  }, 60_000);

  test("maintains cycles for a Church before onboarding, rolls unfinished tasks, and projects Template work", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "America/New_York",
        completedOnboarding: false,
        id: churchId,
        name: "Scheduled Work Church",
        slug: "scheduled-work-church",
      });
      await db.insert(teams).values({
        ...baseEntity("team"),
        church_id: churchId,
        color: "blue",
        id: "team_scheduled_work",
        identifier: "OPS",
        name: "Operations",
        next_task_number: 2,
        previous_identifiers: "[]",
        sort_order: 0,
      });
      await db.insert(workflows).values({
        ...baseEntity("workflow"),
        church_id: churchId,
        id: "workflow_scheduled_work",
        name: "Operations Workflow",
        team_id: "team_scheduled_work",
      });
      await db.insert(workflow_statuses).values([
        {
          ...baseEntity("workflowstatus"),
          church_id: churchId,
          id: "workflowstatus_scheduled_todo",
          key: "todo",
          name: "To Do",
          sort_order: 0,
          task_state: "todo",
          workflow_id: "workflow_scheduled_work",
        },
        {
          ...baseEntity("workflowstatus"),
          church_id: churchId,
          id: "workflowstatus_scheduled_progress",
          key: "in-progress",
          name: "In Progress",
          sort_order: 1,
          task_state: "in_progress",
          workflow_id: "workflow_scheduled_work",
        },
        {
          ...baseEntity("workflowstatus"),
          church_id: churchId,
          id: "workflowstatus_scheduled_done",
          key: "done",
          name: "Done",
          sort_order: 2,
          task_state: "done",
          workflow_id: "workflow_scheduled_work",
        },
        {
          ...baseEntity("workflowstatus"),
          church_id: churchId,
          id: "workflowstatus_scheduled_canceled",
          key: "canceled",
          name: "Canceled",
          sort_order: 3,
          task_state: "canceled",
          workflow_id: "workflow_scheduled_work",
        },
      ]);
      const closedCycle = buildCycleForLocalDate({
        churchTimeZone: "America/New_York",
        localDate: "2026-06-02",
      });
      await db.insert(cycles).values({
        ...baseEntity("cycle"),
        ...closedCycle,
        church_id: churchId,
        id: "cycle_closed",
      });
      await db.insert(cycles).values(
        ["2026-06-15", "2026-06-22", "2026-06-29"].map((localDate, index) => ({
          ...baseEntity("cycle"),
          ...buildCycleForLocalDate({
            churchTimeZone: "America/New_York",
            localDate,
          }),
          church_id: churchId,
          id: `cycle_planned_${index}`,
        })),
      );
      await db.insert(tasks).values([
        {
          ...baseEntity("task"),
          board_order: "a0",
          church_id: churchId,
          cycle_id: "cycle_closed",
          due_date: "2026-06-03",
          id: "task_rollover",
          label_ids: "[]",
          number: 1,
          previous_identifiers: "[]",
          source_template_sync_enabled: true,
          task_state: "todo",
          team_id: "team_scheduled_work",
          title: "Carry forward setup",
          workflow_id: "workflow_scheduled_work",
          workflow_status_id: "workflowstatus_scheduled_todo",
        },
        {
          ...baseEntity("task"),
          board_order: "a1",
          church_id: churchId,
          cycle_id: "cycle_closed",
          due_date: null,
          id: "task_progress_rollover",
          label_ids: "[]",
          number: 2,
          previous_identifiers: "[]",
          source_template_sync_enabled: true,
          task_state: "in_progress",
          team_id: "team_scheduled_work",
          title: "Carry forward active work",
          workflow_id: "workflow_scheduled_work",
          workflow_status_id: "workflowstatus_scheduled_progress",
        },
        {
          ...baseEntity("task"),
          board_order: "a2",
          church_id: churchId,
          cycle_id: "cycle_closed",
          due_date: null,
          id: "task_done_retained",
          label_ids: "[]",
          number: 3,
          previous_identifiers: "[]",
          task_state: "done",
          team_id: "team_scheduled_work",
          title: "Completed history",
          workflow_id: "workflow_scheduled_work",
          workflow_status_id: "workflowstatus_scheduled_done",
        },
        {
          ...baseEntity("task"),
          board_order: "a3",
          church_id: churchId,
          cycle_id: "cycle_closed",
          due_date: null,
          id: "task_canceled_retained",
          label_ids: "[]",
          number: 4,
          previous_identifiers: "[]",
          task_state: "canceled",
          team_id: "team_scheduled_work",
          title: "Canceled history",
          workflow_id: "workflow_scheduled_work",
          workflow_status_id: "workflowstatus_scheduled_canceled",
        },
        {
          ...baseEntity("task"),
          board_order: "a4",
          church_id: churchId,
          cycle_id: null,
          due_date: null,
          id: "task_uncycled_ignored",
          label_ids: "[]",
          number: 5,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_scheduled_work",
          title: "Unplanned capture",
          workflow_id: "workflow_scheduled_work",
          workflow_status_id: "workflowstatus_scheduled_todo",
        },
      ]);
      await db.insert(templates).values({
        ...baseEntity("template"),
        church_id: churchId,
        id: "template_weekly_ops",
        key: "weekly-ops",
        name: "Weekly Ops",
        recurrence: "weekly",
      });
      await db.insert(template_teams).values({
        ...baseEntity("templateteam"),
        church_id: churchId,
        id: "templateteam_weekly_ops",
        key: "ops",
        mapped_team_id: "team_scheduled_work",
        name: "Operations",
        template_id: "template_weekly_ops",
      });
      await db.insert(template_tasks).values({
        ...baseEntity("templatetask"),
        church_id: churchId,
        id: "templatetask_weekly_checklist",
        key: "weekly-checklist",
        parent_template_task_id: null,
        scheduling_rule: JSON.stringify({
          baseLocalDate: "2026-06-15",
          dayOffset: 1,
          kind: "cycleOffset",
          offsetCycles: 0,
        }),
        template_id: "template_weekly_ops",
        template_team_id: "templateteam_weekly_ops",
        title: "Prepare weekly checklist",
      });
      await db.insert(template_schedules).values({
        ...baseEntity("templateschedule"),
        church_id: churchId,
        id: "templateschedule_weekly_ops",
        template_id: "template_weekly_ops",
        key: "sunday-service",
        name: "Sunday Service",
        kind: "weekly",
        recurrence: "repeating",
        start_date: "2026-06-14",
        rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
      });
      await db.insert(cycle_adjustments).values({
        ...baseEntity("cycleadjustment"),
        church_id: churchId,
        cycle_id: "cycle_planned_0",
        id: "cycleadjustment_weekly_ops",
        lifecycle: "active",
        overrides: JSON.stringify([
          { field: "title", value: "Prepare adjusted checklist" },
          { field: "dueDate", value: "2026-06-18" },
          { field: "description", value: "Adjusted for this occurrence" },
          { field: "assignedUserId", value: "user_adjusted" },
          { field: "labelIds", value: ["label_adjusted"] },
          { field: "estimate", value: "3" },
          { field: "priority", value: "high" },
        ]),
        source_template_occurrence_key: "weekly:2026-06-21:sunday",
        source_template_schedule_id: "templateschedule_weekly_ops",
        template_task_id: "templatetask_weekly_checklist",
      });

      let transactionsReady = 0;
      let releaseTransactions = () => {};
      const transactionsReleased = new Promise<void>((resolve) => {
        releaseTransactions = resolve;
      });
      const waitForConcurrentTransactions = async () => {
        transactionsReady += 1;
        if (transactionsReady === 2) releaseTransactions();
        await transactionsReleased;
      };
      const concurrentResults = await Promise.all([
        Effect.runPromise(
          runScheduledCycleMaintenance(db, {
            before_church_lock: waitForConcurrentTransactions,
            now,
          }),
        ),
        Effect.runPromise(
          runScheduledCycleMaintenance(db, {
            before_church_lock: waitForConcurrentTransactions,
            now,
          }),
        ),
      ]);
      const successfulResult = concurrentResults.find((candidate) => candidate.succeeded === 1);

      expect(concurrentResults.map(({ skipped, succeeded }) => ({ skipped, succeeded }))).toEqual(
        expect.arrayContaining([
          { skipped: 0, succeeded: 1 },
          { skipped: 1, succeeded: 0 },
        ]),
      );
      expect(successfulResult).toBeDefined();
      if (!successfulResult)
        throw new Error("Expected one concurrent maintenance invocation to win");
      expect(successfulResult.maintainedChurchIds).toEqual([churchId]);
      expect(successfulResult.resultsByChurchId[churchId]?.rolledOverTaskIds).toEqual([
        "task_rollover",
        "task_progress_rollover",
      ]);
      expect(successfulResult.resultsByChurchId[churchId]?.materializedTaskIds).toHaveLength(4);

      const [rolledTask] = await db.select().from(tasks).where(eq(tasks.id, "task_rollover"));
      expect(rolledTask).toMatchObject({
        due_date: "2026-06-03",
        source_template_sync_enabled: false,
      });
      expect(rolledTask?.number).toBe(1);
      expect(rolledTask?.previous_identifiers).toBe("[]");
      const [rolledProgressTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, "task_progress_rollover"));
      expect(rolledProgressTask).toMatchObject({
        cycle_id: rolledTask?.cycle_id,
        due_date: null,
        number: 2,
        previous_identifiers: "[]",
        source_template_sync_enabled: false,
      });

      for (const retainedTaskId of ["task_done_retained", "task_canceled_retained"]) {
        const [retainedTask] = await db.select().from(tasks).where(eq(tasks.id, retainedTaskId));
        expect(retainedTask?.cycle_id).toBe("cycle_closed");
      }
      const [uncycledTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, "task_uncycled_ignored"));
      expect(uncycledTask?.cycle_id).toBeNull();

      const projectedTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.source_template_id, "template_weekly_ops"));
      expect(projectedTasks).toHaveLength(4);
      expect(
        projectedTasks.filter((task) => task.source_template_schedule_id === null),
      ).toHaveLength(1);
      const adjustedScheduledTask = projectedTasks.find(
        (task) => task.source_template_occurrence_key === "weekly:2026-06-21:sunday",
      );
      expect(adjustedScheduledTask).toMatchObject({
        assigned_user_id: "user_adjusted",
        description: "Adjusted for this occurrence",
        due_date: "2026-06-18",
        estimate: "3",
        label_ids: JSON.stringify(["label_adjusted"]),
        priority: "high",
        source_template_cycle_id: "cycle_planned_0",
        source_template_schedule_id: "templateschedule_weekly_ops",
        title: "Prepare adjusted checklist",
      });
      const legacyProjectedTask = projectedTasks.find(
        (task) => task.source_template_schedule_id === null,
      );
      expect(legacyProjectedTask).toMatchObject({
        due_date: "2026-06-16",
        source_template_sync_enabled: false,
      });
      expect(projectedTasks.every((task) => task.created_by === null)).toBe(true);

      const cycleRows = await db.select().from(cycles).where(eq(cycles.church_id, churchId));
      expect(cycleRows.map((cycle) => cycle.start_date).sort()).toEqual([
        "2026-06-01",
        "2026-06-08",
        "2026-06-15",
        "2026-06-22",
        "2026-06-29",
      ]);

      const activityRows = await db.select().from(activities);
      expect(activityRows.map((activity) => activity.event_type)).toEqual(
        expect.arrayContaining([
          "task.rolled_over",
          "task.template_materialized",
          "task.template_synced",
        ]),
      );
      expect(
        activityRows.filter((activity) => activity.event_type === "task.rolled_over"),
      ).toHaveLength(2);
      expect(
        activityRows.filter((activity) => activity.event_type === "task.template_synced"),
      ).toHaveLength(1);
      expect(
        activityRows.filter((activity) => activity.event_type === "cycle.created"),
      ).toHaveLength(1);
      expect(
        activityRows.filter((activity) => activity.event_type === "task.template_materialized"),
      ).toHaveLength(3);
      const materializedActivity = activityRows.find(
        (activity) => activity.entity_id === adjustedScheduledTask?.id,
      );
      expect(JSON.parse(materializedActivity?.metadata ?? "{}")).toEqual({
        cycle_id: "cycle_planned_0",
        source_template_occurrence_key: "weekly:2026-06-21:sunday",
        source_template_schedule_id: "templateschedule_weekly_ops",
        template_id: "template_weekly_ops",
        template_task_id: "templatetask_weekly_checklist",
      });

      const [maintainedChurch] = await db
        .select({
          completedCycleStartDate: organization.rolloverMaintenanceCompletedCycleStartDate,
        })
        .from(organization)
        .where(eq(organization.id, churchId));
      expect(maintainedChurch?.completedCycleStartDate).toBe("2026-06-15");

      await db
        .update(organization)
        .set({ rolloverMaintenanceCompletedCycleStartDate: null })
        .where(eq(organization.id, churchId));
      const retryResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      expect(retryResult.maintainedChurchIds).toEqual([churchId]);
      expect(retryResult.resultsByChurchId[churchId]?.materializedTaskIds).toEqual([]);
      expect(await db.select().from(tasks).where(eq(tasks.church_id, churchId))).toHaveLength(9);
      expect(await db.select().from(activities)).toHaveLength(activityRows.length);

      const secondResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      expect(secondResult.maintainedChurchIds).toEqual([]);

      const boundaryResult = await Effect.runPromise(
        runScheduledCycleMaintenance(db, { now: "2026-06-22T04:00:00.000Z" }),
      );
      expect(boundaryResult.maintainedChurchIds).toEqual([churchId]);
      const [advancedChurch] = await db
        .select({
          completedCycleStartDate: organization.rolloverMaintenanceCompletedCycleStartDate,
        })
        .from(organization)
        .where(eq(organization.id, churchId));
      expect(advancedChurch?.completedCycleStartDate).toBe("2026-06-22");
    } finally {
      await harness.stop();
    }
  }, 60_000);

  test("derives future Week boundaries without materializing arbitrary future Cycles", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "America/New_York",
        completedOnboarding: true,
        id: `${churchId}_sparse`,
        name: "Sparse Work Church",
        slug: "sparse-work-church",
      });
      const authoredFutureCycle = buildCycleForLocalDate({
        churchTimeZone: "America/New_York",
        localDate: "2026-07-07",
      });
      await db.insert(cycles).values({
        ...baseEntity("cycle"),
        ...authoredFutureCycle,
        church_id: `${churchId}_sparse`,
        id: "cycle_authored_future",
      });

      const result = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      const cycleRows = await db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, `${churchId}_sparse`));

      expect(cycleStartDateForLocalDate("2026-07-07")).toBe("2026-07-06");
      expect(cycleRows.map((cycle) => cycle.start_date).sort()).toEqual([
        "2026-06-15",
        "2026-06-22",
        "2026-06-29",
        "2026-07-06",
      ]);
      expect(result.resultsByChurchId[`${churchId}_sparse`]?.ensuredCycleIds).toHaveLength(3);
      expect(result.resultsByChurchId[`${churchId}_sparse`]?.ensuredCycleIds).not.toContain(
        "cycle_authored_future",
      );

      const secondResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      const secondCycleRows = await db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, `${churchId}_sparse`));

      expect(secondResult.maintainedChurchIds).toEqual([]);
      expect(secondResult.resultsByChurchId[`${churchId}_sparse`]).toBeUndefined();
      expect(secondCycleRows.map((cycle) => cycle.start_date).sort()).toEqual([
        "2026-06-15",
        "2026-06-22",
        "2026-06-29",
        "2026-07-06",
      ]);
      expect(secondCycleRows.some((cycle) => cycle.id === "cycle_authored_future")).toBe(true);
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
