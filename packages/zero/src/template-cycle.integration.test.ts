import { startPostgresHarness } from "@church-task/test-harness";
import { mustGetMutator } from "@rocicorp/zero";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  cycle_adjustments,
  cycles,
  focus_windows,
  tasks,
  teams,
  template_tasks,
  template_teams,
  templates,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";

import { mutators } from "./mutators";

const now = new Date("2026-01-01T00:00:00.000Z");
const churchId = "org_integration";
const userId = "user_integration";

const sessionContext = {
  active_church_id: churchId,
  authenticated: true,
  church_role: "owner",
  is_app_admin: false,
  runtime: "server",
  session_id: "session_integration",
  user_id: userId,
} as const;

const baseEntity = (tag: string) => ({
  _tag: tag,
  created_at: now,
  created_by: userId,
  updated_at: now,
  updated_by: userId,
});

describe("template-to-cycle projection integration", () => {
  test("projects Template Tasks into Cycle Tasks through Drizzle tables", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await db.insert(teams).values({
        ...baseEntity("team"),
        church_id: churchId,
        color: "blue",
        id: "team_worship_integration",
        identifier: "WOR",
        name: "Worship",
        next_task_number: 12,
        previous_identifiers: "[]",
        sort_order: 0,
      });
      await db.insert(workflows).values({
        ...baseEntity("workflow"),
        church_id: churchId,
        id: "workflow_worship_integration",
        name: "Worship Workflow",
        team_id: "team_worship_integration",
      });
      await db.insert(workflow_statuses).values({
        ...baseEntity("workflowstatus"),
        church_id: churchId,
        id: "workflowstatus_todo_integration",
        key: "todo",
        name: "To Do",
        sort_order: 0,
        task_state: "todo",
        workflow_id: "workflow_worship_integration",
      });
      await db.insert(cycles).values({
        ...baseEntity("cycle"),
        church_id: churchId,
        church_time_zone: "America/New_York",
        end_date: "2026-04-05",
        ends_at: new Date("2026-04-06T03:59:59.999Z"),
        id: "cycle_easter_integration",
        start_date: "2026-03-30",
        starts_at: new Date("2026-03-30T04:00:00.000Z"),
      });
      await db.insert(templates).values({
        ...baseEntity("template"),
        church_id: churchId,
        id: "template_easter_integration",
        key: "easter",
        name: "Easter",
        recurrence: "annual",
      });
      await db.insert(template_teams).values({
        ...baseEntity("templateteam"),
        church_id: churchId,
        id: "templateteam_worship_integration",
        key: "worship",
        mapped_team_id: "team_worship_integration",
        name: "Worship",
        template_id: "template_easter_integration",
      });
      await db.insert(focus_windows).values({
        ...baseEntity("focuswindow"),
        anchor_date: "2026-04-05",
        church_id: churchId,
        end_date: "2026-04-05",
        id: "focuswindow_easter_integration",
        key: "holy-week",
        key_date_id: null,
        name: "Holy Week",
        start_date: "2026-03-30",
        template_id: "template_easter_integration",
        type: "key-date-window",
      });
      await db.insert(template_tasks).values([
        {
          ...baseEntity("templatetask"),
          church_id: churchId,
          id: "templatetask_parent_integration",
          key: "service-plan",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({
            edge: "start",
            focusWindowId: "focuswindow_easter_integration",
            kind: "relativeToFocusWindow",
            offsetDays: 1,
          }),
          template_id: "template_easter_integration",
          template_team_id: "templateteam_worship_integration",
          title: "Prepare service plan",
        },
        {
          ...baseEntity("templatetask"),
          church_id: churchId,
          id: "templatetask_child_integration",
          key: "reader-confirmation",
          parent_template_task_id: "templatetask_parent_integration",
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-02" }),
          template_id: "template_easter_integration",
          template_team_id: "templateteam_worship_integration",
          title: "Confirm readers",
        },
      ]);
      await db.insert(cycle_adjustments).values({
        ...baseEntity("cycleadjustment"),
        church_id: churchId,
        cycle_id: "cycle_easter_integration",
        id: "cycleadjustment_parent_integration",
        lifecycle: "active",
        overrides: JSON.stringify([{ field: "title", value: "Prepare Easter service plan" }]),
        template_task_id: "templatetask_parent_integration",
      });

      const tx = {
        dbTransaction: { wrappedTransaction: db },
        location: "server",
      } as never;

      await mustGetMutator(mutators, "templates.project_cycle").fn({
        args: {
          church_id: churchId,
          cycle_id: "cycle_easter_integration",
          template_id: "template_easter_integration",
        },
        ctx: sessionContext,
        tx,
      });

      const projectedTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.cycle_id, "cycle_easter_integration"));
      const projectedTeam = await db
        .select({ next_task_number: teams.next_task_number })
        .from(teams)
        .where(eq(teams.id, "team_worship_integration"));
      const parentTask = projectedTasks.find(
        (task) => task.source_template_task_id === "templatetask_parent_integration",
      );
      const childTask = projectedTasks.find(
        (task) => task.source_template_task_id === "templatetask_child_integration",
      );

      expect(projectedTasks).toHaveLength(2);
      expect(projectedTasks.map((task) => task.number).sort((left, right) => left - right)).toEqual(
        [12, 13],
      );
      expect(parentTask).toMatchObject({
        church_id: churchId,
        cycle_id: "cycle_easter_integration",
        due_date: "2026-03-31",
        parent_task_id: null,
        source_template_cycle_id: "cycle_easter_integration",
        source_template_id: "template_easter_integration",
        source_template_occurrence_key: null,
        source_template_schedule_id: null,
        source_template_sync_enabled: false,
        source_template_task_id: "templatetask_parent_integration",
        task_state: "todo",
        title: "Prepare Easter service plan",
        workflow_id: "workflow_worship_integration",
        workflow_status_id: "workflowstatus_todo_integration",
      });
      expect(childTask).toMatchObject({
        due_date: "2026-04-02",
        parent_task_id: parentTask?.id,
        source_template_task_id: "templatetask_child_integration",
        title: "Confirm readers",
      });
      expect(projectedTeam[0]?.next_task_number).toBe(14);

      await mustGetMutator(mutators, "templates.project_cycle").fn({
        args: {
          church_id: churchId,
          cycle_id: "cycle_easter_integration",
          template_id: "template_easter_integration",
        },
        ctx: sessionContext,
        tx,
      });

      const projectedAgain = await db
        .select()
        .from(tasks)
        .where(eq(tasks.cycle_id, "cycle_easter_integration"));
      const teamAgain = await db
        .select({ next_task_number: teams.next_task_number })
        .from(teams)
        .where(eq(teams.id, "team_worship_integration"));

      expect(projectedAgain).toHaveLength(2);
      expect(teamAgain[0]?.next_task_number).toBe(14);
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
