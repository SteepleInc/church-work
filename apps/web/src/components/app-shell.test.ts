import { describe, expect, test } from "bun:test";

import {
  COMPLETED_APP_LANDING_PATH,
  appShellOverlayOrder,
  getBreadcrumbLabel,
  getPrimaryAppShellNavItems,
} from "./app-shell";
import {
  filterGlobalSearchResults,
  GLOBAL_SEARCH_SHORTCUT,
} from "@/features/global-search/global-search-utils";
import { buildChurchTaskQuickActions } from "@/features/quick-actions/quick-actions-state";
import { ListTodoIcon, UsersIcon } from "lucide-react";
import { getUserMenuAvatarFallback } from "@/components/user-menu";

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

  test("keeps global app overlays at the PreachX shell level and order", () => {
    expect(appShellOverlayOrder).toEqual([
      "DetailsPane",
      "QuickActions",
      "BigActions",
      "GlobalSearch",
    ]);
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

describe("global search behavior", () => {
  test("uses the copied PreachX slash shortcut with TanStack Hotkeys wiring", () => {
    expect(GLOBAL_SEARCH_SHORTCUT).toBe("/");
  });

  test("filters Church Task entities without PreachX product surfaces", () => {
    const results = filterGlobalSearchResults(
      [
        {
          id: "task:1",
          type: "task",
          title: "Review follow-up notes",
          description: "Worship Team - open",
          keywords: ["task", "worship"],
          icon: ListTodoIcon,
          onSelect: () => {},
        },
        {
          id: "team:1",
          type: "team",
          title: "Care Team",
          description: "Team work queue.",
          keywords: ["team", "care"],
          icon: UsersIcon,
          onSelect: () => {},
        },
      ],
      "care team",
    );

    expect(results.map((result) => result.title)).toEqual(["Care Team"]);
    expect(results.some((result) => /video|preacher|sermon|billing/i.test(result.type))).toBe(
      false,
    );
  });
});

describe("user menu behavior", () => {
  test("uses PreachX-style avatar initials instead of a text account button", () => {
    expect(getUserMenuAvatarFallback({ email: "alex@example.com", name: "Alex Rivera" })).toBe(
      "AR",
    );
    expect(getUserMenuAvatarFallback({ email: "solo@example.com", name: null })).toBe("SO");
    expect(getUserMenuAvatarFallback(null)).toBe("US");
  });
});
