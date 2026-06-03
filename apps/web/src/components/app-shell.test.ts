import { describe, expect, test } from "bun:test";

import {
  COMPLETED_APP_LANDING_PATH,
  getBreadcrumbLabel,
  getPrimaryAppShellNavItems,
} from "./app-shell";

describe("app shell route behavior", () => {
  test("lands completed app users on My Work", () => {
    expect(COMPLETED_APP_LANDING_PATH).toBe("/my-work");
  });

  test("renders the primary _org navigation paths", () => {
    expect(getPrimaryAppShellNavItems()).toEqual([
      { label: "My Work", to: "/my-work", matchPath: "/my-work" },
      { label: "Our Work", to: "/our-work", matchPath: "/our-work" },
      { label: "Settings", to: "/settings", matchPath: "/settings" },
    ]);
  });

  test("derives breadcrumb labels from user-facing routes", () => {
    expect(getBreadcrumbLabel("/my-work")).toBe("My Work");
    expect(getBreadcrumbLabel("/our-work")).toBe("Our Work");
    expect(getBreadcrumbLabel("/settings")).toBe("Settings");
    expect(getBreadcrumbLabel("/team/team-1")).toBe("Team Work");
  });
});
