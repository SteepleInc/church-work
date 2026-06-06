/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/!(*.*.*)*.*s");

describe("admin org queries", () => {
  it("rejects listAllOrgs without an App Administrator session", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.admin.listAllOrgs, {
        listArgs: {},
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("App Administrator access required.");
  });
});
