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

const appNavigationSource = await Bun.file(
  new URL("./navigation/app-navigation.tsx", import.meta.url),
).text();
const devMenuContentSource = await Bun.file(
  new URL("./navigation/dev-menu-content.tsx", import.meta.url),
).text();
const mobileSidebarContentSource = await Bun.file(
  new URL("./navigation/mobile-sidebar-content.tsx", import.meta.url),
).text();
const dashboardRouteSource = await Bun.file(
  new URL("../routes/-dashboard.tsx", import.meta.url),
).text();

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

  test("uses the copied PreachX mobile sidebar content split", () => {
    expect(appNavigationSource).toContain("function AppNavigationContent()");
    expect(appNavigationSource).toContain("const { isMobile } = useSidebar();");
    expect(appNavigationSource).toContain(
      "return <MobileSidebarContent appContent={appContent} />;",
    );
    expect(mobileSidebarContentSource).toContain('<SidebarHeader className="mx-2 pb-0">');
    expect(mobileSidebarContentSource).toContain("<OrgSwitcher />");
    expect(mobileSidebarContentSource).toContain("<QuickActionsToggle />");
    expect(mobileSidebarContentSource).toContain("<GlobalSearchToggle />");
  });

  test("keeps work pages scrolling inside the copied PreachX page frame", () => {
    expect(dashboardRouteSource).toContain(
      'import { MainContainer, PageContainer } from "@/components/pageComponents";',
    );
    expect(dashboardRouteSource).toContain("<MainContainer>");
    expect(dashboardRouteSource).toContain('<PageContainer wrapperClassName="gap-6">');
    expect(dashboardRouteSource).not.toContain(
      '<main className="flex flex-1 flex-col gap-6 overflow-auto p-4 sm:p-6">',
    );
  });

  test("keeps the PreachX bottom sidebar dev menu before feedback and home", () => {
    expect(appNavigationSource).toContain(
      'import { DevMenu } from "@/components/navigation/dev-menu";',
    );
    expect(appNavigationSource.indexOf("<DevMenu />")).toBeLessThan(
      appNavigationSource.indexOf("Feedback"),
    );
    expect(appNavigationSource.indexOf("Feedback")).toBeLessThan(
      appNavigationSource.indexOf("{homeNavItem.title}"),
    );
    expect(devMenuContentSource).toContain(
      'className="mb-2 flex flex-col gap-2 overflow-hidden text-muted-foreground/40 text-sm"',
    );
    expect(devMenuContentSource).toContain("<CopyableValue value={orgId} />");
    expect(devMenuContentSource).toContain("<CopyableValue value={userId} />");
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
