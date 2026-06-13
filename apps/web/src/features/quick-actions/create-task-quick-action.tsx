import { useNavigate } from "@tanstack/react-router";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { ClipboardPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  getDefaultCreateTaskTeamId,
  selectCurrentExecutionCycle,
} from "@/components/tasks/task-execution-surface-utils";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateTaskMutation } from "@/data/tasks/tasksData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useWorkflowStatusesCollection,
  useWorkflowsCollection,
} from "@/data/workflows/workflowsData.app";
import {
  QuickActionForm,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";
import { getLastUsedTeamId, lastUsedTeamIdsAtom, setLastUsedTeamId } from "@/shared/global-state";

export type CreateTaskQuickActionState = {
  readonly assignTo: string | null;
  // Preset Workflow Status when created from a Board Column's "+" button.
  readonly workflowStatusId?: string | null;
  // Preset Team: a Team Board presets its Team; subtask openers preset the
  // parent Task's Team (ADR 0013).
  readonly teamId?: string | null;
  // Creating a subtask: openers pass the parent Task plus its Team preset.
  readonly parentTaskId?: string | null;
} | null;

export const createTaskQuickActionStateAtom = atom<CreateTaskQuickActionState>(null);

const CreateTaskSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1, { message: () => "Enter a Task title." })),
  teamId: Schema.String.pipe(Schema.minLength(1, { message: () => "Select a Team." })),
  assignedUserId: Schema.NullOr(Schema.String),
  workflowStatusId: Schema.String,
});

