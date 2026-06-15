import type { ComponentProps, ReactNode } from "react";
import {
  AiFolder01Icon,
  CheckListIcon,
  Database01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ChurchIcon } from "@/components/icons/churchIcon";
import { HomeIcon } from "@/components/icons/homeIcon";
import { PersonIcon } from "@/components/icons/personIcon";

export type NavItem = {
  readonly title: string | ReactNode;
  readonly to: string;
  readonly icon: ReactNode;
  readonly dontMatchFor?: readonly string[];
  readonly matchFor?: readonly string[];
  readonly onlyExact?: boolean;
  readonly matchPath?: string;
};

function NavIcon({ icon }: { readonly icon: ComponentProps<typeof HugeiconsIcon>["icon"] }) {
  return <HugeiconsIcon className="size-4" icon={icon} strokeWidth={2} />;
}

export const workspaceNavItems: readonly NavItem[] = [
  {
    icon: <NavIcon icon={CheckListIcon} />,
    title: "My Work",
    to: "/my-work",
  },
  {
    icon: <NavIcon icon={AiFolder01Icon} />,
    title: "Our Work",
    to: "/our-work",
  },
];

export const devNavItems: readonly NavItem[] = [
  {
    icon: <NavIcon icon={Settings01Icon} />,
    title: "Session",
    to: "/dev/session",
  },
  {
    icon: <NavIcon icon={Database01Icon} />,
    title: "Data Adapters",
    to: "/dev/data",
  },
];

export const adminNavItems: readonly NavItem[] = [
  {
    icon: <ChurchIcon />,
    title: "Churches",
    to: "/admin/orgs",
  },
  {
    icon: <PersonIcon />,
    title: "Users",
    to: "/admin/users",
  },
];

export const appAdminNavItems = adminNavItems;

export const homeNavItem: NavItem = {
  icon: <HomeIcon />,
  title: "Home",
  to: "/",
};
