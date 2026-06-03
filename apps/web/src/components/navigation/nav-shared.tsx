import type { ComponentProps, ReactNode } from "react";
import {
  AiFolder01Icon,
  Building03Icon,
  CheckListIcon,
  Database01Icon,
  Home01Icon,
  Settings01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

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

export const settingsNavItems: readonly NavItem[] = [
  {
    icon: <NavIcon icon={UserCircleIcon} />,
    title: "Profile",
    to: "/settings/profile",
  },
  {
    icon: <NavIcon icon={Building03Icon} />,
    title: "Church",
    to: "/settings/org",
  },
  {
    icon: <NavIcon icon={UserGroupIcon} />,
    matchPath: "/settings/team",
    title: "Team",
    to: "/settings/team/members",
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

export const appAdminNavItems: readonly NavItem[] = [
  {
    icon: <NavIcon icon={Building03Icon} />,
    title: "Churches",
    to: "/admin/orgs",
  },
  {
    icon: <NavIcon icon={UserCircleIcon} />,
    title: "Users",
    to: "/admin/users",
  },
];

export const homeNavItem: NavItem = {
  icon: <NavIcon icon={Home01Icon} />,
  title: "Home",
  to: "/",
};
