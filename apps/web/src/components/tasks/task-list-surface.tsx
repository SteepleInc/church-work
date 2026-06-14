import { PlusIcon, Tag, Triangle } from "lucide-react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef } from "react";

import { useAppForm } from "@/components/form/ts-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  EstimateComboboxSelector,
  formatCreatedAt,
  formatDueDate,
  getEstimateMeta,
  getPriorityMeta,
  labelDotClassName,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  StatusComboboxSelector,
  WorkflowStatusIcon,
  type AssigneeOption,
  type TaskEstimate,
  type TaskPriority,
} from "./task-card-fields";
import {
  buildTaskBoardGroupColumns,
  groupTasksByColumn,
  type TaskBoardEstimate,
  type TaskBoardGroupColumn,
  type TaskBoardGrouping,
  type TaskBoardTask,
  type TaskBoardTaskState,
  type TaskBoardWorkflowStatus,
} from "./task-kanban-adapter";
import type {
  TaskBoardLabelOption,
  TaskBoardTeamOption,
  TaskCardAssignChange,
  TaskCardEstimateChange,
  TaskCardLabelsChange,
  TaskCardStatusChange,
} from "./task-kanban-board";
import { DEFAULT_TASK_VIEW_OPTIONS, type TaskDisplayProperty } from "./task-view-options";
import { statusOptions } from "./task-kanban-board-utils";
import {
  useRegisterSurfaceOrder,
  useRegisterTaskShortcuts,
  useTaskSurfaceKeyboard,
  type TaskShortcutField,
} from "./task-surface-keyboard";

type TaskListSurfaceProps = {
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly tasks: readonly TaskBoardTask[];
  readonly assigneeOptions?: readonly AssigneeOption[];
  readonly teamOptions?: readonly TaskBoardTeamOption[];
  readonly labelOptions?: readonly TaskBoardLabelOption[];
  readonly currentUserId?: string | null;
  readonly teamMemberIdsByTeamId?: ReadonlyMap<string, ReadonlySet<string>>;
  // View Options (URL-carried presentation settings).
  readonly grouping?: TaskBoardGrouping;
  readonly showEmptyColumns?: boolean;
  readonly displayProperties?: readonly TaskDisplayProperty[];
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onChangeTaskLabels?: (change: TaskCardLabelsChange) => void | Promise<void>;
  readonly onChangeTaskEstimate?: (change: TaskCardEstimateChange) => void | Promise<void>;
  readonly onOpenTask?: (taskIdentifier: string) => void;
  // The list shares the Board's per-group add affordance. The columnId means a
  // different field per grouping (Workflow Status id, User id, estimate, ...);
  // the caller interprets it the same way the Board does.
  readonly onAddTask?: (columnId: string) => void;
  readonly className?: string;
};

const EMPTY_TEAM_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map();
const EMPTY_USER_ID_SET: ReadonlySet<string> = new Set();

/**
 * The Linear-style List View presentation of a Saved View (see CONTEXT.md
 * "View Options"). It groups Tasks exactly like the Board (same
 * `buildTaskBoardGroupColumns` / `groupTasksByColumn`, all groupings), but lays
 * them out as a single vertical scroll of rows with sticky group headers that
 * pin to the top until the next group's header pushes them up.
 *
 * Ordering shares Board Order (`compareBoardOrder`, applied by
 * `groupTasksByColumn`); the list is read-only and does not drag-reorder. Rows
 * reuse the Board card's inline-interactive selectors and open the Details Pane
 * on click (ADR 0013 — Task links carry the Task Identifier).
 */
