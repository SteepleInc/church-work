import { atom, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

import type { TaskEstimate, TaskPriority } from "@/components/tasks/task-card-fields";
import {
  TemplateBigActionState,
  templateBigActionStateAtom,
} from "@/features/big-actions/big-action-state";
import { useTaskCreationGate } from "@/features/billing/task-creation-gate";
import { inviteMemberDialogSourceAtom } from "@/features/settings/invite-member";
import { createKeyDateQuickActionStateAtom } from "@/features/quick-actions/create-key-date-quick-action";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";
import {
  editWeekQuickActionStateAtom,
  type EditWeekQuickActionState,
} from "@/features/quick-actions/edit-week-quick-action";
import { teamQuickActionStateAtom } from "@/features/quick-actions/team-quick-action";

export const disableQuickActionsAtom = atom(false);
export const quickActionsIsOpenAtom = atom(false);

export function useQuickActionOpeners() {
  const taskCreationGate = useTaskCreationGate();
  const setInviteMemberDialogSource = useSetAtom(inviteMemberDialogSourceAtom);
  const setCreateKeyDateQuickActionState = useSetAtom(createKeyDateQuickActionStateAtom);
  const setCreateTaskQuickActionState = useSetAtom(createTaskQuickActionStateAtom);
  const setEditWeekQuickActionState = useSetAtom(editWeekQuickActionStateAtom);
  const setTeamQuickActionState = useSetAtom(teamQuickActionStateAtom);
  const setTemplateBigActionState = useSetAtom(templateBigActionStateAtom);

  const closeBigActions = useCallback(
    () => setTemplateBigActionState(TemplateBigActionState.closed()),
    [setTemplateBigActionState],
  );

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
          // Optional human-readable parent reference shown in the dialog
          // header so a Subtask makes its lineage obvious.
          readonly parentTaskLabel?: {
            readonly identifier: string;
            readonly title: string;
          } | null;
          readonly title?: string;
          readonly description?: string;
          readonly priority?: TaskPriority;
          readonly estimate?: TaskEstimate;
          readonly labelIds?: readonly string[];
          readonly dueDate?: string | null;
        } = {},
      ) => {
        // Free Plan Task Limit (one shared policy): at 300 or more counted
        // Tasks, every user-initiated opener — buttons, shortcuts, comment
        // actions — raises the Sonner notification instead of opening the
        // creation dialog. Editing existing work is untouched.
        if (taskCreationGate.blocked) {
          taskCreationGate.notify();
          return;
        }

        closeBigActions();

        setCreateTaskQuickActionState({
          assignTo: options.assignTo ?? null,
          workflowStatusId: options.workflowStatusId ?? null,
          teamId: options.teamId ?? null,
          parentTaskId: options.parentTaskId ?? null,
          parentTaskLabel: options.parentTaskLabel ?? null,
          title: options.title,
          description: options.description,
          priority: options.priority,
          estimate: options.estimate,
          labelIds: options.labelIds,
          dueDate: options.dueDate,
        });
      },
      openCreateKeyDate: (options: { readonly churchId: string }) => {
        closeBigActions();

        setCreateKeyDateQuickActionState({ churchId: options.churchId });
      },
      openCreateTeam: (options: { readonly churchId: string }) => {
        closeBigActions();

        setTeamQuickActionState({ mode: "create", churchId: options.churchId });
      },
      openCreateTemplate: () => {
        setTemplateBigActionState(
          TemplateBigActionState.create({ shape: "weekly_service", step: 0 }),
        );
      },
      openEditTeam: (options: { readonly churchId: string; readonly teamId: string }) => {
        closeBigActions();

        setTeamQuickActionState({
          mode: "edit",
          churchId: options.churchId,
          teamId: options.teamId,
        });
      },
      openEditWeek: (week: EditWeekQuickActionState) => {
        closeBigActions();

        setEditWeekQuickActionState(week);
      },
      openInviteMember: () => {
        closeBigActions();

        setInviteMemberDialogSource("quick-actions");
      },
    }),
    [
      closeBigActions,
      taskCreationGate,
      setCreateKeyDateQuickActionState,
      setCreateTaskQuickActionState,
      setEditWeekQuickActionState,
      setInviteMemberDialogSource,
      setTemplateBigActionState,
      setTeamQuickActionState,
    ],
  );
}
