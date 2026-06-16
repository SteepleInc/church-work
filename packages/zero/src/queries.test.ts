import { mustGetQuery } from "@rocicorp/zero";
import { describe, expect, test } from "vitest";

import { queries } from "./queries";

describe("Zero product queries", () => {
  test("does not throw while the browser is still refreshing active Church context", () => {
    expect(() =>
      mustGetQuery(queries, "teams.by_church").fn({
        args: { church_id: "org_missing" },
        ctx: null,
      }),
    ).not.toThrow();
  });

  test("fails closed for unauthenticated server-side Team queries", () => {
    expect(() =>
      mustGetQuery(queries, "teams.by_church").fn({
        args: { church_id: "org_missing" },
        ctx: { authenticated: false, runtime: "server" },
      }),
    ).toThrow("Authentication required.");
  });

  test("fails closed for unauthenticated server-side Workflow queries", () => {
    for (const name of [
      "team_memberships.by_church",
      "workflows.by_church",
      "workflow_statuses.by_church",
    ] as const) {
      expect(() =>
        mustGetQuery(queries, name).fn({
          args: { church_id: "org_missing" },
          ctx: { authenticated: false, runtime: "server" },
        }),
      ).toThrow("Authentication required.");
    }
  });
});
