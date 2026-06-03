import { describe, expect, test } from "bun:test";

import {
  COMPLETED_APP_LANDING_PATH,
  getBreadcrumbLabel,
  getPrimaryAppShellNavItems,
} from "./app-shell";
import { buildChurchTaskQuickActions } from "@/features/quick-actions/quick-actions-state";

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
    expect(getBreadcrumbLabel("/dev/session")).toBe("Dev Session");
    expect(getBreadcrumbLabel("/admin/orgs")).toBe("App Admin Churches");
  });
});

describe("quick action route behavior", () => {
  test("renders Church Task big actions and quick actions without PreachX product surfaces", () => {
    const actions = buildChurchTaskQuickActions({
      canInviteMembers: true,
      closeQuickActions: () => {},
      navigateToMyWork: () => {},
      navigateToOurWork: () => {},
      navigateToSettings: () => {},
      openInviteMember: () => {},
    });

    expect(actions.map((action) => [action.group, action.name])).toEqual([
      ["big-action", "Create My Task"],
      ["big-action", "Create Church Task"],
      ["quick-action", "Invite Member"],
      ["quick-action", "Team Settings"],
      ["quick-action", "Church Settings"],
      ["quick-action", "Profile Settings"],
    ]);
    expect(actions.some((action) => /sermon|video|preacher|billing/i.test(action.name))).toBe(
      false,
    );
  });

  test("disables Invite Member when the active Church role cannot invite", () => {
    const actions = buildChurchTaskQuickActions({
      canInviteMembers: false,
      closeQuickActions: () => {},
      navigateToMyWork: () => {},
      navigateToOurWork: () => {},
      navigateToSettings: () => {},
      openInviteMember: () => {},
    });

    expect(actions.find((action) => action.name === "Invite Member")).toMatchObject({
      enabled: false,
      disabledReason: "Only Church owners and admins can invite members.",
    });
  });
});
