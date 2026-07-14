import { startPostgresHarness } from "@church-work/test-harness";
import { FREE_PLAN_TASK_LIMIT, FREE_PLAN_TASK_LIMIT_ERROR } from "@church-work/domain";
import { mustGetMutator } from "@rocicorp/zero";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { organization, tasks, teams, workflow_statuses, workflows } from "@church-work/db/schema";

import { mutators } from "./mutators";

const churchId = "org_atomic_task_limit";
const teamId = "team_atomic_task_limit";
const workflowId = "workflow_atomic_task_limit";
const statusId = "workflowstatus_atomic_task_limit";
const userId = "user_atomic_task_limit";
const now = new Date("2026-07-14T12:00:00.000Z");

const sessionContext = {
  active_church_id: churchId,
  authenticated: true,
  church_role: "owner",
  is_app_admin: false,
  runtime: "server",
  session_id: "session_atomic_task_limit",
  user_id: userId,
} as const;

const baseEntity = (tag: string) => ({
  _tag: tag,
  created_at: now,
  created_by: userId,
  updated_at: now,
  updated_by: userId,
});

describe("Free Plan Task creation integration", () => {
  test("allows only one of two concurrent creations at 299 counted Tasks", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "UTC",
        completedOnboarding: true,
        id: churchId,
        name: "Atomic Task Limit Church",
        slug: "atomic-task-limit-church",
      });
      await db.insert(teams).values({
        ...baseEntity("team"),
        church_id: churchId,
        color: "blue",
        id: teamId,
        identifier: "ATM",
        name: "Atomic Tasks",
        next_task_number: FREE_PLAN_TASK_LIMIT,
        previous_identifiers: "[]",
        sort_order: 0,
      });
      await db.insert(workflows).values({
        ...baseEntity("workflow"),
        church_id: churchId,
        id: workflowId,
        name: "Atomic Tasks Workflow",
        team_id: teamId,
      });
      await db.insert(workflow_statuses).values({
        ...baseEntity("workflowstatus"),
        church_id: churchId,
        id: statusId,
        key: "todo",
        name: "To Do",
        sort_order: 0,
        task_state: "todo",
        workflow_id: workflowId,
      });
      await db.insert(tasks).values(
        Array.from({ length: FREE_PLAN_TASK_LIMIT - 1 }, (_, index) => ({
          ...baseEntity("task"),
          board_order: `a${index.toString().padStart(3, "0")}`,
          church_id: churchId,
          cycle_id: null,
          due_date: null,
          id: `task_atomic_seed_${index}`,
          label_ids: "[]",
          number: index + 1,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: teamId,
          title: `Seed Task ${index + 1}`,
          workflow_id: workflowId,
          workflow_status_id: statusId,
        })),
      );

      const createTask = (title: string) =>
        db.transaction(async (transaction) =>
          mustGetMutator(mutators, "tasks.create").fn({
            args: { team_id: teamId, title, workflow_status_id: statusId },
            ctx: sessionContext,
            tx: {
              dbTransaction: { wrappedTransaction: transaction },
              location: "server",
            } as never,
          }),
        );

      const results = await Promise.allSettled([
        createTask("Concurrent Task A"),
        createTask("Concurrent Task B"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: expect.objectContaining({ message: FREE_PLAN_TASK_LIMIT_ERROR }),
      });

      const persistedTasks = await db.select().from(tasks).where(eq(tasks.church_id, churchId));
      expect(persistedTasks).toHaveLength(FREE_PLAN_TASK_LIMIT);
      expect(
        persistedTasks.filter((task) => task.title.startsWith("Concurrent Task")),
      ).toHaveLength(1);
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
