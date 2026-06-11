import {
  Building2Icon,
  ClipboardPlusIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";

import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";
import type { CurrentMemberRole } from "@/features/settings/invite-member-utils";

export function canManageChurchTeams(currentRole: CurrentMemberRole) {
  return Array.isArray(currentRole)
    ? currentRole.includes("owner") || currentRole.includes("admin")
    : currentRole === "owner" || currentRole === "admin";
}

type BuildChurchTaskQuickActionsInput = {
  readonly canInviteMembers: boolean;
  readonly canManageTeams: boolean;
  readonly closeQuickActions: () => void;
  readonly openCreateTask: () => void;
  readonly openCreateTeam: () => void;
  readonly navigateToSettings: () => void;
  readonly openInviteMember: () => void;
};

export function buildChurchTaskQuickActions({
  canInviteMembers,
  canManageTeams,
  closeQuickActions,
  openCreateTask,
  openCreateTeam,
  navigateToSettings,
  openInviteMember,
}: BuildChurchTaskQuickActionsInput): QuickActionDefinition[] {
  const selectAndClose = (action: () => void | Promise<void>) => async () => {
    await action();
    closeQuickActions();
  };

  return [
    {
      group: "quick-action",
      icon: ClipboardPlusIcon,
      name: "Create Task",
      description: "Open the task creation dialog.",
      keywords: ["task", "create", "todo", "my work", "church"],
      enabled: true,
      onSelect: selectAndClose(openCreateTask),
    },
    {
      group: "quick-action",
      icon: UsersRoundIcon,
      name: "Create Team",
      description: "Create a Team in this Church.",
      keywords: ["team", "create", "group", "church"],
      enabled: canManageTeams,
      disabledReason: canManageTeams
        ? undefined
        : "Only Church owners and admins can create Teams.",
      onSelect: selectAndClose(openCreateTeam),
    },
    {
      group: "quick-action",
      icon: UserPlusIcon,
      name: "Invite Member",
      description: "Invite someone to this Church.",
      keywords: ["invite", "member", "church", "email"],
      enabled: canInviteMembers,
      disabledReason: canInviteMembers
        ? undefined
        : "Only Church owners and admins can invite members.",
      onSelect: selectAndClose(openInviteMember),
    },
    {
      group: "quick-action",
      icon: UsersIcon,
      name: "Team Settings",
      description: "Manage Church members, Teams, and invitations.",
      keywords: ["team", "members", "invitations", "settings"],
      enabled: true,
      onSelect: selectAndClose(navigateToSettings),
    },
    {
      group: "quick-action",
      icon: Building2Icon,
      name: "Church Settings",
      description: "Review this Church profile and configuration.",
      keywords: ["church", "org", "settings", "profile"],
      enabled: true,
      onSelect: selectAndClose(navigateToSettings),
    },
    {
      group: "quick-action",
      icon: SettingsIcon,
      name: "Profile Settings",
      description: "Update your profile settings.",
      keywords: ["profile", "settings", "user", "account"],
      enabled: true,
      onSelect: selectAndClose(navigateToSettings),
    },
  ];
}
