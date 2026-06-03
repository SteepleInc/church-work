import { api } from "@church-task/backend/convex/_generated/api";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";

import { ModeToggle } from "@/components/mode-toggle";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import UserMenu from "@/components/user-menu";
import { getMemberTeams } from "@/routes/-dashboard";
import { useState } from "react";

export const COMPLETED_APP_LANDING_PATH = "/my-work";

type AppShellNavItem = {
  readonly label: string;
  readonly to: "/my-work" | "/our-work" | "/settings" | "/team/$teamId";
  readonly params?: { readonly teamId: string };
  readonly matchPath: string;
};

export function getPrimaryAppShellNavItems(): AppShellNavItem[] {
  return [
    { label: "My Work", to: "/my-work", matchPath: "/my-work" },
    { label: "Our Work", to: "/our-work", matchPath: "/our-work" },
    { label: "Settings", to: "/settings", matchPath: "/settings" },
  ];
}

export function getBreadcrumbLabel(pathname: string): string {
  if (pathname.startsWith("/our-work")) {
    return "Our Work";
  }

  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  if (pathname.startsWith("/team/")) {
    return "Team Work";
  }

  return "My Work";
}

export function AppShell() {
  return (
    <>
      <Authenticated>
        <AuthenticatedAppShell />
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedAppEntry />
      </Unauthenticated>
      <AuthLoading>
        <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      </AuthLoading>
    </>
  );
}

function AuthenticatedAppShell() {
  return (
    <SidebarProvider className="min-h-svh bg-muted/30" defaultOpen id="app-sidebar-provider">
      <AppNavigation />
      <SidebarInset className="overflow-hidden bg-muted/30 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator className="mr-2 h-4" orientation="vertical" />
            <AppBreadcrumbs />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <UserMenu />
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppNavigation() {
  const activeChurch = useQuery(api.dashboard.getActiveOrganization);
  const teams = useQuery(
    api.teams.listForChurch,
    activeChurch ? { churchId: activeChurch.id } : "skip",
  );
  const teamMemberships = useQuery(
    api.teams.listMembershipsForChurch,
    activeChurch ? { churchId: activeChurch.id } : "skip",
  );
  const activeTeams = teams?.ok && teams.operation === "listTeams" ? teams.data.teams : [];
  const memberships =
    teamMemberships?.ok && teamMemberships.operation === "listTeamMemberships"
      ? teamMemberships.data.teamMemberships
      : [];
  const memberTeams = getMemberTeams(activeTeams, memberships, activeChurch?.currentUserId ?? null);

  return (
    <Sidebar className="px-0 pb-0" collapsible="icon" variant="inset">
      <SidebarHeader className="mx-2 pb-0">
        <div className="rounded-lg px-2 py-2">
          <p className="text-sm font-semibold">Church Task</p>
          <p className="truncate text-xs text-muted-foreground">
            {activeChurch?.name ?? "Church workspace"}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getPrimaryAppShellNavItems().map((item) => (
                <AppNavigationItem key={item.to} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Team Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teamMemberships === undefined || teams === undefined ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>Loading Teams...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : memberTeams.length > 0 ? (
                memberTeams.map((team) => (
                  <AppNavigationItem
                    key={team.id}
                    item={{
                      label: team.name,
                      to: "/team/$teamId",
                      params: { teamId: team.id },
                      matchPath: `/team/${team.id}`,
                    }}
                  />
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>No Team memberships</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function AppNavigationItem({ item }: { item: AppShellNavItem }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isActive = pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link params={item.params} preload="intent" to={item.to}>
            <span>{item.label}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}

function AppBreadcrumbs() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>Church Task</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{getBreadcrumbLabel(pathname)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function UnauthenticatedAppEntry() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </main>
  );
}
