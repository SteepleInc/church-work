import { startPostgresHarness } from "@church-work/test-harness";
import {
  activities,
  cycles,
  organization,
  tasks,
  teams,
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

describe("Cloudflare scheduled handler", () => {
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

      const result = await worker.scheduled?.(
        { cron: "*/15 * * * *", scheduledTime } as ScheduledController,
        { HYPERDRIVE: { connectionString: harness.connectionString } } as Env,
      );

      expect(result).toMatchObject({ failed: 1, scanned: 3, skipped: 1, succeeded: 1 });
      expect(result?.failures[0]).toMatchObject({ churchId: failedChurchId });
      expect(result?.maintainedChurchIds).toEqual([successfulChurchId]);
      expect(result?.resultsByChurchId[successfulChurchId]?.rolledOverTaskIds).toEqual([
        "task_worker_rollover",
      ]);

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
        expect.arrayContaining(["cycle.created", "task.rolled_over"]),
      );

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
