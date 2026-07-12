import {
  Building2Icon,
  CalendarDaysIcon,
  ClipboardPlusIcon,
  LibraryBigIcon,
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

type BuildChurchWorkQuickActionsInput = {
  // Free Plan Task Limit: at 300 or more counted Tasks the Create Task action
  // is disabled with a role-aware explanation (defaults keep tests and callers
  // without billing context working).
  readonly canCreateTasks?: boolean;
  readonly createTasksDisabledReason?: string;
  readonly canInviteMembers: boolean;
  readonly canManageKeyDates: boolean;
  readonly canManageTemplates: boolean;
  readonly canManageTeams: boolean;
  readonly closeQuickActions: () => void;
  readonly openCreateKeyDate: () => void;
  readonly openCreateTemplate: () => void;
  readonly openCreateTask: () => void;
  readonly openCreateTeam: () => void;
  readonly navigateToSettings: () => void;
  readonly openInviteMember: () => void;
};

export function buildChurchWorkQuickActions({
  canCreateTasks = true,
  createTasksDisabledReason,
  canInviteMembers,
  canManageKeyDates,
  canManageTemplates,
  canManageTeams,
  closeQuickActions,
  openCreateKeyDate,
  openCreateTemplate,
  openCreateTask,
  openCreateTeam,
  navigateToSettings,
  openInviteMember,
}: BuildChurchWorkQuickActionsInput): QuickActionDefinition[] {
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
      enabled: canCreateTasks,
      disabledReason: canCreateTasks ? undefined : createTasksDisabledReason,
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
      icon: LibraryBigIcon,
      name: "Create Template",
      description: "Open the Template authoring flow.",
      keywords: ["template", "create", "recurring", "schedule", "weekly service"],
      enabled: canManageTemplates,
      disabledReason: canManageTemplates
        ? undefined
        : "Only Church owners and admins can create Templates.",
      onSelect: selectAndClose(openCreateTemplate),
    },
    {
      group: "quick-action",
      icon: CalendarDaysIcon,
      name: "Create Key Date",
      description: "Add a date your Church plans around.",
      keywords: ["key date", "create", "easter", "christmas", "anniversary", "calendar"],
      enabled: canManageKeyDates,
      disabledReason: canManageKeyDates
        ? undefined
        : "Only Church owners and admins can create Key Dates.",
      onSelect: selectAndClose(openCreateKeyDate),
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
