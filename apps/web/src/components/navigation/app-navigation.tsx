import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";

import { CommentTextIcon } from "@/components/icons/commentText";
import { devNavItems, homeNavItem, workspaceNavItems } from "@/components/navigation/nav-shared";
import { AdminNav } from "@/components/navigation/adminNav";
import { DevMenu } from "@/components/navigation/dev-menu";
import { MobileSidebarContent } from "@/components/navigation/mobile-sidebar-content";
import { SideBarItem } from "@/components/navigation/sidebar-item";
import { TeamNavList, YourTeamsAddMenu } from "@/components/navigation/team-nav";
import { OrgSwitcher } from "@/components/org-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { useIsAppAdmin } from "@/data/users/adminData.app";
import { GlobalSearchToggle } from "@/features/global-search/global-search-toggle";
import { QuickActionsToggle } from "@/features/quick-actions/quick-actions-toggle";
import { getMemberTeams } from "@/routes/-dashboard-utils";

type AppSidebarProps = ComponentProps<typeof Sidebar>;

export function AppNavigation(props: AppSidebarProps) {
  return (
    <Sidebar className="px-0 pb-0" collapsible="icon" variant="inset" {...props}>
      <AppNavigationContent />
    </Sidebar>
  );
}

function AppNavigationContent() {
  const { isMobile } = useSidebar();
  const appContent = <AppNavigationBody />;

  if (isMobile) {
    return <MobileSidebarContent appContent={appContent} />;
  }

  return (
    <>
      <AppNavigationHeader />
      {appContent}
    </>
  );
}

function AppNavigationHeader() {
  return (
    <SidebarHeader className="mx-2 pb-0">
      <OrgSwitcher />

      <SidebarGroup className="p-0">
        <SidebarGroupContent className="relative flex flex-row gap-2">
          <QuickActionsToggle />
          <GlobalSearchToggle />
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarHeader>
  );
}

function AppNavigationBody() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const isAppAdministrator = useIsAppAdmin();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const teamMemberships = useTeamMembershipsCollection({ churchId: activeChurch?.id ?? null });
  const currentUserId = activeChurch?.currentUserId ?? null;
  const memberTeams = getMemberTeams(
    teams.teamsCollection,
    teamMemberships.teamMembershipsCollection,
    currentUserId,
  );
  const memberTeamIds = new Set(memberTeams.map((team) => team.id));
  // Teams in this Church the user is not yet a member of, offered in the
  // "Your teams" + menu so they can join one in place.
  const joinableTeams = teams.teamsCollection.filter((team) => !memberTeamIds.has(team.id));
  const canAccessInternalNav = isAppAdministrator;

  return (
    <>
      <SidebarContent
        className="h-full gap-0 [&_[data-sidebar=group]]:py-1.5"
        scrollAreaClassName="mr-1 flex-1"
        scrollAreaMaskClassName="before:from-sidebar after:from-sidebar"
        scrollAreaViewportClassName="pl-2 pr-1"
      >
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {workspaceNavItems.map((item) => (
              <SideBarItem key={item.to} {...item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Your teams</SidebarGroupLabel>
          {activeChurch ? (
            <YourTeamsAddMenu
              churchId={activeChurch.id}
              currentUserId={currentUserId}
              joinableTeams={joinableTeams}
            />
          ) : null}
          <SidebarMenu>
            {teamMemberships.loading || teams.loading ? (
              <>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </>
            ) : memberTeams.length > 0 && activeChurch ? (
              <TeamNavList
                churchId={activeChurch.id}
                currentUserId={currentUserId}
                teams={memberTeams}
              />
            ) : (
              <SidebarMenuItem>
                <SidebarMenuButton disabled type="button">
                  <span>No Team memberships</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {canAccessInternalNav ? (
          <>
            <AdminNav />

            <SidebarGroup>
              <SidebarGroupLabel>Dev</SidebarGroupLabel>
              <SidebarMenu>
                {devNavItems.map((item) => (
                  <SideBarItem key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="mx-2 px-2">
        <SidebarMenu>
          <DevMenu />

          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <a
                  href="https://github.com/SteepleInc/church-task/issues"
                  rel="noopener"
                  target="_blank"
                />
              }
            >
              <CommentTextIcon />
              Feedback
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link preload="intent" to={homeNavItem.to as "/"} />}>
              {homeNavItem.icon}
              {homeNavItem.title}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
