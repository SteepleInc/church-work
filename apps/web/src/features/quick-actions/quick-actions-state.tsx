import { atom, useSetAtom } from "jotai";
import {
  Building2Icon,
  ClipboardPlusIcon,
  ListTodoIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo } from "react";

import { inviteMemberDialogSourceAtom } from "@/features/settings/invite-member";
import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

type BuildChurchTaskQuickActionsInput = {
  readonly canInviteMembers: boolean;
  readonly closeQuickActions: () => void;
  readonly openCreateChurchTask: () => void;
  readonly openCreateMyTask: () => void;
  readonly navigateToSettings: () => void;
  readonly openInviteMember: () => void;
};

export function buildChurchTaskQuickActions({
  canInviteMembers,
  closeQuickActions,
  openCreateChurchTask,
  openCreateMyTask,
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
      name: "Create My Task",
      description: "Open the task creation dialog assigned to you.",
      keywords: ["task", "my work", "create", "todo"],
      enabled: true,
      onSelect: selectAndClose(openCreateMyTask),
    },
    {
      group: "quick-action",
      icon: ListTodoIcon,
      name: "Create Church Task",
      description: "Open the Church-wide task creation dialog.",
      keywords: ["task", "our work", "church", "create"],
      enabled: true,
      onSelect: selectAndClose(openCreateChurchTask),
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

export function useQuickActionOpeners() {
  const setInviteMemberDialogSource = useSetAtom(inviteMemberDialogSourceAtom);
  const setCreateTaskQuickActionState = useSetAtom(createTaskQuickActionStateAtom);

  return useMemo(
    () => ({
      openCreateChurchTask: () => setCreateTaskQuickActionState({ type: "church" }),
      openCreateMyTask: () => setCreateTaskQuickActionState({ type: "my" }),
      openInviteMember: () => setInviteMemberDialogSource("quick-actions"),
    }),
    [setCreateTaskQuickActionState, setInviteMemberDialogSource],
  );
}
