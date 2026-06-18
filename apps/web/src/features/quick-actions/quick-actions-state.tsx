import { atom, useSetAtom } from "jotai";
import { useMemo } from "react";

import { inviteMemberDialogSourceAtom } from "@/features/settings/invite-member";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";
import {
  editWeekQuickActionStateAtom,
  type EditWeekQuickActionState,
} from "@/features/quick-actions/edit-week-quick-action";
import { teamQuickActionStateAtom } from "@/features/quick-actions/team-quick-action";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

export function useQuickActionOpeners() {
  const setInviteMemberDialogSource = useSetAtom(inviteMemberDialogSourceAtom);
  const setCreateTaskQuickActionState = useSetAtom(createTaskQuickActionStateAtom);
  const setEditWeekQuickActionState = useSetAtom(editWeekQuickActionStateAtom);
  const setTeamQuickActionState = useSetAtom(teamQuickActionStateAtom);

  return useMemo(
    () => ({
      openCreateTask: (
        options: {
          readonly assignTo?: string | null;
          readonly workflowStatusId?: string | null;
          readonly teamId?: string | null;
          // Subtask openers pass the parent Task and preset its Team
          // (ADR 0013: subtasks inherit the parent's Team by default).
          readonly parentTaskId?: string | null;
        } = {},
      ) =>
        setCreateTaskQuickActionState({
          assignTo: options.assignTo ?? null,
          workflowStatusId: options.workflowStatusId ?? null,
          teamId: options.teamId ?? null,
          parentTaskId: options.parentTaskId ?? null,
        }),
      openCreateTeam: (options: { readonly churchId: string }) =>
        setTeamQuickActionState({ mode: "create", churchId: options.churchId }),
      openEditTeam: (options: { readonly churchId: string; readonly teamId: string }) =>
        setTeamQuickActionState({
          mode: "edit",
          churchId: options.churchId,
          teamId: options.teamId,
        }),
      openEditWeek: (week: EditWeekQuickActionState) => setEditWeekQuickActionState(week),
      openInviteMember: () => setInviteMemberDialogSource("quick-actions"),
    }),
    [
      setCreateTaskQuickActionState,
      setEditWeekQuickActionState,
      setInviteMemberDialogSource,
      setTeamQuickActionState,
    ],
  );
}
