import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";

export { COMPLETED_APP_LANDING_PATH };

export const appShellOverlayOrder = [
  "DetailsPane",
  "QuickActions",
  "BigActions",
  "GlobalSearch",
] as const;

export function getPrimaryAppShellNavItems() {
  return [
    { label: "Inbox", to: "/inbox", matchPath: "/inbox" },
    { label: "My Work", to: "/my-work", matchPath: "/my-work" },
    { label: "Our Work", to: "/our-work", matchPath: "/our-work" },
    { label: "Templates", to: "/templates", matchPath: "/templates" },
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

  if (pathname.startsWith("/inbox")) {
    return "Inbox";
  }

  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  if (pathname.startsWith("/templates")) {
    return "Templates";
  }

  if (pathname.startsWith("/team/")) {
    return "Team Work";
  }

  return "My Work";
}

function getInternalRouteBreadcrumbLabel(pathname: string) {
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
