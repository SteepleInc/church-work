import { startPostgresHarness } from "@church-task/test-harness";
import { cycleStartDateForLocalDate } from "@church-task/domain";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import {
  activities,
  cycles,
  organization,
  tasks,
  teams,
  template_tasks,
  template_teams,
  templates,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";

import {
  buildCycleForInstant,
  buildCycleForLocalDate,
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

  test("maintains cycles, rolls unfinished tasks, and projects Template work", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "America/New_York",
        completedOnboarding: true,
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

      const result = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));

      expect(result.maintainedChurchIds).toEqual([churchId]);
      expect(result.resultsByChurchId[churchId]?.rolledOverTaskIds).toEqual([
        "task_rollover",
        "task_progress_rollover",
      ]);
      expect(result.resultsByChurchId[churchId]?.materializedTaskIds).toHaveLength(1);

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
      expect(projectedTasks).toHaveLength(1);
      expect(projectedTasks[0]).toMatchObject({
        due_date: "2026-06-16",
        source_template_sync_enabled: false,
      });
      expect(projectedTasks.every((task) => task.created_by === null)).toBe(true);

      const activityRows = await db.select().from(activities);
      expect(activityRows.map((activity) => activity.event_type)).toEqual(
        expect.arrayContaining(["cycle.created", "task.rolled_over", "task.template_synced"]),
      );

      const secondResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      expect(secondResult.resultsByChurchId[churchId]?.rolledOverTaskIds).toEqual([]);
      expect(secondResult.resultsByChurchId[churchId]?.materializedTaskIds).toEqual([]);
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
        "2026-07-06",
      ]);
      expect(result.resultsByChurchId[`${churchId}_sparse`]?.ensuredCycleIds).toHaveLength(2);
      expect(result.resultsByChurchId[`${churchId}_sparse`]?.ensuredCycleIds).not.toContain(
        "cycle_authored_future",
      );

      const secondResult = await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
      const secondCycleRows = await db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, `${churchId}_sparse`));

      expect(secondResult.resultsByChurchId[`${churchId}_sparse`]?.createdCycleIds).toEqual([]);
      expect(secondCycleRows.map((cycle) => cycle.start_date).sort()).toEqual([
        "2026-06-15",
        "2026-06-22",
        "2026-07-06",
      ]);
      expect(secondCycleRows.some((cycle) => cycle.id === "cycle_authored_future")).toBe(true);
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
