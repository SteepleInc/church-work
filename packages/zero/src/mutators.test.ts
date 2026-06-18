import { DEFAULT_WORKFLOW_STATUSES, formatTaskIdentifier } from "@church-task/domain";
import { getIdType } from "@church-task/shared/get-ids";
import { mustGetMutator } from "@rocicorp/zero";
import { describe, expect, test } from "vitest";

import {
  activities,
  cycles,
  labels,
  tasks,
  team_memberships,
  teams,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";

import { buildTemplateCycleTaskInserts, mutators } from "./mutators";

const signedInContext = {
  active_church_id: "org_test",
  authenticated: true,
  church_role: "owner",
  is_app_admin: false,
  runtime: "server",
  session_id: "session_test",
  user_id: "user_test",
} as const;

describe("Zero Cycle mutators", () => {
  test("keeps existing Week details when ensuring an existing Week", async () => {
    const updateCalls: Array<{
      readonly table: unknown;
      readonly set: Record<string, unknown>;
      readonly where: unknown;
    }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          select: () => ({
            from: () => ({
              where: async () => [{ id: "cycle_easter" }],
            }),
          }),
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async (where: unknown) => {
                updateCalls.push({ table, set, where });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "cycles.upsert").fn({
      args: {
        church_id: "org_test",
        church_time_zone: "America/New_York",
        end_date: "2026-04-05",
        ends_at: "2026-04-06T04:00:00.000Z",
        start_date: "2026-03-30",
        starts_at: "2026-03-30T04:00:00.000Z",
      },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(cycles);
    expect(updateCalls[0]?.set).not.toHaveProperty("name");
    expect(updateCalls[0]?.set).not.toHaveProperty("description");
  });

  test("updates Week name and description without changing date boundaries", async () => {
    const updateCalls: Array<{
      readonly table: unknown;
      readonly set: Record<string, unknown>;
      readonly where: unknown;
    }> = [];
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async (where: unknown) => {
                updateCalls.push({ table, set, where });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "cycles.updateDetails").fn({
      args: {
        church_id: "org_test",
        cycle_id: "cycle_easter",
        description: "Coordinate Easter follow-up and volunteer care.",
        name: "Easter follow-up Week",
      },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(1);
    const cycleUpdate = updateCalls[0];
    expect(cycleUpdate).toBeDefined();
    expect(cycleUpdate?.table).toBe(cycles);
    expect(cycleUpdate?.set).toMatchObject({
      description: "Coordinate Easter follow-up and volunteer care.",
      name: "Easter follow-up Week",
      updated_by: "user_test",
    });
    expect(cycleUpdate?.set).not.toHaveProperty("start_date");
    expect(cycleUpdate?.set).not.toHaveProperty("end_date");
    expect(cycleUpdate?.set).not.toHaveProperty("starts_at");
    expect(cycleUpdate?.set).not.toHaveProperty("ends_at");
    expect(insertCalls.find((call) => call.table === activities)?.values).toMatchObject({
      entity_id: "cycle_easter",
      entity_type: "cycle",
      event_type: "cycle.updated",
    });
  });
});

describe("Zero Team mutators", () => {
  test("creates the Team, creator membership, owned Workflow, and default Workflow Statuses", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          select: () => ({
            from: () => ({
              where: async () => [{ identifier: "LEA", sort_order: 0 }],
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "teams.create").fn({
      args: { church_id: "org_test", name: "Leadership" },
      ctx: signedInContext,
      tx,
    });

    const teamInsert = insertCalls.find((call) => call.table === teams)?.values as {
      readonly id: string;
      readonly identifier: string;
    };
    const membershipInsert = insertCalls.find((call) => call.table === team_memberships)
      ?.values as {
      readonly team_id: string;
      readonly user_id: string;
    };
    const workflowInsert = insertCalls.find((call) => call.table === workflows)?.values as {
      readonly id: string;
      readonly team_id: string;
    };
    const statusInsert = insertCalls.find((call) => call.table === workflow_statuses)
      ?.values as Array<{
      readonly id: string;
      readonly key: string;
      readonly workflow_id: string;
    }>;

    expect(teamInsert.identifier).toBe("LEA2");
    expect(getIdType(teamInsert.id)).toBe("team");
    expect(membershipInsert).toMatchObject({ team_id: teamInsert.id, user_id: "user_test" });
    expect(workflowInsert.team_id).toBe(teamInsert.id);
    expect(getIdType(workflowInsert.id)).toBe("workflow");
    expect(statusInsert).toHaveLength(DEFAULT_WORKFLOW_STATUSES.length);
    expect(statusInsert.map((status) => status.key)).toEqual(
      DEFAULT_WORKFLOW_STATUSES.map((status) => status.key),
    );
    expect(statusInsert.every((status) => status.workflow_id === workflowInsert.id)).toBe(true);
    expect(statusInsert.every((status) => getIdType(status.id) === "workflowstatus")).toBe(true);
  });

  test("reorders Teams within the active Church", async () => {
    const updateCalls: Array<{
      readonly table: unknown;
      readonly set: unknown;
      readonly where: unknown;
    }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: () => ({ values: async () => {} }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async (where: unknown) => {
                updateCalls.push({ table, set, where });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "teams.reorder").fn({
      args: { church_id: "org_test", team_ids: ["team_two", "team_one"] },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.map((call) => call.table)).toEqual([teams, teams]);
    expect(
      updateCalls.map((call) => (call.set as { readonly sort_order: number }).sort_order),
    ).toEqual([0, 1]);
  });

  test("adds and removes Team Memberships", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const deleteCalls: Array<{ readonly table: unknown; readonly where: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          delete: (table: unknown) => ({
            where: async (where: unknown) => {
              deleteCalls.push({ table, where });
            },
          }),
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          select: () => ({
            from: () => ({
              where: async () => [],
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "teams.add_member").fn({
      args: { church_id: "org_test", team_id: "team_test", user_id: "user_two" },
      ctx: signedInContext,
      tx,
    });

    await mustGetMutator(mutators, "teams.remove_member").fn({
      args: { church_id: "org_test", team_id: "team_test", user_id: "user_two" },
      ctx: signedInContext,
      tx,
    });

    const membershipInsert = insertCalls.find((call) => call.table === team_memberships)
      ?.values as {
      readonly id: string;
      readonly user_id: string;
    };

    expect(getIdType(membershipInsert.id)).toBe("teammembership");
    expect(membershipInsert.user_id).toBe("user_two");
    expect(deleteCalls.map((call) => call.table)).toEqual([team_memberships]);
  });
});

describe("Zero Workflow mutators", () => {
  test("renames Workflows and Workflow Statuses", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: () => ({ values: async () => {} }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async () => {
                updateCalls.push({ table, set });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "workflows.rename").fn({
      args: { church_id: "org_test", name: "Planning", workflow_id: "workflow_test" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "workflows.rename_status").fn({
      args: { church_id: "org_test", name: "Queued", status_id: "workflowstatus_test" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([workflows, workflow_statuses]);
    expect(updateCalls.map((call) => (call.set as { readonly name: string }).name)).toEqual([
      "Planning",
      "Queued",
    ]);
  });

  test("reorders Workflows by updating their owning Teams", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: () => ({ values: async () => {} }),
          select: () => ({
            from: () => ({
              where: async () => [
                { id: "workflow_two", team_id: "team_two" },
                { id: "workflow_one", team_id: "team_one" },
              ],
            }),
          }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async () => {
                updateCalls.push({ table, set });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "workflows.reorder").fn({
      args: { church_id: "org_test", workflow_ids: ["workflow_two", "workflow_one"] },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([teams, teams]);
    expect(
      updateCalls.map((call) => (call.set as { readonly sort_order: number }).sort_order),
    ).toEqual([0, 1]);
  });

  test("adds, reorders, and archives Workflow Statuses", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const updateCalls: Array<{ readonly table: unknown; readonly set: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          select: () => ({
            from: () => ({
              where: async () => [{ id: "workflow_test" }],
            }),
          }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async () => {
                updateCalls.push({ table, set });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "workflows.add_status").fn({
      args: {
        church_id: "org_test",
        status: { key: "review", name: "Review", sort_order: 3, task_state: "in_progress" },
        workflow_id: "workflow_test",
      },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "workflows.reorder_statuses").fn({
      args: {
        church_id: "org_test",
        status_ids: ["workflowstatus_two", "workflowstatus_one"],
        workflow_id: "workflow_test",
      },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "workflows.archive_status").fn({
      args: { church_id: "org_test", status_id: "workflowstatus_two" },
      ctx: signedInContext,
      tx,
    });

    const statusInsert = insertCalls.find((call) => call.table === workflow_statuses)?.values as {
      readonly id: string;
      readonly key: string;
      readonly task_state: string;
    };

    expect(getIdType(statusInsert.id)).toBe("workflowstatus");
    expect(statusInsert).toMatchObject({ key: "review", task_state: "in_progress" });
    expect(updateCalls.map((call) => call.table)).toEqual([
      workflow_statuses,
      workflow_statuses,
      workflow_statuses,
    ]);
    expect(
      updateCalls
        .slice(0, 2)
        .map((call) => (call.set as { readonly sort_order: number }).sort_order),
    ).toEqual([0, 1]);
    const archiveUpdate = updateCalls[2];
    expect(archiveUpdate).toBeDefined();
    expect((archiveUpdate!.set as { readonly deleted_by: string }).deleted_by).toBe("user_test");
  });
});

describe("Zero Label mutators", () => {
  const createServerTx = (selectResults: Array<unknown>) => {
    const deleteCalls: Array<{ readonly table: unknown; readonly where: unknown }> = [];
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const updateCalls: Array<{
      readonly table: unknown;
      readonly set: unknown;
      readonly where: unknown;
    }> = [];
    const nextSelectResult = async () => selectResults.shift() ?? [];

    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          delete: (table: unknown) => ({
            where: async (where: unknown) => {
              deleteCalls.push({ table, where });
            },
          }),
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          select: () => ({
            from: () => ({
              where: nextSelectResult,
            }),
          }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async (where: unknown) => {
                updateCalls.push({ table, set, where });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    return { deleteCalls, insertCalls, tx, updateCalls };
  };

  test("creates Church and Team Labels with scoped uniqueness", async () => {
    const { insertCalls, tx } = createServerTx([
      [],
      [{ id: "team_worship" }],
      [{ id: "label_church", name: "Worship", team_id: null }],
    ]);

    await mustGetMutator(mutators, "labels.create").fn({
      args: { church_id: "org_test", name: "Worship" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "labels.create").fn({
      args: { church_id: "org_test", name: "Worship", team_id: "team_worship" },
      ctx: signedInContext,
      tx,
    });

    const labelInserts = insertCalls
      .filter((call) => call.table === labels)
      .map((call) => {
        return call.values as {
          readonly id: string;
          readonly name: string;
          readonly team_id: string | null;
        };
      });

    expect(labelInserts).toHaveLength(2);
    expect(labelInserts.every((label) => getIdType(label.id) === "label")).toBe(true);
    expect(labelInserts.map((label) => label.team_id)).toEqual([null, "team_worship"]);
  });

  test("updates Labels and hard-deletes them from Tasks", async () => {
    const { deleteCalls, tx, updateCalls } = createServerTx([
      [{ id: "label_worship", name: "Worship", team_id: null }],
      [{ id: "label_worship", name: "Worship", team_id: null }],
      [
        { id: "task_one", label_ids: '["label_worship","label_other"]' },
        { id: "task_two", label_ids: '["label_other"]' },
      ],
    ]);

    await mustGetMutator(mutators, "labels.update").fn({
      args: { church_id: "org_test", color: "blue", label_id: "label_worship", name: "Music" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "labels.delete").fn({
      args: { church_id: "org_test", label_id: "label_worship" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([labels, tasks]);
    expect(updateCalls[0]?.set).toMatchObject({ color: "blue", name: "Music" });
    expect(updateCalls[1]?.set).toMatchObject({ label_ids: '["label_other"]' });
    expect(deleteCalls.map((call) => call.table)).toEqual([labels]);
  });
});

describe("Zero Task mutators", () => {
  const createServerTx = (selectResults: Array<unknown>) => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const updateCalls: Array<{
      readonly table: unknown;
      readonly set: unknown;
      readonly where: unknown;
    }> = [];
    const nextSelectResult = async () => selectResults.shift() ?? [];

    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
          select: () => ({
            from: () => ({
              leftJoin: () => ({
                where: nextSelectResult,
              }),
              where: nextSelectResult,
            }),
          }),
          update: (table: unknown) => ({
            set: (set: unknown) => ({
              where: async (where: unknown) => {
                updateCalls.push({ table, set, where });
              },
            }),
          }),
        },
      },
      location: "server",
    } as never;

    return { insertCalls, tx, updateCalls };
  };

  test("creates Tasks with per-Team numbers, board order, and URL-facing identifiers", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [{ id: "workflowstatus_todo", task_state: "todo", workflow_id: "workflow_production" }],
      [{ id: "team_production", identifier: "PRO", next_task_number: 7 }],
      [{ id: "workflow_production" }],
      [],
      [{ board_order: "a1" }, { board_order: "a3" }],
    ]);

    await mustGetMutator(mutators, "tasks.create").fn({
      args: {
        church_id: "org_test",
        team_id: "team_production",
        title: "Prepare stage cues",
        workflow_status_id: "workflowstatus_todo",
      },
      ctx: signedInContext,
      tx,
    });

    const taskInsert = insertCalls.find((call) => call.table === tasks)?.values as {
      readonly board_order: string;
      readonly id: string;
      readonly number: number;
      readonly task_state: string;
      readonly title: string;
    };
    const teamUpdate = updateCalls.find((call) => call.table === teams)?.set as {
      readonly next_task_number: number;
    };
    const activityInsert = insertCalls.find((call) => call.table === activities)?.values as {
      readonly actor_id: string;
      readonly entity_id: string;
      readonly entity_type: string;
      readonly event_type: string;
      readonly metadata: string;
    };

    expect(getIdType(taskInsert.id)).toBe("task");
    expect(getIdType(activityInsert.entity_id)).toBe("task");
    expect(taskInsert).toMatchObject({
      board_order: "a4",
      number: 7,
      task_state: "todo",
      title: "Prepare stage cues",
    });
    expect(activityInsert).toMatchObject({
      actor_id: "user_test",
      entity_id: taskInsert.id,
      entity_type: "task",
      event_type: "task.created",
    });
    expect(JSON.parse(activityInsert.metadata)).toMatchObject({ team_id: "team_production" });
    expect(teamUpdate.next_task_number).toBe(8);
    expect(formatTaskIdentifier("PRO", taskInsert.number)).toBe("PRO-7");
  });

  test("updates board order through the batch Task path", async () => {
    const { tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 1,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      [
        {
          board_order: "a2",
          church_id: "org_test",
          deleted_at: null,
          finished_at: null,
          id: "task_two",
          label_ids: "[]",
          number: 2,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
    ]);

    await mustGetMutator(mutators, "tasks.update_batch").fn({
      args: {
        church_id: "org_test",
        updates: [
          { fields: { board_order: "a2" }, task_id: "task_one" },
          { fields: { board_order: "a1" }, task_id: "task_two" },
        ],
      },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([tasks, tasks]);
    expect(
      updateCalls.map((call) => (call.set as { readonly board_order: string }).board_order),
    ).toEqual(["a2", "a1"]);
  });

  test("strips foreign Team Labels when moving a Task between Teams", async () => {
    const { tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: '["label_church","label_old_team","label_missing"]',
          number: 1,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_old",
          team_identifier: "OLD",
          workflow_id: "workflow_old",
          workflow_status_id: "workflowstatus_todo_old",
        },
      ],
      [{ id: "team_new", identifier: "NEW", next_task_number: 4 }],
      [{ id: "workflow_new" }],
      [{ id: "workflowstatus_todo_new", task_state: "todo" }],
      [
        { id: "label_church", name: "Church Label", team_id: null },
        { id: "label_old_team", name: "Old Team Label", team_id: "team_old" },
        { id: "label_new_team", name: "New Team Label", team_id: "team_new" },
      ],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: { church_id: "org_test", fields: { team_id: "team_new" }, task_id: "task_one" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([teams, tasks]);
    expect(updateCalls[1]?.set).toMatchObject({
      label_ids: '["label_church"]',
      team_id: "team_new",
      workflow_id: "workflow_new",
      workflow_status_id: "workflowstatus_todo_new",
    });
  });

  test("complete and reopen move Tasks through workflow statuses", async () => {
    const { tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 1,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      [{ id: "workflowstatus_done" }],
      [
        {
          board_order: "a1",
          church_id: "org_test",
          deleted_at: null,
          finished_at: new Date("2026-01-01T00:00:00.000Z"),
          id: "task_one",
          label_ids: "[]",
          number: 1,
          previous_identifiers: "[]",
          task_state: "done",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_done",
        },
      ],
      [{ id: "workflowstatus_todo" }],
    ]);

    await mustGetMutator(mutators, "tasks.complete").fn({
      args: { church_id: "org_test", task_id: "task_one" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "tasks.reopen").fn({
      args: { church_id: "org_test", task_id: "task_one" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([tasks, tasks]);
    expect(updateCalls[0]?.set).toMatchObject({
      task_state: "done",
      workflow_status_id: "workflowstatus_done",
    });
    expect(updateCalls[1]?.set).toMatchObject({
      finished_at: null,
      task_state: "todo",
      workflow_status_id: "workflowstatus_todo",
    });
  });
});

describe("Zero Template and Cycle projection", () => {
  test("materializes adjusted Template Tasks into Cycle Tasks with local-date due dates", () => {
    const projection = buildTemplateCycleTaskInserts({
      adjustments: [
        {
          lifecycle: "active",
          overrides: JSON.stringify([{ field: "title", value: "Prepare Easter rehearsal" }]),
          template_task_id: "templatetask_rehearsal",
        },
      ],
      church_id: "org_test",
      cycle: { id: "cycle_easter", start_date: "2026-03-30" },
      focus_windows: [
        {
          anchor_date: "2026-04-05",
          end_date: "2026-04-05",
          id: "focuswindow_easter",
          start_date: "2026-03-30",
        },
      ],
      key_date_occurrences: [],
      now: new Date("2026-01-01T00:00:00.000Z"),
      session_user_id: "user_test",
      start_number_by_team_id: new Map([["team_worship", 7]]),
      template_id: "template_easter",
      template_tasks: [
        {
          id: "templatetask_rehearsal",
          key: "rehearsal",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({
            edge: "start",
            focusWindowId: "focuswindow_easter",
            kind: "relativeToFocusWindow",
            offsetDays: 2,
          }),
          template_team_id: "templateteam_worship",
          title: "Prepare rehearsal",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      todo_status_by_workflow_id: new Map([
        ["workflow_worship", { id: "workflowstatus_todo", workflow_id: "workflow_worship" }],
      ]),
      workflow_by_team_id: new Map([
        ["team_worship", { id: "workflow_worship", team_id: "team_worship" }],
      ]),
    });

    expect(projection.inserts).toHaveLength(1);
    expect(projection.inserts[0]).toMatchObject({
      church_id: "org_test",
      cycle_id: "cycle_easter",
      due_date: "2026-04-01",
      number: 7,
      source_template_cycle_id: "cycle_easter",
      source_template_id: "template_easter",
      source_template_sync_enabled: true,
      source_template_task_id: "templatetask_rehearsal",
      task_state: "todo",
      team_id: "team_worship",
      title: "Prepare Easter rehearsal",
      workflow_status_id: "workflowstatus_todo",
    });
    expect(projection.nextNumberByTeamId.get("team_worship")).toBe(8);
  });

  test("links projected child Tasks to projected parent Tasks", () => {
    const projection = buildTemplateCycleTaskInserts({
      adjustments: [],
      church_id: "org_test",
      cycle: { id: "cycle_easter", start_date: "2026-03-30" },
      focus_windows: [],
      key_date_occurrences: [],
      now: new Date("2026-01-01T00:00:00.000Z"),
      session_user_id: "user_test",
      start_number_by_team_id: new Map([["team_worship", 7]]),
      template_id: "template_easter",
      template_tasks: [
        {
          id: "templatetask_parent",
          key: "parent",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-01" }),
          template_team_id: "templateteam_worship",
          title: "Prepare service plan",
        },
        {
          id: "templatetask_child",
          key: "child",
          parent_template_task_id: "templatetask_parent",
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-02" }),
          template_team_id: "templateteam_worship",
          title: "Confirm readers",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      todo_status_by_workflow_id: new Map([
        ["workflow_worship", { id: "workflowstatus_todo", workflow_id: "workflow_worship" }],
      ]),
      workflow_by_team_id: new Map([
        ["team_worship", { id: "workflow_worship", team_id: "team_worship" }],
      ]),
    });

    const [parent, child] = projection.inserts;

    expect(parent?.parent_task_id).toBeNull();
    expect(child?.parent_task_id).toBe(parent?.id);
    expect(child).toMatchObject({
      due_date: "2026-04-02",
      source_template_task_id: "templatetask_child",
      title: "Confirm readers",
    });
  });

  test("does not duplicate existing projected Template Tasks for the same Cycle", () => {
    const projection = buildTemplateCycleTaskInserts({
      adjustments: [],
      church_id: "org_test",
      cycle: { id: "cycle_easter", start_date: "2026-03-30" },
      existing_projected_tasks: [
        { id: "task_existing_parent", source_template_task_id: "templatetask_parent" },
      ],
      focus_windows: [],
      key_date_occurrences: [],
      now: new Date("2026-01-01T00:00:00.000Z"),
      session_user_id: "user_test",
      start_number_by_team_id: new Map([["team_worship", 7]]),
      template_id: "template_easter",
      template_tasks: [
        {
          id: "templatetask_parent",
          key: "parent",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-01" }),
          template_team_id: "templateteam_worship",
          title: "Prepare service plan",
        },
        {
          id: "templatetask_child",
          key: "child",
          parent_template_task_id: "templatetask_parent",
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-02" }),
          template_team_id: "templateteam_worship",
          title: "Confirm readers",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      todo_status_by_workflow_id: new Map([
        ["workflow_worship", { id: "workflowstatus_todo", workflow_id: "workflow_worship" }],
      ]),
      workflow_by_team_id: new Map([
        ["team_worship", { id: "workflow_worship", team_id: "team_worship" }],
      ]),
    });

    expect(projection.inserts).toHaveLength(1);
    expect(projection.inserts[0]).toMatchObject({
      number: 7,
      parent_task_id: "task_existing_parent",
      source_template_task_id: "templatetask_child",
    });
    expect(projection.nextNumberByTeamId.get("team_worship")).toBe(8);
  });
});
