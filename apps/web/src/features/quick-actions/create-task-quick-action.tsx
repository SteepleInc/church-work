import { useNavigate } from "@tanstack/react-router";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { ClipboardPlusIcon, ListTodoIcon } from "lucide-react";
import { useState } from "react";

import {
  getExecutionWorkflowId,
  getTaskCreationDefaults,
  selectCurrentExecutionCycle,
} from "@/components/tasks/task-execution-surface";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateTaskMutation } from "@/data/tasks/tasksData.app";
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

export type CreateTaskQuickActionState =
  | { readonly type: "my" }
  | { readonly type: "church" }
  | null;

export const createTaskQuickActionStateAtom = atom<CreateTaskQuickActionState>(null);

const CreateTaskSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1, { message: () => "Enter a Task title." })),
});

export function CreateTaskQuickAction() {
  const [state, setState] = useAtom(createTaskQuickActionStateAtom);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const createTask = useCreateTaskMutation();

  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const today = new Date().toISOString().slice(0, 10);
  const currentCycle = selectCurrentExecutionCycle(cyclesCollection.cyclesCollection, today);
  const churchDefaultWorkflow = workflows.workflowsCollection.find(
    (workflow) => workflow.isDefault,
  );
  const workflowId = getExecutionWorkflowId({
    surface: state?.type === "my" ? "my_work" : "our_work",
    churchDefaultWorkflowId: churchDefaultWorkflow?.id,
    teamDefaultWorkflowId: null,
  });
  const creationStatus =
    workflowStatusesCollection.workflowStatusesCollection.find(
      (status) => status.workflowId === workflowId && status.taskState === "todo",
    ) ??
    workflowStatusesCollection.workflowStatusesCollection.find(
      (status) => status.taskState === "todo",
    ) ??
    workflowStatusesCollection.workflowStatusesCollection[0];
  const isOpen = state !== null;
  const isLoading =
    cyclesCollection.loading ||
    workflows.loading ||
    workflowStatusesCollection.loading ||
    !activeChurch;
  const Icon = state?.type === "my" ? ClipboardPlusIcon : ListTodoIcon;
  const dialogTitle = state?.type === "my" ? "Create My Task" : "Create Church Task";

  const close = () => {
    setState(null);
    setError(null);
    form.reset();
  };

  const form = useAppForm({
    defaultValues: {
      title: "",
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(CreateTaskSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!activeChurch || !currentUserId || !churchId || !state) return;

      const trimmedTitle = value.title.trim();
      if (!trimmedTitle) {
        setError("Enter a Task title.");
        return;
      }

      if (!creationStatus) {
        setError("Church Task could not find a To Do Workflow Status.");
        return;
      }

      setError(null);
      const defaults = getTaskCreationDefaults({
        surface: state.type === "my" ? "my_work" : "our_work",
        currentUserId,
        teamId: null,
      });
      const result = await createTask({
        churchId,
        actorUserId: currentUserId,
        title: trimmedTitle,
        teamId: defaults.teamId,
        assignedUserId: defaults.assignedUserId,
        workflowStatusId: creationStatus.id,
        dueDate: currentCycle?.endDate ?? today,
        parentTaskId: null,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const destination = state.type === "my" ? "/my-work" : "/our-work";
      formApi.reset();
      setState(null);
      setError(null);
      await navigate({ to: destination });
    },
  });

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <Icon className="mr-2 size-4" />
            {dialogTitle}
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
                  placeholder={
                    state?.type === "my" ? "Add a Task assigned to me" : "Add Church-wide Task"
                  }
                  required
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
