/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import { buildAdminOrgCollectionItem } from "../convex/admin";
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

  it("projects full admin org collection fields and relation counts", () => {
    expect(
      buildAdminOrgCollectionItem(
        {
          _id: "org_123",
          name: "Grace Church",
          slug: "grace",
          logo: null,
          churchTimeZone: "America/New_York",
          completedOnboarding: true,
          url: "https://grace.example.com",
          city: "Atlanta",
          state: "Georgia",
          countryCode: "US",
          size: "250-500",
          createdAt: 1_767_312_000_000,
        },
        { membersCount: 12, teamsCount: 3 },
      ),
    ).toEqual({
      id: "org_123",
      name: "Grace Church",
      slug: "grace",
      logo: null,
      churchTimeZone: "America/New_York",
      completedOnboarding: true,
      url: "https://grace.example.com",
      city: "Atlanta",
      state: "Georgia",
      countryCode: "US",
      size: "250-500",
      membersCount: 12,
      teamsCount: 3,
      createdAt: 1_767_312_000_000,
    });
  });
});
