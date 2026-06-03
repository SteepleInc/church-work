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

import { inviteMemberIsOpenAtom } from "@/features/settings/invite-member";
import type { QuickActionDefinition } from "@/features/quick-actions/quick-actions-types";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

type BuildChurchTaskQuickActionsInput = {
  readonly canInviteMembers: boolean;
  readonly closeQuickActions: () => void;
  readonly navigateToMyWork: () => void;
  readonly navigateToOurWork: () => void;
  readonly navigateToSettings: () => void;
  readonly openInviteMember: () => void;
};

export function buildChurchTaskQuickActions({
  canInviteMembers,
  closeQuickActions,
  navigateToMyWork,
  navigateToOurWork,
  navigateToSettings,
  openInviteMember,
}: BuildChurchTaskQuickActionsInput): QuickActionDefinition[] {
  const selectAndClose = (action: () => void | Promise<void>) => async () => {
    await action();
    closeQuickActions();
  };

  return [
    {
      group: "big-action",
      icon: ClipboardPlusIcon,
      name: "Create My Task",
      description: "Go to My Work to create a Task assigned to you.",
      keywords: ["task", "my work", "create", "todo"],
      enabled: true,
      onSelect: selectAndClose(navigateToMyWork),
    },
    {
      group: "big-action",
      icon: ListTodoIcon,
      name: "Create Church Task",
      description: "Go to Our Work to create a Church-wide Task.",
      keywords: ["task", "our work", "church", "create"],
      enabled: true,
      onSelect: selectAndClose(navigateToOurWork),
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
  const setInviteMemberIsOpen = useSetAtom(inviteMemberIsOpenAtom);

  return useMemo(
    () => ({
      openInviteMember: () => setInviteMemberIsOpen(true),
    }),
    [setInviteMemberIsOpen],
  );
}
