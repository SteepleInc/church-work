import { DEFAULT_WORKFLOW_STATUSES, formatTaskIdentifier } from "@church-task/domain";
import { getIdType } from "@church-task/shared/get-ids";
import { mustGetMutator } from "@rocicorp/zero";
import { describe, expect, test } from "vitest";

import {
  activities,
  cycle_adjustments,
  cycles,
  focus_windows,
  key_dates,
  labels,
  notifications,
  tasks,
  task_comment_subscriptions,
  task_comments,
  team_memberships,
  teams,
  workflow_statuses,
  workflows,
  template_schedules,
  template_tasks,
  template_teams,
  templates,
} from "@church-task/db/schema";

import {
  buildTemplateCycleTaskInserts,
  buildTemplateCycleTaskProjections,
  mutators,
} from "./mutators";

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
  test("marks only the signed-in recipient's notification read", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: Record<string, unknown> }> =
      [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async () => updateCalls.push({ table, set }),
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "notifications.mark_read").fn({
      args: { church_id: "org_test", notification_id: "notification_test" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(notifications);
    expect(updateCalls[0]?.set).toMatchObject({ read_by: "user_test", updated_by: "user_test" });
    expect(updateCalls[0]?.set.read_at).toBeInstanceOf(Date);
  });

  test("supports scoped Inbox read/unread and soft-delete actions", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: Record<string, unknown> }> =
      [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async () => updateCalls.push({ table, set }),
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "notifications.mark_unread").fn({
      args: { church_id: "org_test", notification_id: "notification_test" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "notifications.mark_all_read").fn({
      args: { church_id: "org_test" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "notifications.delete").fn({
      args: { church_id: "org_test", notification_id: "notification_test" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "notifications.delete_read").fn({
      args: { church_id: "org_test" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(4);
    expect(updateCalls.every((call) => call.table === notifications)).toBe(true);
    expect(updateCalls[0]?.set).toMatchObject({
      read_at: null,
      read_by: null,
      updated_by: "user_test",
    });
    expect(updateCalls[1]?.set).toMatchObject({ read_by: "user_test", updated_by: "user_test" });
    expect(updateCalls[1]?.set.read_at).toBeInstanceOf(Date);
    expect(updateCalls[2]?.set).toMatchObject({
      deleted_by: "user_test",
      updated_by: "user_test",
    });
    expect(updateCalls[2]?.set.deleted_at).toBeInstanceOf(Date);
    expect(updateCalls[3]?.set).toMatchObject({
      deleted_by: "user_test",
      updated_by: "user_test",
    });
    expect(updateCalls[3]?.set.deleted_at).toBeInstanceOf(Date);
  });

  test("soft-deletes and restores Templates without hard delete", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: Record<string, unknown> }> =
      [];
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => insertCalls.push({ table, values }),
          }),
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async () => updateCalls.push({ table, set }),
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "templates.delete").fn({
      args: { church_id: "org_test", id: "template_service" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "templates.restore").fn({
      args: { church_id: "org_test", id: "template_service" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls[0]?.table).toBe(templates);
    expect(updateCalls[0]?.set.deleted_at).toBeInstanceOf(Date);
    expect(updateCalls[1]?.table).toBe(templates);
    expect(updateCalls[1]?.set).toMatchObject({ deleted_at: null, deleted_by: null });
    expect(insertCalls.map((call) => (call.values as { event_type?: string }).event_type)).toEqual([
      "template.deleted",
      "template.restored",
    ]);
  });

  test("soft-deletes and restores Template Tasks and Schedules without changing identity", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: Record<string, unknown> }> =
      [];
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => insertCalls.push({ table, values }),
          }),
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async () => updateCalls.push({ table, set }),
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "template_tasks.delete").fn({
      args: { church_id: "org_test", id: "templatetask_plan_setlist" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "template_tasks.restore").fn({
      args: { church_id: "org_test", id: "templatetask_plan_setlist" },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "template_schedules.delete").fn({
      args: {
        church_id: "org_test",
        cleanup_current_occurrence: false,
        current_date: "2026-06-15",
        current_occurrence_key: "weekly:2026-06-21:sunday",
        id: "templateschedule_sunday_service",
      },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "template_schedules.restore").fn({
      args: { church_id: "org_test", id: "templateschedule_sunday_service" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([
      template_tasks,
      template_tasks,
      template_schedules,
      template_schedules,
    ]);
    expect(updateCalls[0]?.set.deleted_at).toBeInstanceOf(Date);
    expect(updateCalls[1]?.set).toMatchObject({ deleted_at: null, deleted_by: null });
    expect(updateCalls[2]?.set.deleted_at).toBeInstanceOf(Date);
    expect(updateCalls[3]?.set).toMatchObject({ deleted_at: null, deleted_by: null });
    expect(insertCalls.map((call) => (call.values as { event_type?: string }).event_type)).toEqual([
      "template_task.deleted",
      "template_task.restored",
      "template_schedule.deleted",
      "template_schedule.restored",
    ]);
  });

  test("schedule cleanup soft-deletes future occurrence Tasks and adjustments", async () => {
    const updateCalls: Array<{ readonly table: unknown; readonly set: Record<string, unknown> }> =
      [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: () => ({ values: async () => {} }),
          update: (table: unknown) => ({
            set: (set: Record<string, unknown>) => ({
              where: async () => updateCalls.push({ table, set }),
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "template_schedules.delete").fn({
      args: {
        church_id: "org_test",
        cleanup_current_occurrence: true,
        current_date: "2026-06-15",
        current_occurrence_key: "weekly:2026-06-21:sunday",
        id: "templateschedule_sunday_service",
      },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls.map((call) => call.table)).toEqual([
      template_schedules,
      cycle_adjustments,
      tasks,
    ]);
    expect(updateCalls.every((call) => call.set.deleted_at instanceof Date)).toBe(true);
  });

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

describe("Zero Key Date mutators", () => {
  test("creates Church-owned Key Dates with rule schedules and activity", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "key_dates.create").fn({
      args: {
        church_id: "org_test",
        key: "easter-service",
        name: "Easter Service",
        schedule: { kind: "computedYearly", rule: "easter" },
      },
      ctx: signedInContext,
      tx,
    });

    const keyDateInsert = insertCalls.find((call) => call.table === key_dates)?.values as {
      readonly id: string;
      readonly schedule: string;
    };
    expect(getIdType(keyDateInsert.id)).toBe("keydate");
    expect(keyDateInsert).toMatchObject({
      _tag: "keydate",
      church_id: "org_test",
      key: "easter-service",
      name: "Easter Service",
      schedule: JSON.stringify({ kind: "computedYearly", rule: "easter" }),
    });
    expect(insertCalls.find((call) => call.table === activities)?.values).toMatchObject({
      church_id: "org_test",
      entity_id: keyDateInsert.id,
      entity_type: "key_date",
      event_type: "key_date.created",
    });
  });

  test("updates and soft-deletes Key Dates within the active Church", async () => {
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

    await mustGetMutator(mutators, "key_dates.update").fn({
      args: {
        church_id: "org_test",
        key: "christmas-eve",
        key_date_id: "keydate_christmas",
        name: "Christmas Eve",
        schedule: { day: 24, kind: "fixedYearly", month: 12 },
      },
      ctx: signedInContext,
      tx,
    });
    await mustGetMutator(mutators, "key_dates.delete").fn({
      args: { church_id: "org_test", key_date_id: "keydate_christmas" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]?.table).toBe(key_dates);
    expect(updateCalls[0]?.set).toMatchObject({
      key: "christmas-eve",
      name: "Christmas Eve",
      schedule: JSON.stringify({ kind: "fixedYearly", month: 12, day: 24 }),
      updated_by: "user_test",
    });
    expect(updateCalls[1]?.table).toBe(key_dates);
    expect(updateCalls[1]?.set).toMatchObject({ updated_by: "user_test" });
    expect(updateCalls[1]?.set.deleted_at).toBeInstanceOf(Date);
    expect(insertCalls.map((call) => call.values)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity_id: "keydate_christmas", event_type: "key_date.updated" }),
        expect.objectContaining({ entity_id: "keydate_christmas", event_type: "key_date.deleted" }),
      ]),
    );
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
  type InsertCall = {
    onConflictDoNothing?: boolean;
    readonly table: unknown;
    readonly values: unknown;
  };

  const createServerTx = (selectResults: Array<unknown>) => {
    const insertCalls: InsertCall[] = [];
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
              const call: InsertCall = { table, values };
              insertCalls.push(call);
              return {
                onConflictDoNothing: async () => {
                  call.onConflictDoNothing = true;
                },
              };
            },
          }),
          select: () => {
            // `.where(...)` is the terminal step: it resolves to the next canned
            // select result when awaited, and also exposes `.limit(...)` for the
            // queries that page their results. `leftJoin` is chainable so any
            // number of joins works.
            const terminal = () => {
              const result = nextSelectResult();
              return Object.assign(result, { limit: () => result });
            };
            const fromBuilder: {
              leftJoin: () => typeof fromBuilder;
              where: () => ReturnType<typeof terminal>;
            } = {
              leftJoin: () => fromBuilder,
              where: terminal,
            };
            return { from: () => fromBuilder };
          },
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

  // The extra current-value row returned by getTaskWithActivityFields' second
  // select (title/assignee/due/estimate/priority/team name/status name), used to
  // compute Activity before/after metadata. Tests that load a Task for update
  // must supply this row right after the base getTaskWithTeamIdentifier row.
  const taskActivityFieldsRow = {
    assigned_user_id: null,
    due_date: null,
    estimate: null,
    priority: null,
    team_name: "Production",
    title: "Existing task",
    workflow_status_name: "To Do",
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
      readonly cycle_id: string | null;
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
      cycle_id: null,
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

  test("creates top-level Task Comments and logs comment-created Activity", async () => {
    const { insertCalls, tx } = createServerTx([[{ id: "task_test", cycle_id: "cycle_test" }]]);

    await mustGetMutator(mutators, "task_comments.create").fn({
      args: {
        body: "First line\n\nSecond line",
        church_id: "org_test",
        task_id: "task_test",
      },
      ctx: signedInContext,
      tx,
    });

    const commentInsert = insertCalls.find((call) => call.table === task_comments)?.values as {
      readonly authored_by_user_id: string;
      readonly body: string;
      readonly id: string;
      readonly parent_comment_id: string | null;
      readonly task_id: string;
    };
    const activityInsert = insertCalls.find((call) => call.table === activities)?.values as {
      readonly entity_id: string;
      readonly entity_type: string;
      readonly event_type: string;
      readonly metadata: string;
    };

    expect(getIdType(commentInsert.id)).toBe("taskcomment");
    expect(commentInsert).toMatchObject({
      authored_by_user_id: "user_test",
      body: "First line\n\nSecond line",
      parent_comment_id: null,
      task_id: "task_test",
    });
    expect(activityInsert).toMatchObject({
      entity_id: "task_test",
      entity_type: "task",
      event_type: "comment_created",
    });
    expect(JSON.parse(activityInsert.metadata)).toMatchObject({ comment_id: commentInsert.id });
  });

  test("creates one-level Task Comment replies and logs hidden reply-created Activity", async () => {
    const { insertCalls, tx } = createServerTx([
      [{ id: "task_test", cycle_id: "cycle_test" }],
      [{ id: "taskcomment_root", parent_comment_id: null }],
    ]);

    await mustGetMutator(mutators, "task_comments.create").fn({
      args: {
        body: "Reply line one\nReply line two",
        church_id: "org_test",
        parent_comment_id: "taskcomment_root",
        task_id: "task_test",
      },
      ctx: signedInContext,
      tx,
    });

    const commentInsert = insertCalls.find((call) => call.table === task_comments)?.values as {
      readonly body: string;
      readonly id: string;
      readonly parent_comment_id: string | null;
    };
    const activityInsert = insertCalls.find((call) => call.table === activities)?.values as {
      readonly event_type: string;
      readonly metadata: string;
    };

    expect(commentInsert).toMatchObject({
      body: "Reply line one\nReply line two",
      parent_comment_id: "taskcomment_root",
    });
    expect(activityInsert.event_type).toBe("reply_created");
    expect(JSON.parse(activityInsert.metadata)).toMatchObject({
      comment_id: commentInsert.id,
      parent_comment_id: "taskcomment_root",
    });
  });

  test("rejects replies to Task Comment replies", async () => {
    const { insertCalls, tx } = createServerTx([
      [{ id: "task_test", cycle_id: "cycle_test" }],
      [{ id: "taskcomment_reply", parent_comment_id: "taskcomment_root" }],
    ]);

    await expect(
      mustGetMutator(mutators, "task_comments.create").fn({
        args: {
          body: "Nested reply",
          church_id: "org_test",
          parent_comment_id: "taskcomment_reply",
          task_id: "task_test",
        },
        ctx: signedInContext,
        tx,
      }),
    ).rejects.toThrow("Replies can only be one level deep.");

    expect(insertCalls).toEqual([]);
  });

  test("lets Task Comment authors edit comments and logs hidden audit Activity", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          authored_by_user_id: "user_test",
          deleted_at: null,
          parent_comment_id: null,
          task_id: "task_test",
        },
      ],
      [{ cycle_id: "cycle_test" }],
    ]);

    await mustGetMutator(mutators, "task_comments.update").fn({
      args: { body: "Edited body", church_id: "org_test", comment_id: "taskcomment_root" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls[0]?.table).toBe(task_comments);
    expect(updateCalls[0]?.set).toMatchObject({ body: "Edited body", updated_by: "user_test" });
    const activityInsert = insertCalls.find((call) => call.table === activities)?.values as {
      readonly event_type: string;
      readonly metadata: string;
    };
    expect(activityInsert.event_type).toBe("comment_updated");
    expect(JSON.parse(activityInsert.metadata)).toMatchObject({ comment_id: "taskcomment_root" });
  });

  test("soft-deletes Task Comment replies as tombstones and logs hidden audit Activity", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          authored_by_user_id: "user_test",
          deleted_at: null,
          parent_comment_id: "taskcomment_root",
          task_id: "task_test",
        },
      ],
      [{ cycle_id: "cycle_test" }],
    ]);

    await mustGetMutator(mutators, "task_comments.delete").fn({
      args: { church_id: "org_test", comment_id: "taskcomment_reply" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls[0]?.table).toBe(task_comments);
    expect(updateCalls[0]?.set).toMatchObject({ deleted_by: "user_test", updated_by: "user_test" });
    const commentUpdate = updateCalls[0]?.set as { readonly deleted_at?: unknown } | undefined;
    expect(commentUpdate?.deleted_at).toBeInstanceOf(Date);
    const activityInsert = insertCalls.find((call) => call.table === activities)?.values as {
      readonly event_type: string;
      readonly metadata: string;
    };
    expect(activityInsert.event_type).toBe("comment_deleted");
    expect(JSON.parse(activityInsert.metadata)).toMatchObject({
      comment_id: "taskcomment_reply",
      parent_comment_id: "taskcomment_root",
    });
  });

  test("denies Task Comment edits by non-author non-admin Users", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          authored_by_user_id: "user_other",
          deleted_at: null,
          parent_comment_id: null,
          task_id: "task_test",
        },
      ],
    ]);

    await expect(
      mustGetMutator(mutators, "task_comments.update").fn({
        args: { body: "Bad edit", church_id: "org_test", comment_id: "taskcomment_root" },
        ctx: { ...signedInContext, church_role: "member" },
        tx,
      }),
    ).rejects.toThrow("Only comment authors and admins can edit comments.");

    expect(updateCalls).toEqual([]);
    expect(insertCalls).toEqual([]);
  });

  test("lets Church admins delete any Task Comment", async () => {
    const { updateCalls, tx } = createServerTx([
      [
        {
          authored_by_user_id: "user_other",
          deleted_at: null,
          parent_comment_id: null,
          task_id: "task_test",
        },
      ],
      [{ cycle_id: "cycle_test" }],
    ]);

    await mustGetMutator(mutators, "task_comments.delete").fn({
      args: { church_id: "org_test", comment_id: "taskcomment_root" },
      ctx: { ...signedInContext, church_role: "admin" },
      tx,
    });

    expect(updateCalls[0]?.set).toMatchObject({ deleted_by: "user_test" });
  });

  test("persists Task Comment thread subscriptions for the current User", async () => {
    const { insertCalls, tx } = createServerTx([
      [{ id: "taskcomment_root", parent_comment_id: null, task_id: "task_test" }],
    ]);

    await mustGetMutator(mutators, "task_comments.subscribe").fn({
      args: { church_id: "org_test", root_comment_id: "taskcomment_root" },
      ctx: signedInContext,
      tx,
    });

    const subscriptionInsert = insertCalls.find((call) => call.table === task_comment_subscriptions)
      ?.values as {
      readonly id: string;
      readonly root_comment_id: string;
      readonly task_id: string;
      readonly user_id: string;
    };
    expect(getIdType(subscriptionInsert.id)).toBe("taskcommentsubscription");
    expect(subscriptionInsert).toMatchObject({
      root_comment_id: "taskcomment_root",
      task_id: "task_test",
      user_id: "user_test",
    });
  });

  test("creates reply Notifications for subscribed active Church members", async () => {
    const { insertCalls, tx } = createServerTx([
      [
        {
          cycle_id: "cycle_test",
          id: "task_test",
          number: 7,
          team_identifier: "PRO",
          title: "Prepare stage cues",
        },
      ],
      [{ id: "taskcomment_root", parent_comment_id: null }],
      [{ user_id: "user_test" }, { user_id: "user_subscriber" }, { user_id: "user_non_member" }],
      [{ userId: "user_test" }, { userId: "user_subscriber" }],
    ]);

    await mustGetMutator(mutators, "task_comments.create").fn({
      args: {
        body: "Reply with useful context",
        church_id: "org_test",
        parent_comment_id: "taskcomment_root",
        task_id: "task_test",
      },
      ctx: signedInContext,
      tx,
    });

    const notificationInserts = insertCalls
      .filter((call) => call.table === notifications)
      .map((call) => call.values as { readonly [key: string]: unknown });

    expect(notificationInserts).toHaveLength(1);
    expect(getIdType(notificationInserts[0]?.id as string)).toBe("notification");
    expect(JSON.parse(notificationInserts[0]?.display_metadata as string)).toEqual({
      comment_excerpt: "Reply with useful context",
      task_identifier: "PRO-7",
      task_title: "Prepare stage cues",
    });
    expect(notificationInserts[0]).toMatchObject({
      _tag: "notification",
      activity_id: expect.stringMatching(/^activity_/),
      church_id: "org_test",
      display_body: "Reply with useful context",
      display_title: "New reply on PRO-7 Prepare stage cues",
      idempotency_key: expect.stringContaining(":taskcomment_root:"),
      read_at: null,
      recipient_user_id: "user_subscriber",
      snoozed_until: null,
      task_comment_id: expect.stringMatching(/^taskcomment_/),
      task_comment_thread_id: "taskcomment_root",
      task_id: "task_test",
      type: "task_comment_reply",
    });
    expect(insertCalls.find((call) => call.table === notifications)?.onConflictDoNothing).toBe(
      true,
    );
  });

  test("unsubscribes the current User from a Task Comment thread by soft delete", async () => {
    const { tx, updateCalls } = createServerTx([]);

    await mustGetMutator(mutators, "task_comments.unsubscribe").fn({
      args: { church_id: "org_test", root_comment_id: "taskcomment_root" },
      ctx: signedInContext,
      tx,
    });

    expect(updateCalls[0]?.table).toBe(task_comment_subscriptions);
    expect(updateCalls[0]?.set).toMatchObject({ deleted_by: "user_test", updated_by: "user_test" });
    const subscriptionUpdate = updateCalls[0]?.set as { readonly deleted_at?: unknown } | undefined;
    expect(subscriptionUpdate?.deleted_at).toBeInstanceOf(Date);
  });

  test("creates Week-context Tasks in an existing Cycle", async () => {
    const { insertCalls, tx } = createServerTx([
      [{ id: "workflowstatus_todo", task_state: "todo", workflow_id: "workflow_production" }],
      [{ id: "team_production", identifier: "PRO", next_task_number: 7 }],
      [{ id: "workflow_production" }],
      [],
      [],
      [{ id: "cycle_current" }],
    ]);

    await mustGetMutator(mutators, "tasks.create").fn({
      args: {
        church_id: "org_test",
        target_cycle: {
          church_time_zone: "America/New_York",
          end_date: "2026-07-05",
          ends_at: "2026-07-06T04:00:00.000Z",
          start_date: "2026-06-29",
          starts_at: "2026-06-30T04:00:00.000Z",
        },
        team_id: "team_production",
        title: "Plan Week work",
        workflow_status_id: "workflowstatus_todo",
      },
      ctx: signedInContext,
      tx,
    });

    const taskInsert = insertCalls.find((call) => call.table === tasks)?.values as {
      readonly cycle_id: string | null;
    };
    expect(insertCalls.some((call) => call.table === cycles)).toBe(false);
    expect(taskInsert.cycle_id).toBe("cycle_current");
  });

  test("materializes projected Week Cycles before creating Tasks", async () => {
    const { insertCalls, tx } = createServerTx([
      [{ id: "workflowstatus_todo", task_state: "todo", workflow_id: "workflow_production" }],
      [{ id: "team_production", identifier: "PRO", next_task_number: 7 }],
      [{ id: "workflow_production" }],
      [],
      [],
      [],
    ]);

    await mustGetMutator(mutators, "tasks.create").fn({
      args: {
        church_id: "org_test",
        target_cycle: {
          church_time_zone: "America/New_York",
          end_date: "2026-08-02",
          ends_at: "2026-08-03T04:00:00.000Z",
          start_date: "2026-07-27",
          starts_at: "2026-07-28T04:00:00.000Z",
        },
        team_id: "team_production",
        title: "Future Week work",
        workflow_status_id: "workflowstatus_todo",
      },
      ctx: signedInContext,
      tx,
    });

    const cycleInsert = insertCalls.find((call) => call.table === cycles)?.values as {
      readonly id: string;
      readonly start_date: string;
    };
    const taskInsert = insertCalls.find((call) => call.table === tasks)?.values as {
      readonly cycle_id: string | null;
    };
    expect(cycleInsert.start_date).toBe("2026-07-27");
    expect(taskInsert.cycle_id).toBe(cycleInsert.id);
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
      [taskActivityFieldsRow],
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
      [taskActivityFieldsRow],
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

  test("materializes projected Week Cycles before moving Tasks and preserves identifiers", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: "cycle_current",
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      [],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: {
          target_cycle: {
            church_time_zone: "America/New_York",
            end_date: "2026-08-02",
            ends_at: "2026-08-03T04:00:00.000Z",
            start_date: "2026-07-27",
            starts_at: "2026-07-28T04:00:00.000Z",
          },
        },
        task_id: "task_one",
      },
      ctx: signedInContext,
      tx,
    });

    const cycleInsert = insertCalls.find((call) => call.table === cycles)?.values as {
      readonly id: string;
    };
    const taskUpdate = updateCalls.find((call) => call.table === tasks)?.set as {
      readonly cycle_id: string;
      readonly number?: number;
      readonly previous_identifiers?: string;
    };
    expect(taskUpdate.cycle_id).toBe(cycleInsert.id);
    expect(taskUpdate).not.toHaveProperty("number");
    expect(taskUpdate).not.toHaveProperty("previous_identifiers");
  });

  test("moves completed Tasks back to previous Cycles for rollover correction without changing identifiers", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: "cycle_current",
          deleted_at: null,
          finished_at: new Date("2026-08-03T12:00:00.000Z"),
          id: "task_rolled_over",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "done",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_done",
        },
      ],
      [{ id: "cycle_previous" }],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: { cycle_id: "cycle_previous" },
        task_id: "task_rolled_over",
      },
      ctx: signedInContext,
      tx,
    });

    const taskUpdate = updateCalls.find((call) => call.table === tasks)?.set as {
      readonly cycle_id: string;
      readonly number?: number;
      readonly previous_identifiers?: string;
    };
    expect(insertCalls.some((call) => call.table === cycles)).toBe(false);
    expect(taskUpdate.cycle_id).toBe("cycle_previous");
    expect(taskUpdate).not.toHaveProperty("number");
    expect(taskUpdate).not.toHaveProperty("previous_identifiers");
  });

  test("Due Date updates do not attach Tasks to Cycles", async () => {
    const { insertCalls, tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: null,
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: { due_date: "2026-07-29" },
        task_id: "task_one",
      },
      ctx: signedInContext,
      tx,
    });

    const taskUpdate = updateCalls.find((call) => call.table === tasks)?.set as {
      readonly cycle_id?: string | null;
      readonly due_date: string;
    };
    expect(insertCalls.some((call) => call.table === cycles)).toBe(false);
    expect(taskUpdate.due_date).toBe("2026-07-29");
    expect(taskUpdate).not.toHaveProperty("cycle_id");
  });

  test("attaches uncycled To-do Tasks to viewed Week when transitioning in Week context", async () => {
    const { tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: null,
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      [taskActivityFieldsRow],
      [{ id: "cycle_viewed" }],
      [
        {
          id: "workflowstatus_in_progress",
          name: "In Progress",
          task_state: "in_progress",
          workflow_id: "workflow_production",
        },
      ],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: {
          target_cycle: {
            church_time_zone: "America/New_York",
            end_date: "2026-08-02",
            ends_at: "2026-08-03T04:00:00.000Z",
            start_date: "2026-07-27",
            starts_at: "2026-07-28T04:00:00.000Z",
          },
          workflow_status_id: "workflowstatus_in_progress",
        },
        task_id: "task_one",
      },
      ctx: signedInContext,
      tx,
    });

    const taskUpdate = updateCalls.find((call) => call.table === tasks)?.set as {
      readonly cycle_id: string;
      readonly task_state: string;
      readonly workflow_status_id: string;
    };
    expect(taskUpdate).toMatchObject({
      cycle_id: "cycle_viewed",
      task_state: "in_progress",
      workflow_status_id: "workflowstatus_in_progress",
    });
  });

  test("attaches uncycled To-do Tasks to current Cycle on default workflow transition", async () => {
    const { tx, updateCalls } = createServerTx([
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: null,
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      [taskActivityFieldsRow],
      [
        {
          id: "workflowstatus_done",
          name: "Done",
          task_state: "done",
          workflow_id: "workflow_production",
        },
      ],
      [{ id: "cycle_current" }],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: { workflow_status_id: "workflowstatus_done" },
        task_id: "task_one",
      },
      ctx: signedInContext,
      tx,
    });

    const taskUpdate = updateCalls.find((call) => call.table === tasks)?.set as {
      readonly cycle_id: string;
      readonly finished_at: Date;
      readonly task_state: string;
    };
    expect(taskUpdate.cycle_id).toBe("cycle_current");
    expect(taskUpdate.task_state).toBe("done");
    expect(taskUpdate.finished_at).toBeInstanceOf(Date);
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
      [{ ...taskActivityFieldsRow, team_name: "Old Team" }],
      [{ id: "team_new", identifier: "NEW", name: "New Team", next_task_number: 4 }],
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

  test("writes per-field Activities with from/to labels for status and assignee changes", async () => {
    const { insertCalls, tx } = createServerTx([
      // getTaskWithTeamIdentifier (base row)
      [
        {
          board_order: "a1",
          church_id: "org_test",
          cycle_id: "cycle_current",
          deleted_at: null,
          finished_at: null,
          id: "task_one",
          label_ids: "[]",
          number: 7,
          previous_identifiers: "[]",
          task_state: "todo",
          team_id: "team_production",
          team_identifier: "PRO",
          workflow_id: "workflow_production",
          workflow_status_id: "workflowstatus_todo",
        },
      ],
      // getTaskWithActivityFields (extra current-value row)
      [
        {
          assigned_user_id: "user_old",
          due_date: null,
          estimate: null,
          priority: null,
          team_name: "Production",
          title: "Existing task",
          workflow_status_name: "To Do",
        },
      ],
      // workflow_status_id resolution
      [
        {
          id: "workflowstatus_in_progress",
          name: "In Progress",
          task_state: "in_progress",
          workflow_id: "workflow_production",
        },
      ],
    ]);

    await mustGetMutator(mutators, "tasks.update").fn({
      args: {
        church_id: "org_test",
        fields: {
          assigned_user_id: "user_new",
          workflow_status_id: "workflowstatus_in_progress",
        },
        task_id: "task_one",
      },
      ctx: signedInContext,
      tx,
    });

    const activityInserts = insertCalls
      .filter((call) => call.table === activities)
      .map((call) => {
        const values = call.values as {
          readonly entity_type: string;
          readonly event_type: string;
          readonly metadata: string;
        };
        return { ...values, metadata: JSON.parse(values.metadata) as Record<string, unknown> };
      });

    const assigneeActivity = activityInserts.find(
      (activity) => activity.event_type === "task.assignee_changed",
    );
    const statusActivity = activityInserts.find(
      (activity) => activity.event_type === "task.status_changed",
    );

    expect(assigneeActivity?.metadata).toEqual({
      from: { id: "user_old", label: null },
      to: { id: "user_new", label: null },
    });
    expect(statusActivity?.metadata).toEqual({
      from: { id: "workflowstatus_todo", label: "To Do" },
      to: { id: "workflowstatus_in_progress", label: "In Progress" },
    });
    expect(activityInserts.every((activity) => activity.entity_type === "task")).toBe(true);
  });
});

