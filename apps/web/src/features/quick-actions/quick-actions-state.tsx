import { atom, useSetAtom } from "jotai";
import { useMemo } from "react";

import { inviteMemberDialogSourceAtom } from "@/features/settings/invite-member";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";
import { teamQuickActionStateAtom } from "@/features/quick-actions/team-quick-action";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

export function useQuickActionOpeners() {
  const setInviteMemberDialogSource = useSetAtom(inviteMemberDialogSourceAtom);
  const setCreateTaskQuickActionState = useSetAtom(createTaskQuickActionStateAtom);
  const setTeamQuickActionState = useSetAtom(teamQuickActionStateAtom);

  return useMemo(
    () => ({
      openCreateTask: (options: { readonly assignTo?: string | null } = {}) =>
        setCreateTaskQuickActionState({
          assignTo: options.assignTo ?? null,
        }),
      openCreateTeam: (options: { readonly churchId: string }) =>
        setTeamQuickActionState({ mode: "create", churchId: options.churchId }),
      openEditTeam: (options: { readonly churchId: string; readonly teamId: string }) =>
        setTeamQuickActionState({
          mode: "edit",
          churchId: options.churchId,
          teamId: options.teamId,
        }),
      openInviteMember: () => setInviteMemberDialogSource("quick-actions"),
    }),
    [setCreateTaskQuickActionState, setInviteMemberDialogSource, setTeamQuickActionState],
  );
}