export function TaskListSurface({
  workflowStatuses,
  tasks,
  assigneeOptions = [],
  teamOptions = [],
  labelOptions = [],
  currentUserId = null,
  teamMemberIdsByTeamId = EMPTY_TEAM_MEMBERS,
  grouping = "workflow_status",
  showEmptyColumns = true,
  displayProperties = DEFAULT_TASK_VIEW_OPTIONS.displayProperties,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
  onAddTask,
  className,
}: TaskListSurfaceProps) {
  const columns = useMemo(
    () =>
      buildTaskBoardGroupColumns({
        grouping,
        workflowStatuses,
        assignees: assigneeOptions,
        teams: teamOptions,
        tasks,
        showEmptyColumns,
      }),
    [grouping, workflowStatuses, assigneeOptions, teamOptions, tasks, showEmptyColumns],
  );
  const tasksByColumn = useMemo(
    () => groupTasksByColumn(grouping, columns, tasks),
    [grouping, columns, tasks],
  );
  const displayPropertySet = useMemo(() => new Set(displayProperties), [displayProperties]);
  const teamsById = useMemo(
    () => new Map(teamOptions.map((team) => [team.id, team])),
    [teamOptions],
  );

  // Report the flat, top-to-bottom row order so J/K navigation walks every
  // group in turn.
  const flatOrder = useMemo(
    () => columns.flatMap((column) => (tasksByColumn[column.id] ?? []).map((task) => task.id)),
    [columns, tasksByColumn],
  );
  useRegisterSurfaceOrder(flatOrder);

  return (
    // Single vertical scroll container: sticky group headers resolve against
    // the ScrollArea Viewport. The fade mask is off (maskHeight={0}) so pinned
    // headers stay crisp and fully opaque (the mask would fade the top edge
    // where headers pin).
    <ScrollArea className={cn("min-h-0 flex-1", className)} maskHeight={0} scrollFade={false}>
      <div className="flex flex-col pb-4">
        {columns.map((column) => (
          <TaskListGroup
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] ?? []}
            workflowStatuses={workflowStatuses}
            assigneeOptions={assigneeOptions}
            currentUserId={currentUserId}
            teamMemberIdsByTeamId={teamMemberIdsByTeamId}
            displayProperties={displayPropertySet}
            teamsById={teamsById}
            labelOptions={labelOptions}
            onAssignTask={onAssignTask}
            onChangeTaskStatus={onChangeTaskStatus}
            onChangeTaskLabels={onChangeTaskLabels}
            onChangeTaskEstimate={onChangeTaskEstimate}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

type TaskListGroupProps = {
  readonly column: TaskBoardGroupColumn;
  readonly tasks: readonly TaskBoardTask[];
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly displayProperties: ReadonlySet<TaskDisplayProperty>;
  readonly teamsById: ReadonlyMap<string, TaskBoardTeamOption>;
  readonly labelOptions: readonly TaskBoardLabelOption[];
  readonly onAssignTask?: TaskListSurfaceProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskListSurfaceProps["onChangeTaskStatus"];
  readonly onChangeTaskLabels?: TaskListSurfaceProps["onChangeTaskLabels"];
  readonly onChangeTaskEstimate?: TaskListSurfaceProps["onChangeTaskEstimate"];
  readonly onOpenTask?: (taskIdentifier: string) => void;
  readonly onAddTask?: (columnId: string) => void;
};

function TaskListGroup({
  column,
  tasks,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  displayProperties,
  teamsById,
  labelOptions,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
  onAddTask,
}: TaskListGroupProps) {
  return (
    // Each group is a plain block; its sticky header is bounded by this block,
    // so the next group's header pushes it up as it scrolls past (pure-CSS
    // Linear-style sticky behavior — no scroll listeners).
    <section aria-label={`${column.title} group`}>
      <div className="sticky top-0 z-10 flex h-10 items-center justify-between gap-2 border-b bg-muted/95 px-6 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          {column.taskState ? <WorkflowStatusIcon taskState={column.taskState} /> : null}
          <span className="truncate font-medium text-sm">{column.title}</span>
          <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
        </div>
        {onAddTask ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Add Task to ${column.title}`}
                  onClick={() => onAddTask(column.id)}
                >
                  <PlusIcon />
                </Button>
              }
            />
            <TooltipContent>
              Add Task... <Kbd>C</Kbd>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex flex-col">
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            workflowStatuses={workflowStatuses}
            assigneeOptions={assigneeOptions}
            currentUserId={currentUserId}
            teamMemberIdsByTeamId={teamMemberIdsByTeamId}
            displayProperties={displayProperties}
            teamsById={teamsById}
            labelOptions={labelOptions}
            onAssignTask={onAssignTask}
            onChangeTaskStatus={onChangeTaskStatus}
            onChangeTaskLabels={onChangeTaskLabels}
            onChangeTaskEstimate={onChangeTaskEstimate}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Linear-style label badges on a list row: a muted tag chip when unlabeled,
 * individual dot+name badges for one or two labels, and a collapsed
 * dot-cluster + "N labels" badge for three or more. Mirrors the Board card's
 * TaskCardLabelsBadge.
 */
function TaskRowLabelsBadge({ labels }: { readonly labels: readonly TaskBoardLabelOption[] }) {
  if (labels.length === 0) {
    return (
      <span
        aria-label="Labels"
        className="flex size-6 items-center justify-center rounded-md border bg-background hover:bg-accent"
      >
        <Tag className="size-3.5" />
      </span>
    );
  }
  if (labels.length <= 2) {
    return (
      <span className="flex items-center gap-1.5">
        {labels.map((option) => (
          <Badge className="text-muted-foreground" key={option.id} variant="outline">
            <span className={cn("size-1.5 rounded-full", labelDotClassName(option))} />
            {option.name}
          </Badge>
        ))}
      </span>
    );
  }
  return (
    <Badge className="text-muted-foreground" variant="outline">
      <span className="flex items-center -space-x-0.5">
        {labels.map((option) => (
          <span
            className={cn(
              "size-1.5 rounded-full ring-1 ring-background",
              labelDotClassName(option),
            )}
            key={option.id}
          />
        ))}
      </span>
      {labels.length} labels
    </Badge>
  );
}

type TaskListRowProps = {
  readonly task: TaskBoardTask;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly displayProperties: ReadonlySet<TaskDisplayProperty>;
  readonly teamsById: ReadonlyMap<string, TaskBoardTeamOption>;
  readonly labelOptions: readonly TaskBoardLabelOption[];
  readonly onAssignTask?: TaskListSurfaceProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskListSurfaceProps["onChangeTaskStatus"];
  readonly onChangeTaskLabels?: TaskListSurfaceProps["onChangeTaskLabels"];
  readonly onChangeTaskEstimate?: TaskListSurfaceProps["onChangeTaskEstimate"];
  readonly onOpenTask?: (taskIdentifier: string) => void;
};

function TaskListRow({
  task,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  displayProperties,
  teamsById,
  labelOptions,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
}: TaskListRowProps) {
  const currentStatus = workflowStatuses.find((status) => status.id === task.workflowStatusId);
  const rowState: TaskBoardTaskState = currentStatus?.taskState ?? task.taskState;
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const teamMemberIds = teamMemberIdsByTeamId.get(task.teamId) ?? EMPTY_USER_ID_SET;
  // The status picker offers only the Task's own Team Workflow's statuses
  // (ADR 0013) — relevant on cross-team surfaces fed every Team's statuses.
  const statusItems = statusOptions(
    workflowStatuses.filter(
      (status) => status.workflowId === undefined || status.workflowId === task.workflowId,
    ),
  );

  // Each selector populates its ref with an imperative opener; the keyboard
  // layer fires the matching opener for the focused row.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);

  const pickers = useMemo<Partial<Record<TaskShortcutField, typeof statusOpenRef>>>(
    () => ({
      status: statusOpenRef,
      assignee: assigneeOpenRef,
      priority: priorityOpenRef,
      estimate: estimateOpenRef,
      labels: labelsOpenRef,
    }),
    [],
  );

  const keyboard = useTaskSurfaceKeyboard();
  const { isFocused, isSelected } = useRegisterTaskShortcuts(task.id, {
    open: onOpenTask ? () => onOpenTask(task.identifier) : undefined,
    pickers,
  });

  const rowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isFocused) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [isFocused]);

  const form = useAppForm({
    defaultValues: {
      priority: "no_priority" as TaskPriority,
      estimate: (task.estimate ?? "no_estimate") as TaskEstimate,
      assignedUserId: task.assignedUserId ?? null,
      workflowStatusId: task.workflowStatusId,
    },
  });

  const createdAtLabel = formatCreatedAt(task.createdAt);
  const dueDateLabel = formatDueDate(task.dueDate);
  const teamName = teamsById.get(task.teamId)?.name ?? null;
  const showProperty = (property: TaskDisplayProperty) => displayProperties.has(property);

  // Church Labels plus the Task's Team's Labels are applicable in the picker
  // (see CONTEXT.md "Team Label"); the badge resolves only known ids.
  const applicableLabels = labelOptions.filter(
    (option) => (option.teamId ?? null) === null || option.teamId === task.teamId,
  );
  const taskLabels = (task.labelIds ?? [])
    .map((labelId) => labelOptions.find((option) => option.id === labelId))
    .filter((option) => option !== undefined);

  const isSelectable = rowState !== "canceled";

  const handleRowClick = (event: ReactMouseEvent) => {
    // The selectors stop propagation, so a row click means the body was hit.
    if (event.defaultPrevented) return;
    // Shift-click selects (Linear), like the Board card.
    if (event.shiftKey && isSelectable) {
      keyboard?.toggleSelected(task.id);
      return;
    }
    // Task links carry the Task Identifier, not the database id (ADR 0013).
    onOpenTask?.(task.identifier);
  };

  return (
    <div
      ref={rowRef}
      data-selected={isSelected || undefined}
      className={cn(
        "flex h-11 items-center gap-2 border-b px-6 transition-colors",
        rowState === "canceled" && "opacity-70",
        onOpenTask && "cursor-pointer hover:bg-accent/50",
        isFocused && "bg-accent/60 ring-1 ring-primary/50 ring-inset",
        isSelected && "bg-primary/5",
      )}
      onClick={handleRowClick}
      onPointerEnter={() => keyboard?.setFocusedTaskId(task.id)}
    >
      {showProperty("priority") ? (
        <form.Field name="priority">
          {(field) => {
            const meta = getPriorityMeta(field.state.value);
            const Icon = meta.icon;
            return (
              <PriorityComboboxSelector
                onValueChange={(next) => field.handleChange(next)}
                openRef={priorityOpenRef}
                trigger={
                  <span
                    aria-label={`Priority: ${meta.label}`}
                    className="flex size-5 items-center justify-center"
                  >
                    <Icon className={cn("size-4", meta.className)} />
                  </span>
                }
                value={field.state.value}
              />
            );
          }}
        </form.Field>
      ) : null}

      {showProperty("id") ? (
        <span className="w-16 shrink-0 truncate font-medium text-muted-foreground text-xs">
          {task.identifier}
        </span>
      ) : null}

      {showProperty("status") ? (
        <form.Field name="workflowStatusId">
          {(field) => (
            <StatusComboboxSelector
              disabled={statusItems.length === 0}
              emptyText="No statuses."
              onValueChange={(next) => {
                if (!next) return;
                field.handleChange(next);
                void onChangeTaskStatus?.({ taskId: task.id, workflowStatusId: next });
              }}
              openRef={statusOpenRef}
              options={statusItems}
              trigger={
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <WorkflowStatusIcon taskState={rowState} />
                </span>
              }
              value={field.state.value}
            />
          )}
        </form.Field>
      ) : null}

      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>

      {showProperty("parent") && task.parentTask ? (
        <span className="hidden shrink-0 truncate text-muted-foreground text-xs sm:inline">
          {task.parentTask.title}
        </span>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {showProperty("labels") ? (
          onChangeTaskLabels ? (
            <LabelsComboboxSelector
              onValueChange={(next) => void onChangeTaskLabels({ taskId: task.id, labelIds: next })}
              openRef={labelsOpenRef}
              options={applicableLabels}
              trigger={<TaskRowLabelsBadge labels={taskLabels} />}
              value={task.labelIds ?? []}
            />
          ) : (
            <TaskRowLabelsBadge labels={taskLabels} />
          )
        ) : null}

        {showProperty("team") && teamName ? <Badge variant="outline">{teamName}</Badge> : null}

        {showProperty("due_date") && dueDateLabel ? (
          <Badge className="text-muted-foreground" variant="outline">
            Due {dueDateLabel}
          </Badge>
        ) : null}

        {showProperty("estimate") ? (
          <form.Field name="estimate">
            {(field) => {
              const meta = getEstimateMeta(field.state.value);
              return (
                <EstimateComboboxSelector
                  onValueChange={(next) => {
                    field.handleChange(next);
                    void onChangeTaskEstimate?.({
                      taskId: task.id,
                      estimate: next === "no_estimate" ? null : (next as TaskBoardEstimate),
                    });
                  }}
                  openRef={estimateOpenRef}
                  trigger={
                    <span
                      aria-label={`Estimate: ${meta.label}`}
                      className="flex h-6 items-center justify-center gap-1 rounded-md border bg-background px-1.5 hover:bg-accent"
                    >
                      <Triangle className="size-3.5" />
                      {meta.short ? (
                        <span className="font-medium text-muted-foreground text-xs">
                          {meta.short}
                        </span>
                      ) : null}
                    </span>
                  }
                  value={field.state.value}
                />
              );
            }}
          </form.Field>
        ) : null}

        {showProperty("created") && createdAtLabel ? (
          <span className="hidden w-12 shrink-0 text-right text-muted-foreground text-xs sm:inline">
            {createdAtLabel}
          </span>
        ) : null}

        {showProperty("assignee") ? (
          <form.Field name="assignedUserId">
            {(field) => (
              <AssigneeComboboxSelector
                currentUserId={currentUserId}
                onValueChange={(next) => {
                  field.handleChange(next);
                  void onAssignTask?.({ taskId: task.id, assignedUserId: next });
                }}
                openRef={assigneeOpenRef}
                options={assigneeOptions}
                teamMemberIds={teamMemberIds}
                trigger={
                  <span className="flex size-5 items-center justify-center">
                    <AssigneeAvatar assignee={selectedAssignee} size={20} />
                  </span>
                }
                value={field.state.value}
              />
            )}
          </form.Field>
        ) : null}
      </div>
    </div>
  );
}