describe("Zero Template and Cycle projection", () => {
  test("creates a weekly service Template with placed tasks and a repeating schedule", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => {
              insertCalls.push({ table, values });
            },
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "templates.create").fn({
      args: {
        church_id: "org_test",
        focus_windows: [],
        key: "weekly-service",
        name: "Weekly Service",
        placement_shape: "weekly_service",
        recurrence: "weekly",
        template_schedule: {
          end_date: null,
          key: "sunday-service",
          kind: "weekly",
          name: "Sunday Service",
          recurrence: "repeating",
          rule: { kind: "weekly", weekdays: [0] },
          start_date: "2026-06-21",
        },
        template_tasks: [
          {
            assigned_user_id: "user_worship",
            description: "Confirm songs and rehearsal notes.",
            estimate: "30m",
            priority: null,
            key: "plan-setlist",
            label_ids: ["label_music"],
            parent_template_task_key: null,
            placement_cycle_offset: -1,
            placement_weekday: 3,
            scheduling_rule: {
              baseLocalDate: "2026-06-21",
              dayOffset: -4,
              kind: "cycleOffset",
              offsetCycles: -1,
            },
            template_team_key: "worship",
            title: "Plan setlist",
          },
        ],
        template_teams: [{ key: "worship", mapped_team_id: "team_worship", name: "Worship" }],
      },
      ctx: signedInContext,
      tx,
    });

    expect(insertCalls.find((call) => call.table === templates)?.values).toMatchObject({
      church_id: "org_test",
      key: "weekly-service",
      name: "Weekly Service",
      placement_shape: "weekly_service",
    });
    expect(insertCalls.find((call) => call.table === template_teams)?.values).toMatchObject([
      { mapped_team_id: "team_worship", name: "Worship" },
    ]);
    expect(insertCalls.find((call) => call.table === template_tasks)?.values).toMatchObject([
      {
        assigned_user_id: "user_worship",
        description: "Confirm songs and rehearsal notes.",
        estimate: "30m",
        priority: null,
        label_ids: JSON.stringify(["label_music"]),
        placement_cycle_offset: -1,
        placement_weekday: 3,
        title: "Plan setlist",
      },
    ]);
    expect(insertCalls.find((call) => call.table === template_schedules)?.values).toMatchObject({
      church_id: "org_test",
      key: "sunday-service",
      kind: "weekly",
      name: "Sunday Service",
      recurrence: "repeating",
      rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
      start_date: "2026-06-21",
    });
  });

  test("duplicates Templates into fresh Template Team, Task, and Schedule identities", async () => {
    const insertCalls: Array<{ readonly table: unknown; readonly values: unknown }> = [];
    const selectedRowsByTable = new Map<unknown, readonly unknown[]>([
      [
        templates,
        [
          {
            key: "weekly-service",
            name: "Weekly Service",
            placement_shape: "weekly_service",
            recurrence: "weekly",
          },
        ],
      ],
      [
        template_teams,
        [
          {
            key: "worship",
            mapped_team_id: "team_worship",
            name: "Worship",
            source_id: "templateteam_source",
          },
        ],
      ],
      [
        template_tasks,
        [
          {
            assigned_user_id: "user_worship",
            description: "Confirm songs.",
            estimate: "30m",
            key: "plan-setlist",
            label_ids: JSON.stringify(["label_music"]),
            parent_template_task_id: null,
            placement_cycle_offset: -1,
            placement_weekday: 3,
            scheduling_rule: JSON.stringify({
              edge: "start",
              focusWindowId: "focuswindow_source",
              kind: "relativeToFocusWindow",
              offsetDays: -2,
            }),
            source_id: "templatetask_source",
            template_team_id: "templateteam_source",
            title: "Plan setlist",
          },
        ],
      ],
      [
        template_schedules,
        [
          {
            end_date: null,
            key: "sunday-service",
            kind: "weekly",
            name: "Sunday Service",
            recurrence: "repeating",
            rule: JSON.stringify({ kind: "weekly", weekdays: [0] }),
            start_date: "2026-06-21",
          },
        ],
      ],
      [
        focus_windows,
        [
          {
            anchor_date: null,
            end_date: "2026-06-22",
            key: "sunday-service-week",
            key_date_id: null,
            name: "Sunday Service Week",
            source_id: "focuswindow_source",
            start_date: "2026-06-15",
            type: "preparation",
          },
        ],
      ],
    ]);
    const tx = {
      dbTransaction: {
        wrappedTransaction: {
          insert: (table: unknown) => ({
            values: async (values: unknown) => insertCalls.push({ table, values }),
          }),
          select: () => ({
            from: (table: unknown) => ({
              where: async () => selectedRowsByTable.get(table) ?? [],
            }),
          }),
        },
      },
      location: "server",
    } as never;

    await mustGetMutator(mutators, "templates.duplicate").fn({
      args: { church_id: "org_test", template_id: "template_source" },
      ctx: signedInContext,
      tx,
    });

    const templateInsert = insertCalls.find((call) => call.table === templates)?.values as {
      readonly id: string;
      readonly name: string;
    };
    const teamInsert = (
      (insertCalls.find((call) => call.table === template_teams)?.values ?? []) as readonly {
        readonly id: string;
        readonly template_id: string;
      }[]
    )[0];
    const taskInsert = (
      (insertCalls.find((call) => call.table === template_tasks)?.values ?? []) as readonly {
        readonly id: string;
        readonly scheduling_rule: string;
        readonly template_id: string;
        readonly template_team_id: string;
      }[]
    )[0];
    const scheduleInsert = (
      (insertCalls.find((call) => call.table === template_schedules)?.values ?? []) as readonly {
        readonly id: string;
        readonly rule: string;
        readonly template_id: string;
      }[]
    )[0];
    const focusWindowInsert = (
      (insertCalls.find((call) => call.table === focus_windows)?.values ?? []) as readonly {
        readonly id: string;
      }[]
    )[0];
    expect(teamInsert).toBeDefined();
    expect(taskInsert).toBeDefined();
    expect(scheduleInsert).toBeDefined();
    expect(focusWindowInsert).toBeDefined();
    if (!teamInsert || !taskInsert || !scheduleInsert || !focusWindowInsert)
      throw new Error("Expected duplicate inserts.");
    expect(templateInsert.name).toBe("Weekly Service Copy");
    expect(getIdType(templateInsert.id)).toBe("template");
    expect(getIdType(teamInsert.id)).toBe("templateteam");
    expect(getIdType(taskInsert.id)).toBe("templatetask");
    expect(getIdType(scheduleInsert.id)).toBe("templateschedule");
    expect(getIdType(focusWindowInsert.id)).toBe("focuswindow");
    expect(teamInsert.id).not.toBe("templateteam_source");
    expect(taskInsert.id).not.toBe("templatetask_source");
    expect(taskInsert.template_team_id).toBe(teamInsert.id);
    expect(teamInsert.template_id).toBe(templateInsert.id);
    expect(taskInsert.template_id).toBe(templateInsert.id);
    expect(scheduleInsert.template_id).toBe(templateInsert.id);
    expect(JSON.parse(taskInsert.scheduling_rule)).toMatchObject({
      focusWindowId: focusWindowInsert.id,
    });
    expect(insertCalls.some((call) => call.table === cycle_adjustments)).toBe(false);
    expect(insertCalls.some((call) => call.table === tasks)).toBe(false);
    expect(
      insertCalls
        .filter((call) => call.table === activities)
        .map((call) => (call.values as { event_type: string }).event_type),
    ).toEqual(["template_task.created", "template_schedule.created", "template.duplicated"]);
  });

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
      source_template_occurrence_key: null,
      source_template_schedule_id: null,
      source_template_sync_enabled: false,
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

  test("dedupes generated Template Tasks by schedule occurrence identity", () => {
    const baseArgs = {
      adjustments: [],
      church_id: "org_test",
      cycle: { id: "cycle_easter", start_date: "2026-03-30" },
      focus_windows: [],
      key_date_occurrences: [],
      now: new Date("2026-01-01T00:00:00.000Z"),
      session_user_id: "user_test",
      source_template_occurrence_key: "weekly:2026-04-05:sunday",
      source_template_schedule_id: "templateschedule_sunday",
      start_number_by_team_id: new Map([["team_worship", 7]]),
      template_id: "template_service",
      template_tasks: [
        {
          id: "templatetask_plan",
          key: "plan",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-01" }),
          template_team_id: "templateteam_worship",
          title: "Prepare service plan",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      todo_status_by_workflow_id: new Map([
        ["workflow_worship", { id: "workflowstatus_todo", workflow_id: "workflow_worship" }],
      ]),
      workflow_by_team_id: new Map([
        ["team_worship", { id: "workflow_worship", team_id: "team_worship" }],
      ]),
    } as const;

    const firstProjection = buildTemplateCycleTaskInserts(baseArgs);
    const nextOccurrenceProjection = buildTemplateCycleTaskInserts({
      ...baseArgs,
      existing_projected_tasks: [
        {
          id: "task_existing_previous_week",
          source_template_occurrence_key: "weekly:2026-03-29:sunday",
          source_template_schedule_id: "templateschedule_sunday",
          source_template_task_id: "templatetask_plan",
        },
      ],
    });
    const duplicateProjection = buildTemplateCycleTaskInserts({
      ...baseArgs,
      existing_projected_tasks: [
        {
          id: "task_existing_same_occurrence",
          source_template_occurrence_key: "weekly:2026-04-05:sunday",
          source_template_schedule_id: "templateschedule_sunday",
          source_template_task_id: "templatetask_plan",
        },
      ],
    });

    expect(firstProjection.inserts[0]).toMatchObject({
      source_template_cycle_id: "cycle_easter",
      source_template_id: "template_service",
      source_template_occurrence_key: "weekly:2026-04-05:sunday",
      source_template_schedule_id: "templateschedule_sunday",
      source_template_task_id: "templatetask_plan",
    });
    expect(nextOccurrenceProjection.inserts).toHaveLength(1);
    expect(duplicateProjection.inserts).toHaveLength(0);
  });

  test("creates one generated Task per Template Task in a schedule occurrence", () => {
    const baseArgs = {
      adjustments: [],
      church_id: "org_test",
      cycle: { id: "cycle_easter", start_date: "2026-03-30" },
      focus_windows: [],
      key_date_occurrences: [],
      now: new Date("2026-01-01T00:00:00.000Z"),
      session_user_id: "user_test",
      source_template_occurrence_key: "weekly:2026-04-05:sunday",
      start_number_by_team_id: new Map([["team_worship", 7]]),
      template_id: "template_service",
      template_tasks: [
        {
          id: "templatetask_plan",
          key: "plan",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-01" }),
          template_team_id: "templateteam_worship",
          title: "Prepare service plan",
        },
        {
          id: "templatetask_rehearse",
          key: "rehearse",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-04-02" }),
          template_team_id: "templateteam_worship",
          title: "Rehearse service plan",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
      todo_status_by_workflow_id: new Map([
        ["workflow_worship", { id: "workflowstatus_todo", workflow_id: "workflow_worship" }],
      ]),
      workflow_by_team_id: new Map([
        ["team_worship", { id: "workflow_worship", team_id: "team_worship" }],
      ]),
    } as const;

    const sundayProjection = buildTemplateCycleTaskInserts({
      ...baseArgs,
      source_template_schedule_id: "templateschedule_sunday",
    });
    const saturdayProjection = buildTemplateCycleTaskInserts({
      ...baseArgs,
      source_template_schedule_id: "templateschedule_saturday",
    });

    expect(sundayProjection.inserts).toHaveLength(2);
    expect(sundayProjection.inserts[0]).toMatchObject({
      due_date: "2026-04-01",
      source_template_occurrence_key: "weekly:2026-04-05:sunday",
      source_template_schedule_id: "templateschedule_sunday",
      source_template_task_id: "templatetask_plan",
      title: "Prepare service plan",
    });
    expect(sundayProjection.inserts[1]).toMatchObject({
      due_date: "2026-04-02",
      source_template_occurrence_key: "weekly:2026-04-05:sunday",
      source_template_schedule_id: "templateschedule_sunday",
      source_template_task_id: "templatetask_rehearse",
      title: "Rehearse service plan",
    });
    expect(sundayProjection.nextNumberByTeamId.get("team_worship")).toBe(9);
    expect(saturdayProjection.inserts).toHaveLength(2);
    expect(saturdayProjection.inserts[0]?.source_template_schedule_id).toBe(
      "templateschedule_saturday",
    );
  });

  test("renders future Template Tasks without Task identifiers or materialized Task rows", () => {
    const projections = buildTemplateCycleTaskProjections({
      adjustments: [
        {
          lifecycle: "active",
          overrides: JSON.stringify([
            { field: "title", value: "Confirm Advent readers" },
            { field: "dueDate", value: "2026-12-02" },
          ]),
          template_task_id: "templatetask_readers",
        },
        {
          lifecycle: "skipped",
          overrides: JSON.stringify([]),
          template_task_id: "templatetask_skipped",
        },
      ],
      cycle: { id: "projected-week:2026-11-30", start_date: "2026-11-30" },
      focus_windows: [],
      key_date_occurrences: [],
      template_id: "template_advent",
      template_tasks: [
        {
          id: "templatetask_readers",
          key: "readers",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({
            baseLocalDate: "2026-11-30",
            dayOffset: 1,
            kind: "cycleOffset",
            offsetCycles: 0,
          }),
          template_team_id: "templateteam_worship",
          title: "Confirm readers",
        },
        {
          id: "templatetask_skipped",
          key: "skipped",
          parent_template_task_id: null,
          scheduling_rule: JSON.stringify({ kind: "fixedDate", localDate: "2026-12-03" }),
          template_team_id: "templateteam_worship",
          title: "Skipped occurrence",
        },
      ],
      template_teams: [{ id: "templateteam_worship", mapped_team_id: "team_worship" }],
    });

    expect(projections).toEqual([
      {
        cycle_id: "projected-week:2026-11-30",
        due_date: "2026-12-02",
        estimate: null,
        parent_template_task_id: null,
        priority: null,
        skipped: false,
        source_template_id: "template_advent",
        source_template_task_id: "templatetask_readers",
        team_id: "team_worship",
        template_task_key: "readers",
        title: "Confirm Advent readers",
      },
    ]);
    expect(projections[0]).not.toHaveProperty("id");
    expect(projections[0]).not.toHaveProperty("number");
  });
});
