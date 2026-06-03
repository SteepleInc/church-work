import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { Message01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  appAdminNavItems,
  devNavItems,
  homeNavItem,
  settingsNavItems,
  workspaceNavItems,
} from "@/components/navigation/nav-shared";
import { SideBarItem } from "@/components/navigation/sidebar-item";
import { OrgSwitcher } from "@/components/org-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { GlobalSearchToggle } from "@/features/global-search/global-search-toggle";
import { QuickActionsToggle } from "@/features/quick-actions/quick-actions-toggle";
import { getMemberTeams } from "@/routes/-dashboard";

type AppSidebarProps = ComponentProps<typeof Sidebar>;

export function AppNavigation(props: AppSidebarProps) {
  return (
    <Sidebar className="px-0 pb-0" collapsible="icon" variant="inset" {...props}>
      <AppNavigationHeader />
      <AppNavigationBody />
    </Sidebar>
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
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const teamMemberships = useTeamMembershipsCollection({ churchId: activeChurch?.id ?? null });
  const memberTeams = getMemberTeams(
    teams.teamsCollection,
    teamMemberships.teamMembershipsCollection,
    activeChurch?.currentUserId ?? null,
  );
  const canAccessInternalNav = activeChurch?.role === "owner" || activeChurch?.role === "admin";

  return (
    <SidebarContent className="h-full gap-0">
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarMenu>
          {workspaceNavItems.map((item) => (
            <SideBarItem key={item.to} {...item} />
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Team Work</SidebarGroupLabel>
        <SidebarMenu>
          {teamMemberships.loading || teams.loading ? (
            <SidebarMenuItem>
              <SidebarMenuButton disabled type="button">
                <span>Loading Teams...</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : memberTeams.length > 0 ? (
            memberTeams.map((team) => (
              <SideBarItem
                icon={<HugeiconsIcon className="size-4" icon={Message01Icon} strokeWidth={2} />}
                key={team.id}
                matchPath={`/team/${team.id}`}
                title={team.name}
                to={`/team/${team.id}`}
              />
            ))
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton disabled type="button">
                <span>No Team memberships</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Settings</SidebarGroupLabel>
        <SidebarMenu>
          {settingsNavItems.map((item) => (
            <SideBarItem key={item.to} {...item} />
          ))}
        </SidebarMenu>
      </SidebarGroup>

      {canAccessInternalNav ? (
        <>
          <SidebarGroup>
            <SidebarGroupLabel>App Admin</SidebarGroupLabel>
            <SidebarMenu>
              {appAdminNavItems.map((item) => (
                <SideBarItem key={item.to} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroup>

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

      <SidebarGroup className="mt-auto">
        <SidebarMenu>
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
              <HugeiconsIcon className="size-4" icon={Message01Icon} strokeWidth={2} />
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
      </SidebarGroup>
    </SidebarContent>
  );
}
