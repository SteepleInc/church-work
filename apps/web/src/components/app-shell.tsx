import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useEffect } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { AppNavigation } from "@/components/navigation/app-navigation";
import { getInternalRouteBreadcrumbLabel } from "@/components/navigation/internal-navigation";
import SignInForm from "@/components/sign-in-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import UserMenu from "@/components/user-menu";
import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { GlobalSearch } from "@/features/global-search/global-search";
import { QuickActions } from "@/features/quick-actions/quick-actions";
import { DetailsPane } from "@/components/details-pane/details-pane";
import { BigActions } from "@/features/big-actions/big-actions";

export { COMPLETED_APP_LANDING_PATH };

export const appShellOverlayOrder = [
  "DetailsPane",
  "QuickActions",
  "BigActions",
  "GlobalSearch",
] as const;

export function getPrimaryAppShellNavItems() {
  return [
    { label: "My Work", to: "/my-work", matchPath: "/my-work" },
    { label: "Our Work", to: "/our-work", matchPath: "/our-work" },
    { label: "Settings", to: "/settings", matchPath: "/settings" },
  ];
}

export function getBreadcrumbLabel(pathname: string): string {
  const internalRouteLabel = getInternalRouteBreadcrumbLabel(pathname);

  if (internalRouteLabel) {
    return internalRouteLabel;
  }

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
  const navigate = useNavigate();
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();

  useEffect(() => {
    if (!loading && (!activeChurch || !activeChurch.completedOnboarding)) {
      void navigate({ to: "/onboarding" });
    }
  }, [activeChurch, loading, navigate]);

  if (loading || !activeChurch || !activeChurch.completedOnboarding) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading Church...
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen id="app-sidebar-provider">
      <AppNavigation />
      <SidebarInset className="overflow-hidden md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
        <header className="flex h-16 shrink-0 items-center gap-4 px-4">
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
      <DetailsPane />
      <QuickActions />
      <BigActions />
      <GlobalSearch />
    </SidebarProvider>
  );
}

function AppBreadcrumbs() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{getBreadcrumbLabel(pathname)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function UnauthenticatedAppEntry() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <SignInForm />
    </main>
  );
}
