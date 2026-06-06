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
import { getAvatarInitials } from "@/components/ui/avatar";

const appNavigationSource = await Bun.file(
  new URL("./navigation/app-navigation.tsx", import.meta.url),
).text();
const navSharedSource = await Bun.file(
  new URL("./navigation/nav-shared.tsx", import.meta.url),
).text();
const devMenuContentSource = await Bun.file(
  new URL("./navigation/dev-menu-content.tsx", import.meta.url),
).text();
const mobileSidebarContentSource = await Bun.file(
  new URL("./navigation/mobile-sidebar-content.tsx", import.meta.url),
).text();
const sideBarItemSource = await Bun.file(
  new URL("./navigation/sidebar-item.tsx", import.meta.url),
).text();
const orgSwitcherSource = await Bun.file(new URL("./org-switcher.tsx", import.meta.url)).text();
const sidebarPrimitiveSource = await Bun.file(new URL("./ui/sidebar.tsx", import.meta.url)).text();
const sideBarIconSource = await Bun.file(
  new URL("./icons/sideBarIcon.tsx", import.meta.url),
).text();
const quickActionsSource = await Bun.file(
  new URL("../features/quick-actions/quick-actions.tsx", import.meta.url),
).text();
const bigActionsSource = await Bun.file(
  new URL("../features/big-actions/big-actions.tsx", import.meta.url),
).text();
const createTaskQuickActionSource = await Bun.file(
  new URL("../features/quick-actions/create-task-quick-action.tsx", import.meta.url),
).text();
const inviteMemberSource = await Bun.file(
  new URL("../features/settings/invite-member.tsx", import.meta.url),
).text();
const globalSearchSource = await Bun.file(
  new URL("../features/global-search/global-search.tsx", import.meta.url),
).text();
const globalSearchWindowSource = await Bun.file(
  new URL("../features/global-search/global-search-window.tsx", import.meta.url),
).text();
const globalSearchToggleSource = await Bun.file(
  new URL("../features/global-search/global-search-toggle.tsx", import.meta.url),
).text();
const globalSearchFooterSource = await Bun.file(
  new URL("../features/global-search/global-search-footer.tsx", import.meta.url),
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

  test("uses copied PreachX icons for matching sidebar surfaces", () => {
    expect(navSharedSource).toContain(
      'import { ChurchIcon } from "@/components/icons/churchIcon";',
    );
    expect(navSharedSource).toContain('import { HomeIcon } from "@/components/icons/homeIcon";');
    expect(navSharedSource).toContain(
      'import { PersonIcon } from "@/components/icons/personIcon";',
    );
    expect(navSharedSource).toContain(
      'import { UserCircleIcon } from "@/components/icons/userCircleIcon";',
    );
    expect(appNavigationSource).toContain(
      'import { CommentTextIcon } from "@/components/icons/commentText";',
    );
    expect(navSharedSource).toContain("icon: <ChurchIcon />");
    expect(navSharedSource).toContain("icon: <HomeIcon />");
    expect(navSharedSource).toContain("icon: <PersonIcon />");
    expect(navSharedSource).toContain("icon: <UserCircleIcon />");
    expect(appNavigationSource).toContain("<CommentTextIcon />");
  });

  test("keeps the org switcher dropdown close to the copied PreachX structure", () => {
    expect(orgSwitcherSource).toContain(
      'import { CheckCircleIcon } from "@/components/icons/checkCircleIcon";',
    );
    expect(orgSwitcherSource).toContain(
      'import { ChevronDownIcon } from "@/components/icons/chevronDownIcon";',
    );
    expect(orgSwitcherSource).toContain('import { PlusIcon } from "@/components/icons/plusIcon";');
    expect(orgSwitcherSource).toContain(
      'className="flex w-(--anchor-width) min-w-56 flex-col rounded-lg p-0"',
    );
    expect(orgSwitcherSource).toContain('placeholder="Search"');
    expect(orgSwitcherSource).toContain('viewportClassName="p-1"');
    expect(orgSwitcherSource).toContain('<span className="line-clamp-2">{org.name}</span>');
    expect(orgSwitcherSource).not.toContain("Onboarding incomplete");
    expect(orgSwitcherSource).not.toContain("DropdownMenuGroup");
    expect(orgSwitcherSource).not.toContain('from "lucide-react"');
  });

  test("keeps sidebar links scoped to the copied PreachX global details search param", () => {
    expect(sideBarItemSource).toContain("search={(previousSearch) => ({");
    expect(sideBarItemSource).toContain(
      '"details-pane": (previousSearch as { readonly "details-pane"?: unknown })',
    );
    expect(sideBarItemSource).not.toContain("...previousSearch");
  });

  test("keeps the copied PreachX inset sidebar inner treatment", () => {
    expect(sidebarPrimitiveSource).toContain("group-data-[variant=inset]:rounded-lg");
    expect(sidebarPrimitiveSource).toContain("group-data-[variant=inset]:border");
    expect(sidebarPrimitiveSource).toContain("group-data-[variant=inset]:border-sidebar-border");
    expect(sidebarPrimitiveSource).toContain("group-data-[variant=inset]:shadow-sm");
  });

  test("uses the copied PreachX animated sidebar trigger icon", () => {
    expect(sidebarPrimitiveSource).toContain(
      'import { SideBarIcon } from "@/components/icons/sideBarIcon";',
    );
    expect(sidebarPrimitiveSource).toContain("const { open, toggleSidebar } = useSidebar();");
    expect(sidebarPrimitiveSource).toContain('className={cn("size-7", className)}');
    expect(sidebarPrimitiveSource).toContain("<SideBarIcon isOpen={open} />");
    expect(sideBarIconSource).toContain("group-hover:translate-x-[-6px]");
    expect(sideBarIconSource).toContain(
      'transition: "transform 200ms ease 0s, opacity 120ms ease 0s"',
    );
  });

  test("keeps the copied PreachX lg sidebar menu button height", () => {
    expect(sidebarPrimitiveSource).toContain(
      'lg: "h-10 text-sm group-data-[collapsible=icon]:p-0!"',
    );
    expect(sidebarPrimitiveSource).not.toContain(
      'lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!"',
    );
  });

  test("keeps mobile and touch sidebar scrolling branched like PreachX", () => {
    expect(sidebarPrimitiveSource).toContain(
      'import { ScrollArea, useTouchPrimary } from "@/components/ui/scroll-area";',
    );
    expect(sidebarPrimitiveSource).toContain("const isTouch = useTouchPrimary();");
    expect(sidebarPrimitiveSource).toContain("if (isMobile) {");
    expect(sidebarPrimitiveSource).toContain('className={cn("flex min-h-0", scrollAreaClassName)}');
    expect(sidebarPrimitiveSource).toContain('isTouch ? "" : "[&>div]:!inline [&>div]:min-h-full"');
  });

  test("keeps the copied PreachX sidebar tooltip provider wrapper", () => {
    expect(sidebarPrimitiveSource).toContain(
      'import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";',
    );
    expect(sidebarPrimitiveSource).toContain("<TooltipProvider delay={0}>");
    expect(sidebarPrimitiveSource.indexOf("<TooltipProvider delay={0}>")).toBeLessThan(
      sidebarPrimitiveSource.indexOf('data-slot="sidebar-wrapper"'),
    );
  });
});

