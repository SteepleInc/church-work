import { Outlet, useLocation, useRouteContext } from "@tanstack/react-router";

import { AppHeaderSlotAnchor, AppHeaderSlotProvider } from "@/components/app-header-slot";
import { getBreadcrumbLabel } from "@/components/app-shell-utils";
import { ModeToggle } from "@/components/mode-toggle";
import { AppNavigation } from "@/components/navigation/app-navigation";
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

/**
 * Optimistic Shell (ADR 0010): the chrome renders immediately, before auth or
 * the Active Church resolve. Routing decisions come from session fields via
 * useAuthGuard, which redirects after the fact; data slots inside the shell
 * handle their own absent data with Skeletons or omission. No Render Gates.
 */
export function AppShell() {
  useAuthGuard({ requireAuth: true, requireOnboarding: true });

  // Seed the sidebar's initial open/collapsed state from the cookie read in the
  // root route's beforeLoad, so SSR renders the persisted state on first paint.
  const sidebarOpen = useRouteContext({ from: "__root__", select: (ctx) => ctx.sidebarOpen });

  return (
    <SidebarProvider defaultOpen={sidebarOpen} id="app-sidebar-provider">
      <AppHeaderSlotProvider>
        <AppNavigation />
        <SidebarInset className="overflow-hidden md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
          <header className="flex h-16 shrink-0 items-center gap-4 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator className="mr-2 h-4" orientation="vertical" />
              <AppHeaderSlotAnchor>
                <AppBreadcrumbs />
              </AppHeaderSlotAnchor>
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
      </AppHeaderSlotProvider>
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
