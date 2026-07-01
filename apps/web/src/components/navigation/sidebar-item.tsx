import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SideBarItemProps = {
  readonly to: string;
  readonly title: ReactNode;
  readonly icon: ReactNode;
  readonly dontMatchFor?: readonly string[];
  readonly matchFor?: readonly string[];
  readonly onlyExact?: boolean;
  readonly matchPath?: string;
  readonly badge?: ReactNode;
  readonly className?: string;
  readonly state?: "open" | "closed";
};

export function SideBarItem({
  to,
  title,
  icon,
  matchFor = [],
  dontMatchFor = [],
  onlyExact = false,
  matchPath = to,
  badge,
  className,
  state,
}: SideBarItemProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setOpenMobile } = useSidebar();

  const isActive = useMemo(() => {
    if (matchFor.includes(pathname)) {
      return true;
    }

    if (dontMatchFor.includes(pathname)) {
      return false;
    }

    if (onlyExact) {
      return pathname === matchPath;
    }

    return pathname.startsWith(matchPath);
  }, [dontMatchFor, matchFor, matchPath, onlyExact, pathname]);

  return (
    <SidebarMenuItem className={cn(className)} data-state={state}>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            onClick={() => setOpenMobile(false)}
            preload="intent"
            search={(previousSearch) => ({
              "details-pane": (previousSearch as { readonly "details-pane"?: unknown })[
                "details-pane"
              ],
            })}
            to={to as "/"}
          />
        }
      >
        {icon}
        {title}
      </SidebarMenuButton>

      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}
