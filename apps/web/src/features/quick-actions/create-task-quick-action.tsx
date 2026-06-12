import { useNavigate } from "@tanstack/react-router";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { ClipboardPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  getExecutionWorkflowId,
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

export type CreateTaskQuickActionState = {
  readonly assignTo: string | null;
  // Preset Workflow Status when created from a Board Column's "+" button.
  readonly workflowStatusId?: string | null;
  readonly teamId?: string | null;
} | null;

export const createTaskQuickActionStateAtom = atom<CreateTaskQuickActionState>(null);

const CreateTaskSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1, { message: () => "Enter a Task title." })),
  assignedUserId: Schema.NullOr(Schema.String),
  workflowStatusId: Schema.String,
});

export function CreateTaskQuickAction() {
  const [state, setState] = useAtom(createTaskQuickActionStateAtom);
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
  const today = new Date().toISOString().slice(0, 10);
  const currentCycle = selectCurrentExecutionCycle(cyclesCollection.cyclesCollection, today);
  const churchDefaultWorkflow = workflows.workflowsCollection.find(
    (workflow) => workflow.isDefault,
  );
  const workflowId = getExecutionWorkflowId({
    surface: "our_work",
    churchDefaultWorkflowId: churchDefaultWorkflow?.id,
    teamDefaultWorkflowId: null,
  });
  const workflowStatuses = workflowStatusesCollection.workflowStatusesCollection;
  // A preset status (from a Board Column "+") pins the dialog to that status's
  // Workflow; otherwise the Church default Workflow's first To Do status wins.
  const presetStatus = state?.workflowStatusId
    ? workflowStatuses.find((status) => status.id === state.workflowStatusId)
    : undefined;
  const effectiveWorkflowId = presetStatus?.workflowId ?? workflowId;
  const creationStatus =
    presetStatus ??
    workflowStatuses.find(
      (status) => status.workflowId === effectiveWorkflowId && status.taskState === "todo",
    ) ??
    workflowStatuses.find((status) => status.taskState === "todo") ??
    workflowStatuses[0];
  const workflowStatusOptions = workflowStatuses
    .filter((status) => status.workflowId === effectiveWorkflowId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((status) => ({ value: status.id, label: status.name }));
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
    !activeChurch;

  const close = () => {
    setState(null);
    setError(null);
    form.reset();
  };

  const form = useAppForm({
    defaultValues: {
      title: "",
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

      const selectedStatus = value.workflowStatusId
        ? workflowStatuses.find((status) => status.id === value.workflowStatusId)
        : undefined;
      const submitStatus = selectedStatus ?? creationStatus;
      if (!submitStatus) {
        setError("Task could not find a To Do Workflow Status.");
        return;
      }

      setError(null);
      const result = await createTask({
        churchId,
        actorUserId: currentUserId,
        title: trimmedTitle,
        teamId: state?.teamId ?? null,
        assignedUserId: value.assignedUserId,
        workflowStatusId: submitStatus.id,
        dueDate: currentCycle?.endDate ?? today,
        parentTaskId: null,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const createdTaskId = result.data.tasks[0]?.id;
      formApi.reset();
      setState(null);
      setError(null);

      if (createdTaskId) {
        toast.success("Task created.", {
          action: {
            label: "Open Task",
            onClick: () => {
              const url = openTaskDetailsPaneUrl({ id: createdTaskId });
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
            <form.AppField name="workflowStatusId">
              {(field) => (
                <field.SelectField
                  disabled={isLoading || workflowStatusOptions.length === 0}
                  label="Workflow Status"
                  options={workflowStatusOptions}
                  placeholder={creationStatus?.name ?? "Select a status"}
                />
              )}
            </form.AppField>
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
