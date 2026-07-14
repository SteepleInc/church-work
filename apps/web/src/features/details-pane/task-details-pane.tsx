import { CalendarIcon, ChevronRight, Tag, Triangle } from "lucide-react";
import type { Value } from "platejs";
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { toast } from "sonner";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateLabelMutation, useLabelsCollection } from "@/data/labels/labelsData.app";
import { buildWeekPickerOptions, useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useTaskByIdentifier } from "@/data/tasks/taskData.app";
import {
  useCancelTaskMutation,
  useCompleteTaskMutation,
  useCreateTaskMutation,
  useDuplicateTaskMutation,
  useMaterializeProjectedTemplateTaskMutation,
  useReopenTaskMutation,
  useTasksCollection,
  useUpdateTaskMutation,
  type TaskCollectionItem,
} from "@/data/tasks/tasksData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import {
  useWorkflowsCollection,
  useWorkflowStatusesCollection,
} from "@/data/workflows/workflowsData.app";
import { MentionedInSection } from "@/features/details-pane/mentioned-in-section";
import { SubTaskSection } from "@/features/details-pane/sub-task-section";
import { isSubTaskRowArmed } from "@/features/details-pane/sub-task-row-shortcuts";
import type { SubTaskCreateInput } from "@/features/details-pane/sub-task-creator";
import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { useChangeDetailsPaneId } from "@/components/details-pane/details-pane-helpers";
import {
  DescriptionEditor,
  type DescriptionEditorHandle,
} from "@/components/editor/description-editor";
import {
  parseDescriptionValue,
  serializeDescriptionValue,
} from "@/components/editor/description-value";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import { notifyTaskDuplicated, useTaskCreationGate } from "@/features/billing/task-creation-gate";
import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  formatDueDate,
  getEstimateMeta,
  getPriorityMeta,
  labelDotClassName,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  StatusComboboxSelector,
  TeamComboboxSelector,
  WeekComboboxSelector,
  WorkflowStatusIcon,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { isEditableTarget, statusOptions } from "@/components/tasks/task-kanban-board-utils";
import { TaskContextMenu, type TaskStateTransition } from "@/components/tasks/task-context-menu";
import { TaskFieldProvider } from "@/components/tasks/task-field-context";
import { LabelHoverCard } from "@/components/tasks/task-label-hover-card";
import type { TaskBoardTask } from "@/components/tasks/task-kanban-adapter";
import { resolveTaskFieldShortcut } from "@/components/tasks/task-surface-keyboard-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TaskActivityFeed } from "./task-activity-feed";

/**
 * Linear-style property pill used in the Task pane's fixed property band. The
 * trigger lives inside a picker, so the pill itself is purely presentational.
 * Borderless by default (Linear treats property chips as quiet ghost buttons),
 * tinted via `border` only when a value is set and we want it to read as active.
 */
const FieldPill = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<"span"> & {
    readonly muted?: boolean;
    readonly bordered?: boolean;
  }
>(function FieldPill({ children, muted = false, bordered = false, className, ...rest }, ref) {
  // Spreads `rest` and forwards `ref` so base-ui's `<TooltipTrigger render>` can
  // attach its hover wiring (event handlers, `data-slot`, `aria-*`) to the real
  // span — without this the field tooltips never mount (the trigger props would
  // be silently dropped by an opaque component).
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-2 font-medium text-[13px] transition-colors hover:bg-accent",
        bordered ? "border" : "border border-transparent",
        muted && "text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
});

/** Small rounded-square avatar for the breadcrumb (matches the org switcher). */
function BreadcrumbOrgAvatar({ name }: { readonly name: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-[10px] text-primary-foreground">
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </span>
  );
}

