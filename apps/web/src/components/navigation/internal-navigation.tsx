import { Link, useLocation } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type InternalNavItem = {
  readonly label: string;
  readonly to: "/dev/session" | "/dev/data" | "/admin/orgs" | "/admin/users";
  readonly matchPath: string;
};

export const devNavItems: readonly InternalNavItem[] = [
  { label: "Session", to: "/dev/session", matchPath: "/dev/session" },
  { label: "Data Adapters", to: "/dev/data", matchPath: "/dev/data" },
];

export const appAdminNavItems: readonly InternalNavItem[] = [
  { label: "Churches", to: "/admin/orgs", matchPath: "/admin/orgs" },
  { label: "Users", to: "/admin/users", matchPath: "/admin/users" },
];

export function canAccessInternalNavigation(isAppAdministrator: boolean) {
  return isAppAdministrator;
}

export function getInternalRouteBreadcrumbLabel(pathname: string) {
  if (pathname.startsWith("/dev/session")) {
    return "Dev Session";
  }

  if (pathname.startsWith("/dev/data")) {
    return "Dev Data";
  }

  if (pathname.startsWith("/admin/orgs")) {
    return "App Admin Churches";
  }

  if (pathname.startsWith("/admin/users")) {
    return "App Admin Users";
  }

  return null;
}

export function InternalNavigationSections({
  isAppAdministrator,
}: {
  readonly isAppAdministrator: boolean;
}) {
  if (!canAccessInternalNavigation(isAppAdministrator)) {
    return null;
  }

  return (
    <>
      <InternalNavigationGroup label="Dev" items={devNavItems} />
      <InternalNavigationGroup label="App Admin" items={appAdminNavItems} />
    </>
  );
}

function InternalNavigationGroup({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly InternalNavItem[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <InternalNavigationItem item={item} key={item.to} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function InternalNavigationItem({ item }: { readonly item: InternalNavItem }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isActive = pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link preload="intent" to={item.to}>
            <span>{item.label}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}
