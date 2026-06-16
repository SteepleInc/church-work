import { DEFAULT_WORKFLOW_STATUSES } from "@church-task/domain";
import { getIdType } from "@church-task/shared/get-ids";
import { mustGetMutator } from "@rocicorp/zero";
import { describe, expect, test } from "vitest";

import { team_memberships, teams, workflow_statuses, workflows } from "@church-task/db/schema";

import { mutators } from "./mutators";

const signedInContext = {
  active_church_id: "org_test",
  authenticated: true,
  church_role: "owner",
  is_app_admin: false,
  runtime: "server",
  session_id: "session_test",
  user_id: "user_test",
} as const;

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
