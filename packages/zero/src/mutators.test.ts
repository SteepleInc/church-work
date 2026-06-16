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
});
