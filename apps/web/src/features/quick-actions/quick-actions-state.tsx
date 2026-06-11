import { atom, useSetAtom } from "jotai";
import { useMemo } from "react";

import { inviteMemberDialogSourceAtom } from "@/features/settings/invite-member";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

export function useQuickActionOpeners() {
  const setInviteMemberDialogSource = useSetAtom(inviteMemberDialogSourceAtom);
  const setCreateTaskQuickActionState = useSetAtom(createTaskQuickActionStateAtom);

  return useMemo(
    () => ({
      openCreateTask: (options: { readonly assignTo?: string | null } = {}) =>
        setCreateTaskQuickActionState({
          assignTo: options.assignTo ?? null,
        }),
      openInviteMember: () => setInviteMemberDialogSource("quick-actions"),
    }),
    [setCreateTaskQuickActionState, setInviteMemberDialogSource],
  );
}
