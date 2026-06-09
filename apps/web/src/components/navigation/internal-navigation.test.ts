import { describe, expect, test } from "bun:test";

import {
  appAdminNavItems,
  canAccessInternalNavigation,
  devNavItems,
  getInternalRouteBreadcrumbLabel,
} from "./internal-navigation";

describe("internal navigation", () => {
  test("keeps dev and app-admin routes focused on Church Task internals", () => {
    expect(devNavItems).toEqual([
      { label: "Session", to: "/dev/session", matchPath: "/dev/session" },
      { label: "Data Adapters", to: "/dev/data", matchPath: "/dev/data" },
    ]);

    expect(appAdminNavItems).toEqual([
      { label: "Churches", to: "/admin/orgs", matchPath: "/admin/orgs" },
      { label: "Users", to: "/admin/users", matchPath: "/admin/users" },
    ]);

    expect([...devNavItems, ...appAdminNavItems].map((item) => item.to).join(" ")).not.toMatch(
      /video|sermon|preacher|editor|billing|prompt/i,
    );
  });

  test("gates internal navigation to App Administrators only", () => {
    expect(canAccessInternalNavigation(true)).toBe(true);
    expect(canAccessInternalNavigation(false)).toBe(false);
  });

  test("adds breadcrumb labels for internal routes", () => {
    expect(getInternalRouteBreadcrumbLabel("/dev/session")).toBe("Dev Session");
    expect(getInternalRouteBreadcrumbLabel("/dev/data")).toBe("Dev Data");
    expect(getInternalRouteBreadcrumbLabel("/admin/orgs")).toBe("App Admin Churches");
    expect(getInternalRouteBreadcrumbLabel("/admin/users")).toBe("App Admin Users");
    expect(getInternalRouteBreadcrumbLabel("/my-work")).toBe(null);
  });
});