export function TaskDetailsPane({ identifier }: { readonly identifier: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const { taskOpt: task, loading: taskLoading } = useTaskByIdentifier({
    churchId,
    identifier,
  });
  const teams = useTeamsCollection({ churchId });
  const teamMemberships = useTeamMembershipsCollection({ churchId });
  const users = useChurchUsersCollection({ churchId });
  const workflows = useWorkflowsCollection({ churchId });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId });
  const labels = useLabelsCollection({ churchId });
  const allTasks = useTasksCollection({ churchId, currentUserId: null });
  const cycles = useCyclesCollection({ churchId, currentUserId });
  const updateTask = useUpdateTaskMutation();
  const createTask = useCreateTaskMutation();
  const duplicateTask = useDuplicateTaskMutation();
  const createLabel = useCreateLabelMutation();
  const materializeProjectedTask = useMaterializeProjectedTemplateTaskMutation();
  const completeTask = useCompleteTaskMutation();
  const cancelTask = useCancelTaskMutation();
  const reopenTask = useReopenTaskMutation();
  const { openCreateTask } = useQuickActionOpeners();
  const taskCreationGate = useTaskCreationGate();

  const team = teams.teamsCollection.find((candidate) => candidate.id === task?.teamId) ?? null;
  const loading = orgLoading || taskLoading;
  const changeDetailsPaneId = useChangeDetailsPaneId();
  const canonicalIdentifier = task?.identifier ?? null;
  const churchName = activeChurch?.name ?? "Church";

  // Locally-buffered title, committed to the Task on blur (Linear behavior).
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  // Locally-buffered description value. Plate is uncontrolled (it reads `value`
  // only on mount), so we mirror the latest editor value in a ref and commit it
  // to the Task on blur — same commit-on-blur model as the title.
  const descriptionDraftRef = useRef<Value | null>(null);
  // The title and description read as one surface (Linear): arrowing down past
  // the title drops into the description at its top, and arrowing up from the
  // top of the description returns to the end of the title.
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionFocusRef = useRef<DescriptionEditorHandle>(null);
  const focusDescriptionStart = () => descriptionFocusRef.current?.focusStart();
  const focusTitleEnd = () => {
    const input = titleRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };
  useEffect(() => {
    setTitleDraft(null);
    descriptionDraftRef.current = null;
  }, [canonicalIdentifier]);

  // Picker openers for pane-level keyboard shortcuts (S/P/A/L/⇧E/D/T). Each
  // picker populates its ref with an open callback (same pattern as the Task
  // card's hover shortcuts); here they are always live while the pane is open.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);
  const teamOpenRef = useRef<(() => void) | null>(null);

  const pickerOpenRefs = useMemo(
    () => ({
      status: statusOpenRef,
      priority: priorityOpenRef,
      assignee: assigneeOpenRef,
      labels: labelsOpenRef,
      estimate: estimateOpenRef,
      dueDate: dueDateOpenRef,
      team: teamOpenRef,
    }),
    [],
  );

  // While the pane is open the field shortcuts are always live (no hover gate,
  // unlike the board cards). A capture-phase listener runs before the board's
  // surface-keyboard handler so an open pane wins even when a card behind it is
  // still focused. Typing in the title/description is left untouched.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      // Defer to a hovered sub-task row: the same field keys edit that row, not
      // the parent Task, while the pointer is over it (see sub-task-row-shortcuts).
      if (isSubTaskRowArmed()) return;
      const intent = resolveTaskFieldShortcut(event);
      if (intent.kind !== "field") return;
      const opener = pickerOpenRefs[intent.field]?.current;
      if (!opener) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opener();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [pickerOpenRefs]);

  // URL normalization (ADR 0013): a lowercase or retired identifier resolves,
  // then the URL state is rewritten to the canonical current uppercase
  // identifier so the address bar always shows the canonical reference.
  useEffect(() => {
    if (canonicalIdentifier !== null && canonicalIdentifier !== identifier) {
      changeDetailsPaneId(canonicalIdentifier).forceNav();
    }
  }, [canonicalIdentifier, changeDetailsPaneId, identifier]);

  if (!task) {
    return (
      <DetailsShell
        topBarButtons={<TaskBreadcrumb churchName={churchName} identifier={identifier} title="" />}
        headerBand={
          loading ? (
            <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-7 w-24 rounded-md" key={index} />
              ))}
            </div>
          ) : undefined
        }
        content={
          loading ? (
            <TaskDetailsSkeleton />
          ) : (
            // Graceful not-found pane state for unknown identifiers (ADR 0013).
            <p className="text-muted-foreground text-sm">
              No Task matches {identifier} in this Church.
            </p>
          )
        }
      />
    );
  }

  const statusItems = statusOptions(
    workflowStatuses.workflowStatusesCollection.filter(
      (status) => status.workflowId === task.workflowId,
    ),
  );
  const workflowStatus = workflowStatuses.workflowStatusesCollection.find(
    (candidate) => candidate.id === task.workflowStatusId,
  );

  const assigneeOptions = users.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const teamMemberIds = new Set(
    teamMemberships.teamMembershipsCollection
      .filter((membership) => membership.teamId === task.teamId)
      .map((membership) => membership.userId),
  );

  // Team picker data: every Church Team is selectable; the current user's
  // Teams are sectioned first ("Your teams") in the picker.
  const teamPickerOptions = teams.teamsCollection.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    color: (candidate.color ?? null) as string | null,
  }));
  const memberTeamIds = new Set(
    teamMemberships.teamMembershipsCollection
      .filter((membership) => membership.userId === currentUserId)
      .map((membership) => membership.teamId),
  );

  // Church Labels plus the Task's Team's Labels are applicable here
  // (see CONTEXT.md "Team Label").
  const applicableLabels = labels.labelsCollection.filter(
    (label) => label.teamId === null || label.teamId === task.teamId,
  );
  const taskLabels = (task.labelIds ?? [])
    .map((labelId) => labels.labelsCollection.find((label) => label.id === labelId))
    .filter((label) => label !== undefined);

  const estimateMeta = getEstimateMeta(task.estimate ?? "no_estimate");
  // Priority is persisted on the Task (DB → Zero → mutator); read it straight
  // off the Task and write through the same `persist` path as the other fields.
  const priority = (task.priority ?? "no_priority") as TaskPriority;
  const priorityMeta = getPriorityMeta(priority);
  const PriorityIcon = priorityMeta.icon;
  const dueDateLabel = formatDueDate(task.dueDate);
  const cardState = task.taskState;

  const parentTask = task.parentTaskId
    ? (allTasks.tasksCollection.find((candidate) => candidate.id === task.parentTaskId) ?? null)
    : null;

  const persist = (fields: Parameters<typeof updateTask>[0]["fields"]) => {
    if (!activeChurch || task.isProjected) return;
    void updateTask({
      taskId: task.id,
      fields,
    });
  };

  const transitionTask = (taskId: string, transition: TaskStateTransition) => {
    if (!activeChurch) return;

    let mutate: typeof completeTask;
    switch (transition) {
      case "complete":
        mutate = completeTask;
        break;
      case "cancel":
        mutate = cancelTask;
        break;
      case "reopen":
        mutate = reopenTask;
        break;
    }

    void mutate({ taskId });
  };

  const toMenuTask = (entry: TaskCollectionItem): TaskBoardTask => ({
    id: entry.id,
    identifier: entry.identifier,
    title: entry.title,
    description: entry.description,
    workflowId: entry.workflowId,
    workflowStatusId: entry.workflowStatusId,
    taskState: entry.taskState,
    boardOrder: entry.boardOrder,
    teamId: entry.teamId,
    assignedUserId: entry.assignedUserId,
    dueDate: entry.dueDate,
    estimate: entry.estimate,
    priority: entry.priority,
    createdAt: entry.createdAt,
    labelIds: entry.labelIds,
    isProjected: entry.isProjected,
    isAdjusted: entry.isAdjusted,
    sourceBadge: entry.sourceBadge,
  });

  const titleValue = titleDraft ?? task.title;

  // --- Sub-task section data + handlers --------------------------------------

  const churchTimeZone = activeChurch?.churchTimeZone ?? null;

  const weekLabelByCycleId = new Map(
    cycles.cyclesCollection.map((cycle) => [cycle.id, cycle.displayName] as const),
  );
  const today = new Date().toISOString().slice(0, 10);
  const weekOptions = buildWeekPickerOptions(cycles.cyclesCollection, today);
  const taskCycleLabel = task.cycleId ? (weekLabelByCycleId.get(task.cycleId) ?? null) : null;

  // The destination Team's default To Do status for a new sub-task. Sub-tasks
  // never inherit the parent's Workflow Status (grilling decision).
  const resolveDefaultStatusId = (teamId: string): string | null => {
    const workflow = workflows.workflowsCollection.find(
      (candidate) => candidate.teamId === teamId && candidate.archivedAt === null,
    );
    if (!workflow) return null;
    const inWorkflow = workflowStatuses.workflowStatusesCollection.filter(
      (status) => status.workflowId === workflow.id && status.archivedAt === null,
    );
    return (
      [...inWorkflow]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .find((status) => status.taskState === "todo")?.id ??
      inWorkflow[0]?.id ??
      null
    );
  };

  // Build a `targetCycle` from an existing Cycle so the sub-task lands in the
  // same Week as its parent. The create mutator resolves an existing Cycle by
  // start_date, so this attaches to the parent's Cycle rather than duplicating.
  const targetCycleForCycleId = (cycleId: string | null) => {
    if (!cycleId || !churchTimeZone) return undefined;
    const cycle = cycles.cyclesCollection.find((candidate) => candidate.id === cycleId);
    if (!cycle) return undefined;
    return {
      churchTimeZone,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      startsAt: new Date(cycle.startsAt).toISOString(),
      endsAt: new Date(cycle.endsAt).toISOString(),
    };
  };

  const createOneSubTask = async (
    parent: TaskCollectionItem,
    input: SubTaskCreateInput,
  ): Promise<boolean> => {
    if (!activeChurch || !currentUserId) return false;
    const statusId = resolveDefaultStatusId(input.teamId);
    if (!statusId) {
      toast.error("Could not find a To Do Workflow Status for that Team.");
      return false;
    }
    const result = await createTask({
      title: input.title,
      description: input.description,
      teamId: input.teamId,
      assignedUserId: input.assignedUserId,
      workflowStatusId: statusId,
      dueDate: input.dueDate,
      parentTaskId: parent.id,
      labelIds: input.labelIds,
      estimate: input.estimate === "no_estimate" ? null : input.estimate,
      priority: input.priority === "no_priority" ? null : input.priority,
      ...(targetCycleForCycleId(parent.cycleId)
        ? { targetCycle: targetCycleForCycleId(parent.cycleId) }
        : {}),
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    return true;
  };

  // A projected parent has no real identity yet; materialize it first, then the
  // pane normalizes to the real Task and creation continues (ADR 0017).
  const ensureRealParent = async (): Promise<TaskCollectionItem | null> => {
    if (!task.isProjected) return task;
    const statusId = resolveDefaultStatusId(task.teamId);
    if (!statusId) {
      toast.error("Could not find a To Do Workflow Status for that Team.");
      return null;
    }
    const result = await materializeProjectedTask({ task, workflowStatusId: statusId });
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    // The materialized Task replaces the projection; re-resolve it by source.
    const real = allTasks.tasksCollection.find(
      (candidate) =>
        !candidate.isProjected &&
        candidate.sourceTemplateTaskId === task.sourceTemplateTaskId &&
        candidate.cycleId === task.cycleId,
    );
    if (real) changeDetailsPaneId(real.identifier).forceNav();
    return real ?? null;
  };

  const handleCreateSubTask = async (input: SubTaskCreateInput): Promise<boolean> => {
    const parent = await ensureRealParent();
    if (!parent) return false;
    return createOneSubTask(parent, input);
  };

  const handleCreateSubTasks = async (inputs: readonly SubTaskCreateInput[]): Promise<boolean> => {
    const parent = await ensureRealParent();
    if (!parent) return false;
    let allOk = true;
    for (const input of inputs) {
      const ok = await createOneSubTask(parent, input);
      if (!ok) allOk = false;
    }
    return allOk;
  };

  const handleEditSubTask = (
    subTaskId: string,
    fields: Parameters<typeof updateTask>[0]["fields"],
  ) => {
    if (!activeChurch) return;
    void updateTask({
      taskId: subTaskId,
      fields,
    });
  };

  const handleCreateSubTaskLabel = async (name: string): Promise<string | null> => {
    if (!activeChurch) return null;
    const result = await createLabel({ name });
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    return result.data.labels[0]?.id ?? null;
  };

  return (
    // The app shell wraps everything in a `delay={0}` tooltip provider (for the
    // collapsed-sidebar tooltips), so re-establish the default 304ms field-tooltip
    // delay here — matching the board/list surfaces — for the Task pane.
    <TooltipProvider>
      <DetailsShell
        topBarButtons={
          <TaskBreadcrumb churchName={churchName} identifier={task.identifier} title={task.title} />
        }
        headerBand={
          <TaskContextMenu
            assigneeOptions={assigneeOptions}
            buildTaskUrl={(taskIdentifier) =>
              `${window.location.origin}${window.location.pathname}?details-pane=${encodeURIComponent(JSON.stringify([{ type: "task", id: taskIdentifier }]))}`
            }
            currentUserId={currentUserId}
            labelOptions={labels.labelsCollection}
            memberTeamIds={memberTeamIds}
            duplicateDisabledReason={
              taskCreationGate.blocked ? taskCreationGate.message : undefined
            }
            onAssignTask={(change) => persist({ assignedUserId: change.assignedUserId })}
            onChangeTaskDueDate={(change) => persist({ dueDate: change.dueDate })}
            onChangeTaskEstimate={(change) => persist({ estimate: change.estimate })}
            onChangeTaskLabels={(change) => persist({ labelIds: change.labelIds })}
            onChangeTaskStatus={(change) => persist({ workflowStatusId: change.workflowStatusId })}
            onChangeTaskTeam={(change) =>
              persist({ teamId: change.teamId, labelIds: change.labelIds })
            }
            onOpenTask={(taskIdentifier) => changeDetailsPaneId(taskIdentifier).forceNav()}
            onDuplicateTask={async (taskId) => {
              if (taskCreationGate.blocked) {
                taskCreationGate.notify();
                return;
              }
              const result = await duplicateTask({ taskId });
              notifyTaskDuplicated(result, task.title);
            }}
            onTransitionTask={(change) => transitionTask(change.taskId, change.transition)}
            rowState={cardState}
            targetTaskIds={[task.id]}
            task={toMenuTask(task)}
            teamMemberIdsByTeamId={new Map([[task.teamId, teamMemberIds]])}
            teamOptions={teamPickerOptions}
            workflowStatuses={workflowStatuses.workflowStatusesCollection}
          >
            <TaskFieldProvider taskId={task.id}>
              <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
                <StatusComboboxSelector
                  disabled={statusItems.length === 0 || task.isProjected}
                  emptyText="No statuses."
                  onValueChange={(next) => {
                    if (next) persist({ workflowStatusId: next });
                  }}
                  openRef={statusOpenRef}
                  options={statusItems}
                  trigger={
                    <FieldPill bordered>
                      <WorkflowStatusIcon className="size-3.5" taskState={cardState} />
                      {workflowStatus?.name ?? "Status"}
                    </FieldPill>
                  }
                  triggerTestId="task-details-status-trigger"
                  value={task.workflowStatusId}
                />

                <PriorityComboboxSelector
                  disabled={task.isProjected}
                  onValueChange={(next) =>
                    persist({ priority: next === "no_priority" ? null : next })
                  }
                  openRef={priorityOpenRef}
                  trigger={
                    <FieldPill bordered muted={priority === "no_priority"}>
                      <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
                      {priority === "no_priority" ? "Priority" : priorityMeta.label}
                    </FieldPill>
                  }
                  value={priority}
                />

                <AssigneeComboboxSelector
                  align="start"
                  currentUserId={currentUserId}
                  disabled={task.isProjected}
                  onValueChange={(next) => persist({ assignedUserId: next })}
                  openRef={assigneeOpenRef}
                  options={assigneeOptions}
                  teamMemberIds={teamMemberIds}
                  trigger={
                    <FieldPill bordered muted={selectedAssignee === null}>
                      <AssigneeAvatar assignee={selectedAssignee} size={16} />
                      {selectedAssignee?.label ?? "Assignee"}
                    </FieldPill>
                  }
                  value={task.assignedUserId}
                />

                <LabelsComboboxSelector
                  disabled={task.isProjected}
                  onValueChange={(next) => persist({ labelIds: [...next] })}
                  openRef={labelsOpenRef}
                  options={applicableLabels}
                  trigger={
                    // With exactly one Label the pill carries that Label's rich
                    // hover card (resolved from its id); the empty pill keeps the
                    // selector's "Add labels" action tooltip, and the merged
                    // "N labels" summary has no single Label to describe.
                    taskLabels.length === 1 && taskLabels[0] ? (
                      <LabelHoverCard labelId={taskLabels[0].id}>
                        <FieldPill bordered>
                          <span className="-space-x-1 flex items-center">
                            <span
                              className={cn(
                                "size-2.5 rounded-full ring-2 ring-background",
                                labelDotClassName(taskLabels[0]),
                              )}
                            />
                          </span>
                          <span className="truncate">{taskLabels[0].name}</span>
                        </FieldPill>
                      </LabelHoverCard>
                    ) : (
                      <FieldPill bordered muted={taskLabels.length === 0}>
                        {taskLabels.length === 0 ? (
                          <>
                            <Tag className="size-3.5" />
                            Labels
                          </>
                        ) : (
                          <>
                            <span className="-space-x-1 flex items-center">
                              {taskLabels.map((label) => (
                                <span
                                  className={cn(
                                    "size-2.5 rounded-full ring-2 ring-background",
                                    labelDotClassName(label),
                                  )}
                                  key={label.id}
                                />
                              ))}
                            </span>
                            <span className="truncate">{`${taskLabels.length} labels`}</span>
                          </>
                        )}
                      </FieldPill>
                    )
                  }
                  triggerTestId="task-details-labels-trigger"
                  value={task.labelIds ?? []}
                />

                <EstimateComboboxSelector
                  disabled={task.isProjected}
                  onValueChange={(next) =>
                    persist({ estimate: next === "no_estimate" ? null : next })
                  }
                  openRef={estimateOpenRef}
                  trigger={
                    <FieldPill bordered muted={(task.estimate ?? "no_estimate") === "no_estimate"}>
                      <Triangle className="size-3.5" />
                      {task.estimate ? estimateMeta.label : "Estimate"}
                    </FieldPill>
                  }
                  value={(task.estimate ?? "no_estimate") as TaskEstimate}
                />

                <DueDateSelector
                  disabled={task.isProjected}
                  onValueChange={(next) => persist({ dueDate: next })}
                  openRef={dueDateOpenRef}
                  trigger={
                    <FieldPill bordered muted={dueDateLabel === null}>
                      <CalendarIcon className="size-3.5" />
                      {dueDateLabel ?? "Due date"}
                    </FieldPill>
                  }
                  value={task.dueDate}
                />

                <WeekComboboxSelector
                  churchId={churchId}
                  disabled={task.isProjected}
                  onValueChange={(next) => persist({ cycleId: next })}
                  options={weekOptions}
                  trigger={
                    <FieldPill bordered muted={taskCycleLabel === null}>
                      <CalendarIcon className="size-3.5" />
                      {taskCycleLabel ?? "No week"}
                    </FieldPill>
                  }
                  value={task.cycleId ?? null}
                />

                {team ? (
                  <TeamComboboxSelector
                    disabled={task.isProjected}
                    memberTeamIds={memberTeamIds}
                    // The destination Team's Workflow takes over server-side: the
                    // Task's Workflow Status resets to that Workflow's default and
                    // foreign Team Labels drop out (see tasks.update mutator).
                    onValueChange={(next) => persist({ teamId: next })}
                    openRef={teamOpenRef}
                    options={teamPickerOptions}
                    trigger={
                      <FieldPill bordered>
                        <TeamAvatar color={team.color} name={team.name} size={16} />
                        {team.name}
                      </FieldPill>
                    }
                    triggerTestId="task-details-team-trigger"
                    value={team.id}
                  />
                ) : null}
              </div>
            </TaskFieldProvider>
          </TaskContextMenu>
        }
        contentClassName="gap-6 pt-6"
        content={
          <>
            {/* Title */}
            <textarea
              aria-label="Task title"
              autoComplete="off"
              className="field-sizing-content w-full resize-none bg-transparent font-semibold text-2xl leading-tight tracking-tight outline-none placeholder:text-muted-foreground disabled:cursor-default"
              data-1p-ignore="true"
              disabled={task.isProjected}
              onBlur={() => {
                const next = titleValue.trim();
                if (next !== "" && next !== task.title) persist({ title: next });
                setTitleDraft(null);
              }}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                  return;
                }
                if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                const input = event.currentTarget;
                const { selectionStart, selectionEnd, value } = input;
                const collapsed = selectionStart === selectionEnd;
                const caretAtEnd = collapsed && selectionEnd === value.length;
                // The title and description read as one surface (Linear): drop
                // into the description on ArrowDown from the last line, or on
                // ArrowRight once the caret is at the very end of the title.
                const onLastLine = collapsed && !value.slice(selectionStart).includes("\n");
                if (event.key === "ArrowDown" && onLastLine) {
                  event.preventDefault();
                  focusDescriptionStart();
                } else if (event.key === "ArrowRight" && caretAtEnd) {
                  event.preventDefault();
                  focusDescriptionStart();
                }
              }}
              placeholder="Task title"
              ref={titleRef}
              rows={1}
              value={titleValue}
            />

            {/* Description — edit-in-place (Linear behavior): click anywhere and
              type. Plate is uncontrolled, so the latest value is buffered in a
              ref and committed to the Task on blur. Persisting `description`
              routes through the same mutator path that re-syncs the mention
              graph and logs the change. Projected Tasks are read-only until
              materialized (mirrors the title). */}
            {/* Inset the editable content so the `@` chip's focus ring (and the
              mention popover anchored to it) isn't clipped by the editor's left
              edge, then pull the container back by the same amount so the text
              still lines up with the title above. */}
            <DescriptionEditor
              key={task.id}
              readOnly={task.isProjected}
              ariaLabel="Task description"
              className="-mx-2 text-[15px] text-foreground/90 leading-relaxed"
              contentClassName="px-2"
              focusHandleRef={descriptionFocusRef}
              placeholder="Add a description..."
              value={parseDescriptionValue(task.description)}
              onEscapeStart={focusTitleEnd}
              onChange={(value) => {
                descriptionDraftRef.current = value;
              }}
              onBlur={() => {
                const draft = descriptionDraftRef.current;
                if (draft === null) return;
                const next = serializeDescriptionValue(draft);
                if (next !== (task.description ?? null)) persist({ description: next });
                descriptionDraftRef.current = null;
              }}
            />

            {/* Parent context */}
            {parentTask ? (
              <section className="grid gap-2">
                <h3 className="font-medium text-muted-foreground text-xs">Parent</h3>
                <button
                  className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-3 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => changeDetailsPaneId(parentTask.identifier).forceNav()}
                  type="button"
                >
                  <span className="shrink-0 font-medium text-muted-foreground text-xs">
                    {parentTask.identifier}
                  </span>
                  <span className="truncate">{parentTask.title}</span>
                </button>
              </section>
            ) : null}

            {/* Sub-tasks */}
            <SubTaskSection
              allTasks={allTasks.tasksCollection}
              assigneeOptions={assigneeOptions}
              currentUserId={currentUserId}
              defaultPriority={task.priority ?? "no_priority"}
              labels={labels.labelsCollection.map((label) => ({
                id: label.id,
                name: label.name,
                color: label.color,
                teamId: label.teamId,
              }))}
              onCreateLabel={handleCreateSubTaskLabel}
              onCreateSubTask={handleCreateSubTask}
              onCreateSubTasks={handleCreateSubTasks}
              onEditTask={handleEditSubTask}
              onOpenTask={(identifier) => changeDetailsPaneId(identifier).forceNav()}
              parentTask={task}
              teamMemberships={teamMemberships.teamMembershipsCollection.map((membership) => ({
                teamId: membership.teamId,
                userId: membership.userId,
              }))}
              teams={teams.teamsCollection.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                color: (candidate.color ?? null) as string | null,
              }))}
              weekLabelByCycleId={weekLabelByCycleId}
              workflowStatuses={workflowStatuses.workflowStatusesCollection.map((status) => ({
                id: status.id,
                workflowId: status.workflowId,
                name: status.name,
                sortOrder: status.sortOrder,
                taskState: status.taskState,
                archivedAt: status.archivedAt,
              }))}
            />

            {/* Mentioned-in backlinks: other Tasks that reference this one.
              Projected Tasks have no real id to be mentioned, so the section is
              only shown for real Tasks. */}
            {task.isProjected ? null : (
              <MentionedInSection
                churchId={churchId}
                onOpenTask={(identifier) => changeDetailsPaneId(identifier).forceNav()}
                taskId={task.id}
              />
            )}

            {/* Activity Feed (read-only history). Projected Tasks have no real
              Activity rows yet, so the feed is only shown for real Tasks. */}
            {task.isProjected ? null : (
              <TaskActivityFeed
                churchId={churchId}
                currentUserId={currentUserId}
                onCreateTaskFromComment={(prefill) => openCreateTask(prefill)}
                sourceTask={{
                  id: task.id,
                  identifier: task.identifier,
                  title: task.title,
                  assignedUserId: task.assignedUserId,
                  teamId: task.teamId,
                  priority: task.priority ?? "no_priority",
                  estimate: task.estimate ?? "no_estimate",
                  labelIds: task.labelIds,
                  dueDate: task.dueDate,
                }}
                taskEntityId={task.id}
              />
            )}
          </>
        }
      />
    </TooltipProvider>
  );
}

function TaskBreadcrumb({
  churchName,
  identifier,
  title,
}: {
  readonly churchName: string;
  readonly identifier: string;
  readonly title: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <BreadcrumbOrgAvatar name={churchName} />
      <span className="hidden shrink-0 text-muted-foreground sm:inline">
        {churchName.length > 6 ? `${churchName.slice(0, 6)}...` : churchName}
      </span>
      <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:inline" />
      <span className="shrink-0 font-medium text-muted-foreground">{identifier}</span>
      {title ? <span className="min-w-0 truncate text-foreground/80">{title}</span> : null}
    </div>
  );
}

function TaskDetailsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-3/4" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </>
  );
}
