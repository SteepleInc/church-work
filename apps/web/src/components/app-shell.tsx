import { Outlet, useLocation } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import { getBreadcrumbLabel } from "@/components/app-shell-utils";
import { ModeToggle } from "@/components/mode-toggle";
import { AppNavigation } from "@/components/navigation/app-navigation";
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
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { GlobalSearch } from "@/features/global-search/global-search";
import { QuickActions } from "@/features/quick-actions/quick-actions";
import { DetailsPane } from "@/components/details-pane/details-pane";
import { BigActions } from "@/features/big-actions/big-actions";

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
  const { activeChurch, loading, hasCompletedOnboarding } = useAuthGuard({
    requireOnboarding: true,
  });

  if (loading || !activeChurch || !hasCompletedOnboarding) {
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
