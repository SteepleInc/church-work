import { describe, expect, test } from "bun:test";

import { getFilteredOrgSwitcherItems } from "./org-switcher-utils";

const orgs = [
  {
    churchTimeZone: "America/Chicago",
    completedOnboarding: true,
    id: "1",
    name: "Grace Church",
    slug: "grace",
  },
  {
    churchTimeZone: "America/New_York",
    completedOnboarding: false,
    id: "2",
    name: "Hope Chapel",
    slug: "hope",
  },
] as const;

describe("OrgSwitcher", () => {
  test("returns every Church with empty search", () => {
    expect(getFilteredOrgSwitcherItems({ orgs, search: "" })).toEqual([...orgs]);
  });

  test("filters Churches by name", () => {
    expect(getFilteredOrgSwitcherItems({ orgs, search: "hope" })).toEqual([orgs[1]]);
  });
});