export function CreateTaskQuickAction() {
  const [state, setState] = useAtom(createTaskQuickActionStateAtom);
  const [lastUsedTeamIds, setLastUsedTeamIds] = useAtom(lastUsedTeamIdsAtom);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const createTask = useCreateTaskMutation();

  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const usersCollection = useChurchUsersCollection({ churchId });
  const teamsCollection = useTeamsCollection({ churchId });
  const teamMembershipsCollection = useTeamMembershipsCollection({ churchId });
  const today = new Date().toISOString().slice(0, 10);
  const currentCycle = selectCurrentExecutionCycle(cyclesCollection.cyclesCollection, today);
  const teams = teamsCollection.teamsCollection;
  const orderedTeams = [...teams].sort((left, right) => left.sortOrder - right.sortOrder);
  const teamOptions = orderedTeams.map((team) => ({ value: team.id, label: team.name }));
  // Default Team chain (ADR 0013): preset → last-used → first Team
  // Membership → first Church Team. Never empty while Teams exist.
  const defaultTeamId =
    currentUserId !== null
      ? getDefaultCreateTaskTeamId({
          presetTeamId: state?.teamId ?? null,
          lastUsedTeamId: churchId ? getLastUsedTeamId(lastUsedTeamIds, churchId) : null,
          currentUserId,
          teams,
          memberships: teamMembershipsCollection.teamMembershipsCollection,
        })
      : null;
  const workflowStatuses = workflowStatusesCollection.workflowStatusesCollection;
  // A preset status (from a Board Column "+") pins the dialog to that status's
  // Workflow; otherwise the selected Team's own Workflow provides the
  // statuses (ADR 0013: every Team owns its Workflow; no Church default).
  const presetStatus = state?.workflowStatusId
    ? workflowStatuses.find((status) => status.id === state.workflowStatusId)
    : undefined;
  const getStatusContext = (teamId: string) => {
    const teamWorkflow = workflows.workflowsCollection.find(
      (workflow) => workflow.teamId === teamId && workflow.archivedAt === null,
    );
    const effectiveWorkflowId = presetStatus?.workflowId ?? teamWorkflow?.id ?? null;
    const creationStatus =
      presetStatus ??
      workflowStatuses.find(
        (status) => status.workflowId === effectiveWorkflowId && status.taskState === "todo",
      ) ??
      workflowStatuses.find((status) => status.taskState === "todo") ??
      workflowStatuses[0];
    const options = workflowStatuses
      .filter((status) => status.workflowId === effectiveWorkflowId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((status) => ({ value: status.id, label: status.name }));

    return { effectiveWorkflowId, creationStatus, options };
  };
  const assigneeOptions = usersCollection.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));
  const isOpen = state !== null;
  const isLoading =
    cyclesCollection.loading ||
    workflows.loading ||
    workflowStatusesCollection.loading ||
    usersCollection.loading ||
    teamsCollection.loading ||
    teamMembershipsCollection.loading ||
    !activeChurch;

  const close = () => {
    setState(null);
    setError(null);
    form.reset();
  };

  const form = useAppForm({
    defaultValues: {
      title: "",
      teamId: state?.teamId ?? defaultTeamId ?? "",
      assignedUserId: state?.assignTo ?? (null as string | null),
      workflowStatusId: state?.workflowStatusId ?? "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(CreateTaskSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!activeChurch || !currentUserId || !churchId) return;

      const trimmedTitle = value.title.trim();
      if (!trimmedTitle) {
        setError("Enter a Task title.");
        return;
      }

      if (!value.teamId) {
        setError("Select a Team.");
        return;
      }

      const statusContext = getStatusContext(value.teamId);
      const selectedStatus = value.workflowStatusId
        ? workflowStatuses.find((status) => status.id === value.workflowStatusId)
        : undefined;
      // A status picked before switching Teams may belong to the wrong
      // Workflow; fall back to the Team's To Do status.
      const submitStatus =
        selectedStatus && selectedStatus.workflowId === statusContext.effectiveWorkflowId
          ? selectedStatus
          : statusContext.creationStatus;
      if (!submitStatus) {
        setError("Task could not find a To Do Workflow Status.");
        return;
      }

      setError(null);
      const result = await createTask({
        churchId,
        actorUserId: currentUserId,
        title: trimmedTitle,
        teamId: value.teamId,
        assignedUserId: value.assignedUserId,
        workflowStatusId: submitStatus.id,
        dueDate: currentCycle?.endDate ?? today,
        parentTaskId: state?.parentTaskId ?? null,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setLastUsedTeamIds(setLastUsedTeamId(lastUsedTeamIds, churchId, value.teamId));

      // Task links carry the Task Identifier, not the database id (ADR 0013).
      const createdTaskIdentifier = result.data.tasks[0]?.identifier;
      formApi.reset();
      setState(null);
      setError(null);

      if (createdTaskIdentifier) {
        toast.success("Task created.", {
          action: {
            label: "Open Task",
            onClick: () => {
              const url = openTaskDetailsPaneUrl({ id: createdTaskIdentifier });
              void navigate({ to: url.to, search: url.search });
            },
          },
        });
      } else {
        toast.success("Task created.");
      }
    },
  });

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <ClipboardPlusIcon className="mr-2 size-4" />
            Create Task
          </span>
        </QuickActionsTitle>
      </QuickActionsHeader>
      <QuickActionForm
        form={form}
        Primary={
          <>
            <form.AppField name="title">
              {(field) => (
                <field.InputField
                  autoFocus
                  disabled={isLoading}
                  label="Task Title"
                  placeholder="Add a Task"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="teamId">
              {(field) => (
                <field.SelectField
                  disabled={isLoading || teamOptions.length === 0}
                  label="Team"
                  options={teamOptions}
                  placeholder="Select a Team"
                  required
                />
              )}
            </form.AppField>
            <form.Subscribe selector={(formState) => formState.values.teamId}>
              {(selectedTeamId) => {
                const statusContext = getStatusContext(selectedTeamId);

                return (
                  <form.AppField name="workflowStatusId">
                    {(field) => (
                      <field.SelectField
                        disabled={isLoading || statusContext.options.length === 0}
                        label="Workflow Status"
                        options={statusContext.options}
                        placeholder={statusContext.creationStatus?.name ?? "Select a status"}
                      />
                    )}
                  </form.AppField>
                );
              }}
            </form.Subscribe>
            <form.AppField name="assignedUserId">
              {(field) => (
                <field.OrgUserSelectField
                  disabled={isLoading}
                  label="Assignee"
                  options={assigneeOptions}
                />
              )}
            </form.AppField>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </>
        }
        Actions={
          <form.Subscribe selector={(formState) => formState.isSubmitting}>
            {(isSubmitting) => (
              <Button className="ml-auto" disabled={isLoading} loading={isSubmitting} type="submit">
                Create Task
                <Kbd>enter</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </QuickActionsWrapper>
  );
}
