import { startPostgresHarness } from "@church-work/test-harness";
import { adjustChurchCyclesForTimeZone } from "@church-work/db";
import {
  activities,
  cycle_adjustments,
  cycles,
  organization,
  tasks,
  teams,
  template_schedules,
  template_tasks,
  template_teams,
  templates,
  workflow_statuses,
  workflows,
} from "@church-work/db/schema";
import { buildCycleForLocalDate } from "@church-work/server";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import worker from "./server";

const scheduledTime = Date.parse("2026-06-16T12:00:00.000Z");
const recordedAt = new Date("2026-06-01T12:00:00.000Z");
const successfulChurchId = "org_worker_scheduled_success";
const failedChurchId = "org_worker_scheduled_failure";
const skippedChurchId = "org_worker_scheduled_skipped";

const baseEntity = (tag: string) => ({
  _tag: tag,
  created_at: recordedAt,
  created_by: null,
  updated_at: recordedAt,
  updated_by: null,
});

const invokeScheduledHandler = (connectionString: string, instant: string, cron = "*/15 * * * *") =>
  worker.scheduled(
    { cron, noRetry: () => undefined, scheduledTime: Date.parse(instant) },
    { HYPERDRIVE: { connectionString } },
  );

describe("Cloudflare scheduled handler", () => {
  test("maintains representative worldwide Churches only at their persisted Monday boundary", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;
    const boundaries = [
      ["Pacific/Kiritimati", "2026-06-21T10:00:00.000Z"],
      ["Asia/Kathmandu", "2026-06-21T18:15:00.000Z"],
      ["Asia/Kolkata", "2026-06-21T18:30:00.000Z"],
      ["Europe/London", "2026-06-21T23:00:00.000Z"],
      ["Etc/GMT+12", "2026-06-22T12:00:00.000Z"],
    ] as const;

    try {
      for (const [index, [timeZone]] of boundaries.entries()) {
        const churchId = `org_worldwide_${index}`;
        const currentCycle = buildCycleForLocalDate({
          churchTimeZone: timeZone,
          localDate: "2026-06-16",
        });
        await db.insert(organization).values({
          _tag: "org",
          churchTimeZone: timeZone,
          completedOnboarding: true,
          id: churchId,
          name: `Worldwide Church ${index}`,
          rolloverMaintenanceCompletedCycleStartDate: currentCycle.start_date,
          slug: `worldwide-church-${index}`,
        });
        await db.insert(cycles).values({
          ...baseEntity("cycle"),
          ...currentCycle,
          church_id: churchId,
          id: `cycle_worldwide_${index}`,
        });
      }

      for (const [index, [, boundary]] of boundaries.entries()) {
        const churchId = `org_worldwide_${index}`;
        const beforeBoundary = new Date(Date.parse(boundary) - 1).toISOString();
        const before = await invokeScheduledHandler(harness.connectionString, beforeBoundary);
        expect(before.maintainedChurchIds).not.toContain(churchId);

        const atBoundary = await invokeScheduledHandler(harness.connectionString, boundary);
        expect(atBoundary.maintainedChurchIds).toContain(churchId);

        const repeated = await invokeScheduledHandler(harness.connectionString, boundary);
        expect(repeated.maintainedChurchIds).not.toContain(churchId);
      }

      const churches = await db.select().from(organization);
      expect(
        boundaries.map(
          (_, index) =>
            churches.find((church) => church.id === `org_worldwide_${index}`)
              ?.rolloverMaintenanceCompletedCycleStartDate,
        ),
      ).toEqual(Array.from({ length: boundaries.length }, () => "2026-06-22"));
      for (const [index] of boundaries.entries()) {
        const cycleRows = await db
          .select()
          .from(cycles)
          .where(eq(cycles.church_id, `org_worldwide_${index}`));
        expect(cycleRows.map(({ start_date }) => start_date).sort()).toEqual([
          "2026-06-15",
          "2026-06-22",
          "2026-06-29",
          "2026-07-06",
        ]);
      }
    } finally {
      await harness.stop();
    }
  }, 60_000);

  test("reconciles missed and first-deployment Churches and honors recalculated Time Zone boundaries", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;
    const missedChurchId = "org_reconciliation_missed";
    const firstDeploymentChurchId = "org_reconciliation_first_deployment";
    const changedTimeZoneChurchId = "org_reconciliation_time_zone";

    try {
      const missedCycle = buildCycleForLocalDate({
        churchTimeZone: "Pacific/Kiritimati",
        localDate: "2026-06-16",
      });
      const changedCycle = buildCycleForLocalDate({
        churchTimeZone: "America/New_York",
        localDate: "2026-06-16",
      });
      await db.insert(organization).values([
        {
          _tag: "org",
          churchTimeZone: "Pacific/Kiritimati",
          completedOnboarding: true,
          id: missedChurchId,
          name: "Missed Church",
          rolloverMaintenanceCompletedCycleStartDate: missedCycle.start_date,
          slug: "missed-church",
        },
        {
          _tag: "org",
          churchTimeZone: "America/New_York",
          completedOnboarding: true,
          id: changedTimeZoneChurchId,
          name: "Changed Time Zone Church",
          rolloverMaintenanceCompletedCycleStartDate: changedCycle.start_date,
          slug: "changed-time-zone-church",
        },
      ]);
      await db.insert(cycles).values([
        {
          ...baseEntity("cycle"),
          ...missedCycle,
          church_id: missedChurchId,
          id: "cycle_reconciliation_missed",
        },
        ...["2026-06-15", "2026-06-22", "2026-06-29"].map((localDate, index) => ({
          ...baseEntity("cycle"),
          ...buildCycleForLocalDate({ churchTimeZone: "America/New_York", localDate }),
          church_id: changedTimeZoneChurchId,
          id: `cycle_reconciliation_time_zone_${index}`,
        })),
      ]);

      const checkpointBeforeChange = changedCycle.start_date;
      await db
        .update(organization)
        .set({ churchTimeZone: "America/Los_Angeles" })
        .where(eq(organization.id, changedTimeZoneChurchId));
      const adjustment = await adjustChurchCyclesForTimeZone(db, {
        church_id: changedTimeZoneChurchId,
        newChurchTimeZone: "America/Los_Angeles",
        now: new Date("2026-06-18T12:00:00.000Z"),
      });
      expect(adjustment.adjustedCycleIds).toHaveLength(3);

      const [changedChurchBeforeBoundary] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, changedTimeZoneChurchId));
      expect(changedChurchBeforeBoundary?.rolloverMaintenanceCompletedCycleStartDate).toBe(
        checkpointBeforeChange,
      );
      const changedCycles = await db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, changedTimeZoneChurchId));
      expect(changedCycles.every((cycle) => cycle.church_time_zone === "America/Los_Angeles")).toBe(
        true,
      );
      expect(
        changedCycles.find((cycle) => cycle.start_date === "2026-06-15")?.ends_at.toISOString(),
      ).toBe("2026-06-22T07:00:00.000Z");

      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "Etc/GMT+12",
        completedOnboarding: false,
        id: firstDeploymentChurchId,
        name: "First Deployment Church",
        slug: "first-deployment-church",
      });

      const reconciliation = await invokeScheduledHandler(
        harness.connectionString,
        "2026-06-22T13:15:00.000Z",
        "15 13 * * MON",
      );
      expect(reconciliation.maintainedChurchIds).toEqual(
        expect.arrayContaining([missedChurchId, firstDeploymentChurchId, changedTimeZoneChurchId]),
      );

      const activityCount = (await db.select().from(activities)).length;

      const repeated = await invokeScheduledHandler(
        harness.connectionString,
        "2026-06-22T13:15:00.000Z",
        "15 13 * * MON",
      );
      expect(repeated).toMatchObject({ failed: 0, skipped: 3, succeeded: 0 });
      expect(await db.select().from(activities)).toHaveLength(activityCount);
    } finally {
      await harness.stop();
    }
  }, 60_000);

  test("runs through Hyperdrive against Postgres with authoritative scheduled time and isolated failures", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      const closedCycle = buildCycleForLocalDate({
        churchTimeZone: "America/New_York",
        localDate: "2026-06-02",
      });
      const skippedCycle = buildCycleForLocalDate({
        churchTimeZone: "America/New_York",
        localDate: "2026-06-16",
      });

      await db.insert(organization).values([
        {
          _tag: "org",
          churchTimeZone: "America/New_York",
          completedOnboarding: false,
          id: successfulChurchId,
          name: "Successful Worker Church",
          slug: "successful-worker-church",
        },
        {
          _tag: "org",
          churchTimeZone: "Invalid/Time_Zone",
          completedOnboarding: false,
          id: failedChurchId,
          name: "Failed Worker Church",
          slug: "failed-worker-church",
        },
        {
          _tag: "org",
          churchTimeZone: "America/New_York",
          completedOnboarding: true,
          id: skippedChurchId,
          name: "Skipped Worker Church",
          rolloverMaintenanceCompletedCycleStartDate: skippedCycle.start_date,
          slug: "skipped-worker-church",
        },
      ]);
      await db.insert(cycles).values([
        {
          ...baseEntity("cycle"),
          ...closedCycle,
          church_id: successfulChurchId,
          id: "cycle_worker_closed",
        },
        {
          ...baseEntity("cycle"),
          ...skippedCycle,
          church_id: skippedChurchId,
          id: "cycle_worker_skipped",
        },
        ...["2026-06-15", "2026-06-22", "2026-06-29"].map((localDate, index) => ({
          ...baseEntity("cycle"),
          ...buildCycleForLocalDate({
            churchTimeZone: "America/New_York",
            localDate,
          }),
          church_id: successfulChurchId,
          id: `cycle_worker_planned_${index}`,
        })),
      ]);
      await db.insert(teams).values({
        ...baseEntity("team"),
        church_id: successfulChurchId,
        color: "blue",
        id: "team_worker_scheduled",
        identifier: "OPS",
        name: "Operations",
        next_task_number: 2,
        previous_identifiers: "[]",
        sort_order: 0,
      });
      await db.insert(workflows).values({
        ...baseEntity("workflow"),
        church_id: successfulChurchId,
        id: "workflow_worker_scheduled",
        name: "Operations Workflow",
        team_id: "team_worker_scheduled",
      });
      await db.insert(workflow_statuses).values({
        ...baseEntity("workflowstatus"),
        church_id: successfulChurchId,
        id: "workflowstatus_worker_todo",
        key: "todo",
        name: "To Do",
        sort_order: 0,
        task_state: "todo",
        workflow_id: "workflow_worker_scheduled",
      });
      await db.insert(tasks).values({
        ...baseEntity("task"),
        board_order: "a0",
        church_id: successfulChurchId,
        cycle_id: "cycle_worker_closed",
        id: "task_worker_rollover",
        label_ids: "[]",
        number: 1,
        previous_identifiers: "[]",
        task_state: "todo",
        team_id: "team_worker_scheduled",
        title: "Carry forward from Worker",
        workflow_id: "workflow_worker_scheduled",
        workflow_status_id: "workflowstatus_worker_todo",
      });
      await db.insert(templates).values({
        ...baseEntity("template"),
        church_id: successfulChurchId,
        id: "template_worker_weekly",
        key: "worker-weekly",
        name: "Worker Weekly",
        recurrence: "weekly",
      });
      await db.insert(template_teams).values({
        ...baseEntity("templateteam"),
        church_id: successfulChurchId,
        id: "templateteam_worker_weekly",
        key: "ops",
        mapped_team_id: "team_worker_scheduled",
        name: "Operations",
        template_id: "template_worker_weekly",
      });
      await db.insert(template_tasks).values({
        ...baseEntity("templatetask"),
        church_id: successfulChurchId,
        id: "templatetask_worker_weekly",
        key: "weekly-checklist",
        parent_template_task_id: null,
        scheduling_rule: JSON.stringify({
          baseLocalDate: "2026-06-15",
          dayOffset: 1,
          kind: "cycleOffset",
          offsetCycles: 0,
        }),
        template_id: "template_worker_weekly",
        template_team_id: "templateteam_worker_weekly",
        title: "Prepare Worker checklist",
      });
      await db.insert(template_schedules).values({
        ...baseEntity("templateschedule"),
        church_id: successfulChurchId,
        id: "templateschedule_worker_weekly",
        template_id: "template_worker_weekly",
        key: "sunday-service",
        name: "Sunday Service",
        kind: "weekly",
        recurrence: "repeating",
        start_date: "2026-06-14",
        rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
      });
      await db.insert(cycle_adjustments).values({
        ...baseEntity("cycleadjustment"),
        church_id: successfulChurchId,
        cycle_id: "cycle_worker_planned_0",
        id: "cycleadjustment_worker_weekly",
        lifecycle: "active",
        overrides: JSON.stringify([{ field: "title", value: "Adjusted Worker checklist" }]),
        source_template_occurrence_key: "weekly:2026-06-21:sunday",
        source_template_schedule_id: "templateschedule_worker_weekly",
        template_task_id: "templatetask_worker_weekly",
      });

      const result = await worker.scheduled(
        { cron: "*/15 * * * *", noRetry: () => undefined, scheduledTime },
        { HYPERDRIVE: { connectionString: harness.connectionString } },
      );

      expect(result).toMatchObject({ failed: 1, scanned: 3, skipped: 1, succeeded: 1 });
      expect(result.failures[0]).toMatchObject({ churchId: failedChurchId });
      expect(result.maintainedChurchIds).toEqual([successfulChurchId]);
      expect(result.resultsByChurchId[successfulChurchId]?.rolledOverTaskIds).toEqual([
        "task_worker_rollover",
      ]);
      expect(result.resultsByChurchId[successfulChurchId]?.materializedTaskIds).toHaveLength(4);

      const successfulCycles = await db
        .select()
        .from(cycles)
        .where(eq(cycles.church_id, successfulChurchId));
      expect(successfulCycles.map((cycle) => cycle.start_date).sort()).toEqual([
        "2026-06-01",
        "2026-06-08",
        "2026-06-15",
        "2026-06-22",
        "2026-06-29",
      ]);
      const [rolledTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, "task_worker_rollover"));
      expect(rolledTask?.cycle_id).not.toBe("cycle_worker_closed");
      const activityRows = await db
        .select()
        .from(activities)
        .where(eq(activities.church_id, successfulChurchId));
      expect(activityRows.map((activity) => activity.event_type)).toEqual(
        expect.arrayContaining([
          "cycle.created",
          "task.rolled_over",
          "task.template_materialized",
          "task.template_synced",
        ]),
      );
      const projectedTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.source_template_id, "template_worker_weekly"));
      expect(projectedTasks).toHaveLength(4);
      expect(
        projectedTasks.find(
          (task) => task.source_template_occurrence_key === "weekly:2026-06-21:sunday",
        )?.title,
      ).toBe("Adjusted Worker checklist");

      const churches = await db.select().from(organization);
      expect(
        churches.find((church) => church.id === successfulChurchId)
          ?.rolloverMaintenanceCompletedCycleStartDate,
      ).toBe("2026-06-15");
      expect(
        churches.find((church) => church.id === failedChurchId)
          ?.rolloverMaintenanceCompletedCycleStartDate,
      ).toBeNull();
      expect(
        churches.find((church) => church.id === skippedChurchId)
          ?.rolloverMaintenanceCompletedCycleStartDate,
      ).toBe("2026-06-15");
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
