import { useNavigate, useSearch } from "@tanstack/react-router";
import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { CalendarDays, ChevronRight, ListTree, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { useOpenTaskDetailsPaneUrl } from "@/components/details-pane/details-pane-helpers";
import { useAppForm } from "@/components/form/ts-form";
import { DraftTaskPropertySurface } from "@/components/tasks/draft-task-property-surface";
import {
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  StatusComboboxSelector,
  TaskAssigneePillTrigger,
  TaskDueDatePillTrigger,
  TaskEstimatePillTrigger,
  TaskLabelsPillTrigger,
  TaskPropertyPill,
  TaskPriorityPillTrigger,
  TaskStatusPillTrigger,
  TeamComboboxSelector,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { statusOptions } from "@/components/tasks/task-kanban-board-utils";
import {
  resolveExecutionCycleScope,
  type WeekShortcut,
} from "@/components/tasks/task-execution-surface-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { buildProjectedWeekCycles } from "@/components/weeks/team-weeks-index-data";
import { formatWeekDateRange, useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useCreateLabelMutation, useLabelsCollection } from "@/data/labels/labelsData.app";
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

export type CreateTaskQuickActionState = {
  readonly assignTo: string | null;
  // Preset Workflow Status when created from a Board Column's "+" button.
  readonly workflowStatusId?: string | null;
  // Preset Team: a Team Board presets its Team; subtask openers preset the
  // parent Task's Team (ADR 0013).
  readonly teamId?: string | null;
  // Creating a subtask: openers pass the parent Task plus its Team preset.
  readonly parentTaskId?: string | null;
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
  readonly targetCycle?: {
    readonly churchTimeZone: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly startsAt: string;
    readonly endsAt: string;
  };
} | null;

export const createTaskQuickActionStateAtom = atom<CreateTaskQuickActionState>(null);

// Linear-style dialog chrome preferences, remembered across opens.
const createTaskDialogExpandedAtom = atomWithStorage<boolean>(
  "church-work:create-task-expanded",
  false,
);
const createTaskCreateMoreAtom = atomWithStorage<boolean>(
  "church-work:create-task-create-more",
  false,
);

const CreateTaskSchema = Schema.Struct({
  title: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Enter a Task title." })),
  ),
  description: Schema.String,
  assignedUserId: Schema.NullOr(Schema.String),
  workflowStatusId: Schema.String,
  teamId: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  priority: Schema.Literals(["no_priority", "urgent", "high", "medium", "low"]),
  estimate: Schema.Literals(["no_estimate", "xs", "s", "m", "l", "xl"]),
  // Label ids; persisted on the created Task.
  labels: Schema.Array(Schema.String),
});

/**
 * A compact, read-only cue that this Task will attach to the Week currently in
 * view (its Cycle is materialized on create if it is still a Projected Week).
 * It mirrors the date range shown on the Week board header so a User reading
 * the dialog never wonders "which Week does this land in?".
 */
function TargetWeekPill({
  targetCycle,
}: {
  readonly targetCycle: NonNullable<CreateTaskQuickActionState>["targetCycle"];
}) {
  if (!targetCycle) return null;
  const dateRange = formatWeekDateRange(targetCycle);
  return (
    <span
      aria-label={`This Task will be added to the Week of ${dateRange}.`}
      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground"
    >
      <CalendarDays aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">Week of </span>
      {dateRange}
    </span>
  );
}

function ParentTaskPill({
  parentTaskLabel,
}: {
  readonly parentTaskLabel: NonNullable<CreateTaskQuickActionState>["parentTaskLabel"];
}) {
  if (!parentTaskLabel) return null;
  return (
    <span
      aria-label={`Subtask of ${parentTaskLabel.identifier} ${parentTaskLabel.title}`}
      className="inline-flex h-7 max-w-56 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground"
      title={`${parentTaskLabel.identifier} ${parentTaskLabel.title}`}
    >
      <ListTree aria-hidden className="size-3.5 shrink-0" />
      <span className="shrink-0">{parentTaskLabel.identifier}</span>
      <span className="truncate text-muted-foreground/80">{parentTaskLabel.title}</span>
    </span>
  );
}

export function CreateTaskQuickAction() {
  const [state, setState] = useAtom(createTaskQuickActionStateAtom);
  const isCreatingSubtask = Boolean(state?.parentTaskLabel);
  const search = useSearch({ strict: false }) as { readonly week?: WeekShortcut };
  const [expanded, setExpanded] = useAtom(createTaskDialogExpandedAtom);
  const [createMore, setCreateMore] = useAtom(createTaskCreateMoreAtom);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const openTaskDetailsPaneUrl = useOpenTaskDetailsPaneUrl();
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const createTask = useCreateTaskMutation();

  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatusesCollection = useWorkflowStatusesCollection({ churchId });
  const usersCollection = useChurchUsersCollection({ churchId });
  const teamsCollection = useTeamsCollection({ churchId });
  const teamMemberships = useTeamMembershipsCollection({ churchId });
  const labelsCollection = useLabelsCollection({ churchId });
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const createLabel = useCreateLabelMutation();

  const today = new Date().toISOString().slice(0, 10);
  const routeTargetCycle = useMemo(() => {
    if (!search.week || typeof window === "undefined") return undefined;
    if (!window.location.pathname.startsWith("/team/")) return undefined;

    const cycle = resolveExecutionCycleScope({
      surface: "team_board",
      week: search.week,
      cycles: buildProjectedWeekCycles({
        churchTimeZone: activeChurch?.churchTimeZone ?? "UTC",
        cycles: cyclesCollection.cyclesCollection,
        today,
      }),
      today,
    });
    return cycle?.targetCycle;
  }, [activeChurch?.churchTimeZone, cyclesCollection.cyclesCollection, search.week, today]);
  const effectiveTargetCycle = state?.targetCycle ?? routeTargetCycle;

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  // "open" = save and open the created Task (Cmd+Alt+Enter).
  const submitModeRef = useRef<"default" | "open">("default");

  // Picker openers for dialog-level keyboard shortcuts (T/S/A/P/⇧E/L/D).
  const teamOpenRef = useRef<(() => void) | null>(null);
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);

  const pickerRefs = useMemo(
    () => ({
      team: teamOpenRef,
      status: statusOpenRef,
      assignee: assigneeOpenRef,
      priority: priorityOpenRef,
      estimate: estimateOpenRef,
      labels: labelsOpenRef,
      dueDate: dueDateOpenRef,
    }),
    [],
  );

  const teams = teamsCollection.teamsCollection;
  const memberTeamIds = useMemo(
    () =>
      new Set(
        teamMemberships.teamMembershipsCollection
          .filter((membership) => membership.userId === currentUserId)
          .map((membership) => membership.teamId),
      ),
    [teamMemberships.teamMembershipsCollection, currentUserId],
  );
  const teamPickerOptions = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: (team.color ?? null) as string | null,
      })),
    [teams],
  );

  const workflowStatuses = workflowStatusesCollection.workflowStatusesCollection;
  const assigneeOptions = usersCollection.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));

  const isOpen = state !== null;
  const isLoading =
    workflows.loading ||
    workflowStatusesCollection.loading ||
    teamsCollection.loading ||
    teamMemberships.loading ||
    !activeChurch;
  const areUsersLoading = usersCollection.loading;
  const areLabelsLoading = labelsCollection.loading;

  const form = useAppForm({
    defaultValues: {
      title: state?.title ?? "",
      description: state?.description ?? "",
      assignedUserId: state?.assignTo ?? (null as string | null),
      // Empty string means "use the effective Workflow's default status".
      workflowStatusId: state?.workflowStatusId ?? "",
      // Null means "use the default Team" (preset → first of your teams →
      // first team). There is no "No team" choice in the picker.
      teamId: state?.teamId ?? (null as string | null),
      priority: state?.priority ?? ("no_priority" as TaskPriority),
      estimate: state?.estimate ?? ("no_estimate" as TaskEstimate),
      labels: state?.labelIds ?? ([] as readonly string[]),
      // Due Date is never auto-set; it stays empty until picked.
      // Baseline remains `dueDate: null as string | null`; comment-derived
      // task creation may explicitly prefill it from the source Task.
      dueDate: state?.dueDate ?? (null as string | null),
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(CreateTaskSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!activeChurch || !currentUserId || !churchId) return;

      const trimmedTitle = value.title.trim();
      if (!trimmedTitle) {
        setError("Enter a Task title.");
        return;
      }

      const submitTeamId = resolveTeamId(value.teamId);
      if (!submitTeamId) {
        setError("Select a Team.");
        return;
      }

      const submitWorkflowId = resolveWorkflowId(submitTeamId);
      const submitStatus = resolveStatus(value.workflowStatusId, submitWorkflowId);
      if (!submitStatus) {
        setError("Task could not find a To Do Workflow Status.");
        return;
      }

      const trimmedDescription = value.description.trim();
      setError(null);
      const result = await createTask({
        churchId,
        actorUserId: currentUserId,
        title: trimmedTitle,
        description: trimmedDescription === "" ? null : trimmedDescription,
        teamId: submitTeamId,
        assignedUserId: value.assignedUserId,
        workflowStatusId: submitStatus.id,
        dueDate: value.dueDate,
        parentTaskId: state?.parentTaskId ?? null,
        labelIds: [...value.labels],
        estimate: value.estimate === "no_estimate" ? null : value.estimate,
        priority: value.priority === "no_priority" ? null : value.priority,
        ...(effectiveTargetCycle ? { targetCycle: effectiveTargetCycle } : {}),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      // Task links carry the Task Identifier, not the database id (ADR 0013).
      const createdTaskIdentifier = result.data.tasks[0]?.identifier;
      const mode = submitModeRef.current;
      submitModeRef.current = "default";

      if (mode === "open" && createdTaskIdentifier) {
        formApi.reset();
        setState(null);
        const url = openTaskDetailsPaneUrl({ id: createdTaskIdentifier });
        void navigate({ to: url.to, search: url.search });
        return;
      }

      if (createMore) {
        // Keep the dialog open with every property as-is; only the text
        // resets, ready for the next Task in the batch.
        formApi.setFieldValue("title", "");
        formApi.setFieldValue("description", "");
        titleInputRef.current?.focus();
      } else {
        formApi.reset();
        setState(null);
      }

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

  // --- Effective Team / Workflow / Status resolution -------------------------
  // Pills hold "user-set" values; the effective value falls back through the
  // preset and the default Team so the dialog is valid the moment it opens.

  const resolveTeamId = (chosenTeamId: string | null): string | null => {
    if (chosenTeamId && teams.some((team) => team.id === chosenTeamId)) return chosenTeamId;
    if (state?.teamId && teams.some((team) => team.id === state.teamId)) return state.teamId;
    const yourTeam = teams.find((team) => memberTeamIds.has(team.id));
    return yourTeam?.id ?? teams[0]?.id ?? null;
  };

  const resolveWorkflowId = (teamId: string | null): string | null => {
    return (
      workflows.workflowsCollection.find(
        (workflow) => workflow.teamId === teamId && workflow.archivedAt === null,
      )?.id ?? null
    );
  };

  const resolveStatus = (chosenStatusId: string, workflowId: string | null) => {
    const inWorkflow = workflowStatuses.filter((status) => status.workflowId === workflowId);
    return (
      inWorkflow.find((status) => status.id === chosenStatusId) ??
      [...inWorkflow]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .find((status) => status.taskState === "todo") ??
      inWorkflow[0]
    );
  };

  const close = () => {
    setState(null);
    setError(null);
    form.reset();
  };

  useEffect(() => {
    if (!isOpen || !state) return;
    form.setFieldValue("title", state.title ?? "");
    form.setFieldValue("description", state.description ?? "");
    form.setFieldValue("assignedUserId", state.assignTo ?? null);
    form.setFieldValue("workflowStatusId", state.workflowStatusId ?? "");
    form.setFieldValue("teamId", state.teamId ?? null);
    form.setFieldValue("priority", state.priority ?? "no_priority");
    form.setFieldValue("estimate", state.estimate ?? "no_estimate");
    form.setFieldValue("labels", state.labelIds ?? []);
    form.setFieldValue("dueDate", state.dueDate ?? null);
  }, [isOpen, state, form]);

  // Inline label creation from the picker. Always creates a Church-scoped
  // Label (see CONTEXT.md "Label"); on success the new Label joins the
  // selection.
  const handleCreateLabel = async (name: string) => {
    if (!churchId) return;
    const result = await createLabel({ churchId, name });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const normalized = name.trim().toLowerCase();
    const created = result.data.labels.find(
      (label) => label.teamId === null && label.name.trim().toLowerCase() === normalized,
    );
    if (created) {
      form.setFieldValue("labels", [...form.state.values.labels, created.id]);
    }
  };

  const submit = (mode: "default" | "open") => {
    submitModeRef.current = mode;
    void form.handleSubmit();
  };

  // Cmd+Enter creates; Cmd+Alt+Enter creates and opens. Property picker keys are
  // handled by the shared hover-armed draft Task surface below.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitModeRef.current = event.altKey ? "open" : "default";
        void form.handleSubmit();
        return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, form]);

  return (
    <QuickActionsWrapper
      // Expand grows the dialog to its full available height (same width):
      // the wrapper already caps height via the viewport clamp, so expanding
      // just fills that cap instead of sizing to content.
      dialogContentClassName={
        expanded ? "h-[calc(100vh-clamp(16px,calc((100vh-512px)/2),192px)*2)]" : undefined
      }
      open={isOpen}
      onOpenChange={(open) => (open ? undefined : close())}
    >
      <QuickActionsHeader className="p-4">
        <div className="flex items-center justify-between gap-2">
          <QuickActionsTitle>
            <span className="flex items-center gap-1.5 font-normal text-sm">
              <form.Subscribe selector={(formState) => formState.values.teamId}>
                {(teamId) => {
                  const effectiveTeamId = resolveTeamId(teamId);
                  const effectiveTeam = teams.find((team) => team.id === effectiveTeamId);
                  return effectiveTeam ? (
                    <TeamComboboxSelector
                      disabled={isLoading}
                      memberTeamIds={memberTeamIds}
                      openRef={teamOpenRef}
                      onValueChange={(next) => {
                        form.setFieldValue("teamId", next);
                        // The new Team's Workflow takes over: the status pill
                        // resets to that Workflow's default.
                        form.setFieldValue("workflowStatusId", "");
                        // Team Labels foreign to the destination Team drop out
                        // of the selection (see CONTEXT.md "Team Label").
                        const applicable = new Set(
                          labelsCollection.labelsCollection
                            .filter((label) => label.teamId === null || label.teamId === next)
                            .map((label) => label.id),
                        );
                        form.setFieldValue(
                          "labels",
                          form.state.values.labels.filter((labelId) => applicable.has(labelId)),
                        );
                      }}
                      options={teamPickerOptions}
                      trigger={
                        <TaskPropertyPill className="gap-2">
                          <TeamAvatar
                            color={effectiveTeam.color}
                            name={effectiveTeam.name}
                            size={18}
                          />
                          <span className="max-w-32 truncate">{effectiveTeam.name}</span>
                        </TaskPropertyPill>
                      }
                      value={effectiveTeamId}
                    />
                  ) : null;
                }}
              </form.Subscribe>
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <span>{isCreatingSubtask ? "New Subtask" : "New Task"}</span>
              {state?.parentTaskLabel ? (
                <ParentTaskPill parentTaskLabel={state.parentTaskLabel} />
              ) : null}
              {effectiveTargetCycle ? <TargetWeekPill targetCycle={effectiveTargetCycle} /> : null}
            </span>
          </QuickActionsTitle>
          <div className="flex items-center gap-1">
            <Button
              aria-label={expanded ? "Collapse" : "Expand"}
              className="hidden text-muted-foreground md:inline-flex"
              onClick={() => setExpanded(!expanded)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              aria-label="Close"
              className="text-muted-foreground"
              onClick={close}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </QuickActionsHeader>
      <QuickActionForm
        form={form}
        Body={
          // The body never scrolls: the title is always visible and the
          // description textarea grows with its content, then scrolls
          // internally once it runs out of room.
          <DraftTaskPropertySurface
            className="relative flex min-h-0 flex-col gap-2 overflow-hidden p-4"
            pickerRefs={pickerRefs}
          >
            <form.Field name="title">
              {(field) => (
                <input
                  aria-label="Task title"
                  autoComplete="off"
                  autoFocus
                  className="w-full shrink-0 bg-transparent font-medium text-lg outline-none placeholder:text-muted-foreground"
                  data-1p-ignore="true"
                  disabled={isLoading}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter moves on to the description (Cmd+Enter submits).
                    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                      event.preventDefault();
                      descriptionInputRef.current?.focus();
                    }
                  }}
                  placeholder="Task title"
                  ref={titleInputRef}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <textarea
                  aria-label="Add description"
                  autoComplete="off"
                  // field-sizing-content grows the textarea with what's typed;
                  // flex-1 caps it at the available dialog height (the whole
                  // height when expanded), after which it scrolls internally.
                  className="field-sizing-content min-h-20 w-full flex-1 resize-none overflow-y-auto bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  data-1p-ignore="true"
                  disabled={isLoading}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Add description..."
                  ref={descriptionInputRef}
                  rows={4}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </DraftTaskPropertySurface>
        }
        Pinned={
          // The property pill row stays visible above the footer while the
          // title/description body scrolls (Linear behavior).
          <div className="flex flex-col gap-3 px-4 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <form.Subscribe
                selector={(formState) =>
                  [formState.values.teamId, formState.values.workflowStatusId] as const
                }
              >
                {([teamId, workflowStatusId]) => {
                  const effectiveWorkflowId = resolveWorkflowId(resolveTeamId(teamId));
                  const options = statusOptions(
                    workflowStatuses.filter((status) => status.workflowId === effectiveWorkflowId),
                  );
                  const effectiveStatus = resolveStatus(workflowStatusId, effectiveWorkflowId);
                  return (
                    <StatusComboboxSelector
                      disabled={isLoading || options.length === 0}
                      emptyText="No statuses."
                      onValueChange={(next) => {
                        if (next) form.setFieldValue("workflowStatusId", next);
                      }}
                      openRef={statusOpenRef}
                      options={options}
                      trigger={<TaskStatusPillTrigger status={effectiveStatus} />}
                      value={effectiveStatus?.id ?? null}
                    />
                  );
                }}
              </form.Subscribe>
              <form.Field name="priority">
                {(field) => {
                  return (
                    <PriorityComboboxSelector
                      disabled={isLoading}
                      onValueChange={(next) => field.handleChange(next)}
                      openRef={priorityOpenRef}
                      trigger={<TaskPriorityPillTrigger value={field.state.value} />}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>
              <form.Subscribe
                selector={(formState) =>
                  [formState.values.teamId, formState.values.assignedUserId] as const
                }
              >
                {([teamId, assignedUserId]) => {
                  const selectedAssignee =
                    assigneeOptions.find((option) => option.id === assignedUserId) ?? null;
                  const effectiveTeamId = resolveTeamId(teamId);
                  // Members of the effective Team feed the picker's
                  // "Team members" section.
                  const teamMemberUserIds = new Set(
                    teamMemberships.teamMembershipsCollection
                      .filter((membership) => membership.teamId === effectiveTeamId)
                      .map((membership) => membership.userId),
                  );
                  return (
                    <AssigneeComboboxSelector
                      align="start"
                      currentUserId={currentUserId}
                      disabled={isLoading || areUsersLoading}
                      onValueChange={(next) => form.setFieldValue("assignedUserId", next)}
                      openRef={assigneeOpenRef}
                      options={assigneeOptions}
                      teamMemberIds={teamMemberUserIds}
                      trigger={<TaskAssigneePillTrigger assignee={selectedAssignee} />}
                      value={assignedUserId}
                    />
                  );
                }}
              </form.Subscribe>
              <form.Field name="estimate">
                {(field) => {
                  return (
                    <EstimateComboboxSelector
                      disabled={isLoading}
                      onValueChange={(next) => field.handleChange(next)}
                      openRef={estimateOpenRef}
                      trigger={<TaskEstimatePillTrigger value={field.state.value} />}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>
              <form.Subscribe
                selector={(formState) =>
                  [formState.values.teamId, formState.values.labels] as const
                }
              >
                {([teamId, labels]) => {
                  const effectiveTeamId = resolveTeamId(teamId);
                  // Church Labels plus the effective Team's Labels are
                  // applicable (see CONTEXT.md "Team Label").
                  const labelOptions = labelsCollection.labelsCollection.filter(
                    (label) => label.teamId === null || label.teamId === effectiveTeamId,
                  );
                  const selected = labels
                    .map((labelId) => labelOptions.find((option) => option.id === labelId))
                    .filter((option) => option !== undefined);
                  return (
                    <LabelsComboboxSelector
                      disabled={isLoading || areLabelsLoading}
                      onCreateLabel={(name) => void handleCreateLabel(name)}
                      onValueChange={(next) => form.setFieldValue("labels", next)}
                      openRef={labelsOpenRef}
                      options={labelOptions}
                      trigger={<TaskLabelsPillTrigger labels={selected} />}
                      value={labels}
                    />
                  );
                }}
              </form.Subscribe>
              <form.Field name="dueDate">
                {(field) => {
                  return (
                    <DueDateSelector
                      disabled={isLoading}
                      onValueChange={(next) => field.handleChange(next)}
                      openRef={dueDateOpenRef}
                      trigger={<TaskDueDatePillTrigger value={field.state.value} />}
                      value={field.state.value}
                    />
                  );
                }}
              </form.Field>
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        }
        Actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 ps-2 text-muted-foreground text-sm">
              <Switch checked={createMore} onCheckedChange={setCreateMore} size="sm" />
              Create more
            </label>
            <form.Subscribe selector={(formState) => formState.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  className="ml-auto"
                  disabled={isLoading}
                  loading={isSubmitting}
                  onClick={(event) => {
                    event.preventDefault();
                    submit("default");
                  }}
                  type="submit"
                >
                  {isCreatingSubtask ? "Create Subtask" : "Create Task"}
                  <Kbd>mod enter</Kbd>
                </Button>
              )}
            </form.Subscribe>
          </>
        }
      />
    </QuickActionsWrapper>
  );
}
