import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tag01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ChurchIcon } from "@/components/icons/churchIcon";
import { PersonIcon } from "@/components/icons/personIcon";

export type SettingsNavItem = {
  readonly title: string;
  readonly to: LinkProps["to"];
  readonly icon: ReactNode;
  /** When set, the item is active for any pathname that starts with this path. */
  readonly matchPath?: string;
};

export type SettingsNavGroup = {
  readonly label: string;
  readonly items: readonly SettingsNavItem[];
};

function NavIcon({ icon }: { readonly icon: Parameters<typeof HugeiconsIcon>[0]["icon"] }) {
  return <HugeiconsIcon className="size-4" icon={icon} strokeWidth={2} />;
}

/**
 * Static settings sections, modeled on Linear's settings sidebar. "Your teams"
 * is rendered separately because it is sourced from live Church Team data.
 */
export const accountNavGroup: SettingsNavGroup = {
  label: "Account",
  items: [
    {
      icon: <PersonIcon />,
      title: "Profile",
      to: "/settings/account/profile",
    },
  ],
};

export const administrationNavGroup: SettingsNavGroup = {
  label: "Administration",
  items: [
    {
      icon: <ChurchIcon />,
      title: "Workspace",
      to: "/settings/workspace/general",
    },
    {
      icon: <NavIcon icon={UserGroupIcon} />,
      title: "Members",
      to: "/settings/workspace/members",
    },
    {
      icon: <NavIcon icon={Tag01Icon} />,
      title: "Labels",
      to: "/settings/workspace/labels",
    },
  ],
};

export const settingsNavGroups: readonly SettingsNavGroup[] = [
  accountNavGroup,
  administrationNavGroup,
];