describe("quick action route behavior", () => {
  test("renders Church Task big actions and quick actions without PreachX product surfaces", () => {
    const actions = buildChurchTaskQuickActions({
      canInviteMembers: true,
      closeQuickActions: () => {},
      openCreateChurchTask: () => {},
      openCreateMyTask: () => {},
      navigateToSettings: () => {},
      openInviteMember: () => {},
    });

    expect(actions.map((action) => [action.group, action.name])).toEqual([
      ["quick-action", "Create My Task"],
      ["quick-action", "Create Church Task"],
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
      openCreateChurchTask: () => {},
      openCreateMyTask: () => {},
      navigateToSettings: () => {},
      openInviteMember: () => {},
    });

    expect(actions.find((action) => action.name === "Invite Member")).toMatchObject({
      enabled: false,
      disabledReason: "Only Church owners and admins can invite members.",
    });
  });

  test("keeps quick actions copied as one command group separated from big action dialogs", () => {
    expect(quickActionsSource).toContain('<CommandGroup heading="Quick Action">');
    expect(quickActionsSource).not.toContain("Big Actions");
    expect(quickActionsSource).not.toContain("action.description");
    expect(bigActionsSource).toContain("export const BigActions: FC");
  });

  test("creates tasks through a quick action dialog instead of a big action", () => {
    expect(createTaskQuickActionSource).toContain("export function CreateTaskQuickAction()");
    expect(createTaskQuickActionSource).toContain("createTaskQuickActionStateAtom");
    expect(createTaskQuickActionSource).toContain("<QuickActionsWrapper");
    expect(createTaskQuickActionSource).toContain('<QuickActionsHeader className="p-4">');
    expect(createTaskQuickActionSource).toContain("<QuickActionForm");
    expect(quickActionsSource).toContain("<CreateTaskQuickAction />");
    expect(bigActionsSource).not.toContain("createTaskBigActionStateAtom");
    expect(bigActionsSource).not.toContain("BigActionWrapper");
  });

  test("keeps the copied PreachX BigAction chrome available for future big actions", async () => {
    const bigActionComponentsSource = await Bun.file(
      new URL("../features/big-actions/big-action-components.tsx", import.meta.url),
    ).text();
    const fullScreenModalSource = await Bun.file(
      new URL("../components/ui/full-screen-modal.tsx", import.meta.url),
    ).text();

    expect(bigActionComponentsSource).toContain("export function BigActionWrapper");
    expect(bigActionComponentsSource).toContain(
      '<DrawerContent className="h-[100dvh] max-h-none">',
    );
    expect(bigActionComponentsSource).toContain("<FullScreenModalContent");
    expect(fullScreenModalSource).toContain('data-slot="full-screen-modal-content"');
    expect(fullScreenModalSource).toContain("SIDEBAR_WIDTH");
  });

  test("keeps invite member quick action in the copied PreachX header/body/footer shape", () => {
    expect(inviteMemberSource).toContain("<QuickActionsWrapper");
    expect(inviteMemberSource).toContain('<QuickActionsHeader className="p-4">');
    expect(inviteMemberSource).toContain("<QuickActionsTitle>");
    expect(inviteMemberSource).toContain("<QuickActionForm");
    expect(inviteMemberSource).toContain("<Kbd>enter</Kbd>");
  });

  test("drops the invite member header description and role width override to match PreachX", () => {
    expect(inviteMemberSource).not.toContain("<QuickActionsDescription>");
    expect(inviteMemberSource).not.toContain('className="sm:max-w-56"');
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
          details: [{ label: "Status", value: "open" }],
          onSelect: () => {},
        },
        {
          id: "team:1",
          type: "team",
          title: "Care Team",
          description: "Team work queue.",
          keywords: ["team", "care"],
          icon: UsersIcon,
          details: [{ label: "Team", value: "Care Team" }],
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

  test("uses the copied PreachX two-pane global search window and footer", () => {
    expect(globalSearchSource).toContain("<QuickActionsWrapper");
    expect(globalSearchSource).toContain("<GlobalSearchWindow");
    expect(globalSearchSource).not.toContain("CommandDialog");
    expect(globalSearchWindowSource).toContain("grid-cols-1 overflow-hidden p-0 md:grid-cols-2");
    expect(globalSearchWindowSource).toContain("<GlobalSearchDetailsPanel item={selectedItem} />");
    expect(globalSearchWindowSource).toContain("<GlobalSearchFooter");
    expect(globalSearchFooterSource).toContain("<Kbd>↑</Kbd>");
    expect(globalSearchFooterSource).toContain("<Kbd>↓</Kbd>");
    expect(globalSearchFooterSource).toContain('<Kbd className="ml-2">enter</Kbd>');
  });

  test("keeps the PreachX compact global search toggle without visible Search text", () => {
    expect(globalSearchToggleSource).toContain("border border-l2 bg-l2");
    expect(globalSearchToggleSource).toContain("group-data-[state=collapsed]:md:hidden");
    expect(globalSearchToggleSource).toContain("<Kbd>{GLOBAL_SEARCH_SHORTCUT}</Kbd>");
    expect(globalSearchToggleSource).not.toContain(">Search</span>");
  });
});

const userMenuSource = await Bun.file(new URL("./user-menu.tsx", import.meta.url).pathname).text();
const userAvatarSource = await Bun.file(
  new URL("./avatars/userAvatar.tsx", import.meta.url).pathname,
).text();
const baseAvatarSource = await Bun.file(
  new URL("./avatars/baseAvatar.tsx", import.meta.url).pathname,
).text();

describe("user menu behavior", () => {
  test("uses PreachX-style getAvatarInitials helper", () => {
    expect(getAvatarInitials("Alex Rivera")).toBe("Aa");
    expect(getAvatarInitials("Izak")).toBe("Ik");
    expect(getAvatarInitials("IZ")).toBe("IZ");
    expect(getAvatarInitials(null, "User")).toBe("Ur");
  });

  test("renders the PreachX UserAvatar with a boring-avatars fallback", () => {
    expect(userMenuSource).toContain("UserAvatar");
    expect(userAvatarSource).toContain("boring-avatars");
    expect(userAvatarSource).toContain('String.split("_")');
    expect(baseAvatarSource).toContain("getAvatarInitials");
  });
});
