import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanMoveEvent,
} from "@/components/reui/kanban";
import { useAppForm } from "@/components/form/ts-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EllipsisIcon, PlusIcon, Tag, Triangle } from "lucide-react";
import {
  type ComponentProps,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  formatCreatedAt,
  formatDueDate,
  getPriorityMeta,
  getEstimateMeta,
  labelDotClassName,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  EstimateComboboxSelector,
  StatusComboboxSelector,
  WorkflowStatusIcon,
  type AssigneeOption,
  type TaskLabelOption,
  type TaskPriority,
  type TaskEstimate,
} from "./task-card-fields";
import {
  buildTaskBoardGroupColumns,
  getTaskGroupColumnId,
  groupTasksByColumn,
  isTaskBoardGroupingDraggable,
  moveTaskBetweenGroupColumns,
  buildTaskBoardColumns,
  computeBoardMoves,
  type TaskBoardColumn,
  type TaskBoardEstimate,
  type TaskBoardGroupColumn,
  type TaskBoardGrouping,
  type TaskBoardMove,
  type TaskBoardTask,
  type TaskBoardTaskState,
  type TaskBoardWorkflowStatus,
} from "./task-kanban-adapter";
import { DEFAULT_TASK_VIEW_OPTIONS, type TaskDisplayProperty } from "./task-view-options";
import {
  isEditableTarget,
  matchPickerHotkey,
  statusOptions,
  type PickerHotkey,
} from "./task-kanban-board-utils";

export type TaskCardAssignChange = {
  readonly taskId: string;
  readonly assignedUserId: string | null;
};

export type TaskCardStatusChange = {
  readonly taskId: string;
  readonly workflowStatusId: string;
};

export type TaskCardLabelsChange = {
  readonly taskId: string;
  readonly labelIds: readonly string[];
};

/** A Label option as the Board consumes it; teamId scopes Team Labels. */
export type TaskBoardLabelOption = TaskLabelOption & {
  readonly teamId?: string | null;
};

export type TaskCardEstimateChange = {
  readonly taskId: string;
  readonly estimate: TaskBoardEstimate | null;
};

export type TaskBoardTeamOption = {
  readonly id: string;
  readonly name: string;
};

type TaskKanbanBoardProps = {
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly tasks: readonly TaskBoardTask[];
  readonly assigneeOptions?: readonly AssigneeOption[];
  readonly teamOptions?: readonly TaskBoardTeamOption[];
  readonly labelOptions?: readonly TaskBoardLabelOption[];
  // The signed-in user, pinned to the top of the assignee picker.
  readonly currentUserId?: string | null;
  // Set of member user ids per Team id, used to render the "Team members"
  // section of the assignee picker for a Task's Team.
  readonly teamMemberIdsByTeamId?: ReadonlyMap<string, ReadonlySet<string>>;
  // View Options (URL-carried presentation settings).
  readonly grouping?: TaskBoardGrouping;
  readonly showEmptyColumns?: boolean;
  readonly displayProperties?: readonly TaskDisplayProperty[];
  // Persist a drag between Board Columns. The columnId is interpreted by the
  // caller according to the active grouping (Workflow Status id or User id).
  readonly onMoveTask: (move: {
    readonly taskId: string;
    readonly columnId: string;
  }) => void | Promise<void>;
  // Workflow Status ids of Board Columns hidden on this device.
  readonly hiddenColumnIds?: readonly string[];
  readonly onMoveTasks: (moves: readonly TaskBoardMove[]) => void | Promise<void>;
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onChangeTaskLabels?: (change: TaskCardLabelsChange) => void | Promise<void>;
  readonly onChangeTaskEstimate?: (change: TaskCardEstimateChange) => void | Promise<void>;
  readonly onOpenTask?: (taskIdentifier: string) => void;
  readonly onAddTask?: (workflowStatusId: string) => void;
  readonly onToggleColumnHidden?: (workflowStatusId: string) => void;
  readonly className?: string;
};

// Signature of the derived board layout. When this changes (tasks moved,
// reordered, assigned, added, removed, regrouped) the controlled Kanban value is re-synced
// from props so optimistic query updates show immediately instead of waiting on
// a remount.
function boardSignature(
  grouping: TaskBoardGrouping,
  columns: readonly TaskBoardGroupColumn[],
  tasks: readonly TaskBoardTask[],
): string {
  return [
    grouping,
    ...columns.map((column) => `${column.id}:${column.title}`),
    ...tasks.map(
      (task) =>
        `${task.id}:${getTaskGroupColumnId(grouping, task)}:${task.taskState}:${task.boardOrder ?? ""}:${task.assignedUserId ?? ""}:${task.estimate ?? ""}:${(task.labelIds ?? []).join(",")}`,
    ),
  ].join(":");
}

const EMPTY_TEAM_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map();
const EMPTY_USER_ID_SET: ReadonlySet<string> = new Set();
const EMPTY_HIDDEN_COLUMNS: readonly string[] = [];
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

// Opens a card's field picker when its shortcut is pressed while the card is
// hovered. Listens on the document so the key works without the trigger being
// focused, and ignores keystrokes aimed at editable elements.
function useCardPickerHotkeys(active: boolean, hotkeys: readonly PickerHotkey[]) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const match = matchPickerHotkey(event, hotkeys);
      const opener = match?.openRef.current;
      if (!opener) return;
      event.preventDefault();
      opener();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, hotkeys]);
}

export function TaskKanbanBoard({
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
  onMoveTask,
  hiddenColumnIds = EMPTY_HIDDEN_COLUMNS,
  onMoveTasks,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
  onAddTask,
  onToggleColumnHidden,
  className,
}: TaskKanbanBoardProps) {
  const allWorkflowColumns = useMemo(
    () => buildTaskBoardColumns(workflowStatuses),
    [workflowStatuses],
  );
  const hiddenIds = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);
  const hiddenColumns = useMemo(
    () => allWorkflowColumns.filter((column) => hiddenIds.has(column.id)),
    [allWorkflowColumns, hiddenIds],
  );
  const columns = useMemo(
    () =>
      buildTaskBoardGroupColumns({
        grouping,
        workflowStatuses,
        assignees: assigneeOptions,
        teams: teamOptions,
        tasks,
        showEmptyColumns,
        hiddenColumnIds: grouping === "workflow_status" ? hiddenIds : undefined,
      }),
    [grouping, workflowStatuses, assigneeOptions, teamOptions, tasks, showEmptyColumns, hiddenIds],
  );
  const derivedColumnTasks = useMemo(
    () => groupTasksByColumn(grouping, columns, tasks),
    [grouping, columns, tasks],
  );
  const displayPropertySet = useMemo(() => new Set(displayProperties), [displayProperties]);
  const teamsById = useMemo(
    () => new Map(teamOptions.map((team) => [team.id, team])),
    [teamOptions],
  );
  const isDraggable = isTaskBoardGroupingDraggable(grouping);
  const signature = boardSignature(grouping, columns, tasks);

  // The Kanban root is fully controlled, so dnd-kit needs a mutable `value` for
  // live drag previews. We mirror the props-derived layout in state and re-sync
  // whenever the derived signature changes (the React "reset state on prop
  // change" pattern), keeping the query as the source of truth.
  const [columnTasks, setColumnTasks] = useState(derivedColumnTasks);
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setColumnTasks(derivedColumnTasks);
    setSyncedSignature(signature);
  }

  // Card selection: "Select all in column" or shift-click, cleared by Esc or
  // clicking empty board space. Dragging any selected card moves the group.
  const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(EMPTY_SELECTION);

  useEffect(() => {
    if (selectedTaskIds.size === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedTaskIds(EMPTY_SELECTION);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedTaskIds.size]);

  const toggleTaskSelected = (taskId: string) => {
    setSelectedTaskIds((selection) => {
      const next = new Set(selection);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAllInColumn = (columnId: string) => {
    const columnTaskIds = (columnTasks[columnId] ?? [])
      .filter((task) => task.taskState !== "canceled")
      .map((task) => task.id);
    setSelectedTaskIds(new Set(columnTaskIds));
  };

  const handleMove = (event: KanbanMoveEvent) => {
    const activeTaskId = String(event.event.active.id);
    if (grouping !== "workflow_status") {
      moveTaskBetweenGroupColumns({
        grouping,
        columns: columnTasks,
        taskId: activeTaskId,
        destinationColumnId: event.overContainer,
        destinationIndex: event.overIndex,
        persistMove: onMoveTask,
      });
      return;
    }

    // Persist the finished drag from the preview layout; the optimistic update
    // re-sorts the cached tasks, which flows back through props and re-syncs
    // `columnTasks`.
    const moves = computeBoardMoves({
      columns: columnTasks,
      activeTaskId,
      selectedTaskIds,
    });
    if (moves.length === 0) return;
    if (moves.length > 1) setSelectedTaskIds(EMPTY_SELECTION);
    void onMoveTasks(moves);
  };

  const tasksById = useMemo(() => {
    const byId = new Map<string, TaskBoardTask>();
    for (const task of tasks) byId.set(task.id, task);
    return byId;
  }, [tasks]);

  return (
    <Kanban
      value={columnTasks}
      onValueChange={setColumnTasks}
      getItemValue={(task) => task.id}
      onMove={handleMove}
      className={cn("group/kanban-root flex min-h-0 flex-col", className)}
      onClick={(event: ReactMouseEvent<HTMLElement>) => {
        // Click-away clears the selection, but only for true background
        // clicks. React bubbles portaled popup clicks (e.g. the column's
        // "Select all in column" menu item) through this handler even though
        // their DOM nodes live outside the board, and header controls like
        // the … and + buttons shouldn't drop the selection either.
        if (selectedTaskIds.size === 0) return;
        if (!(event.target instanceof Element)) return;
        if (!event.currentTarget.contains(event.target)) return;
        if (event.target.closest("button,[role='menuitem'],[role='menu']")) return;
        setSelectedTaskIds(EMPTY_SELECTION);
      }}
    >
      {/* Grid items stretch by default, so every Board Column fills the full
          board height; each column scrolls its own cards internally. */}
      <KanbanBoard className="grid min-h-0 flex-1 auto-cols-[minmax(17rem,20rem)] grid-flow-col gap-2 overflow-x-auto pb-2 sm:grid-cols-none">
        {columns.map((column) => (
          <TaskKanbanColumn
            key={column.id}
            column={column}
            value={column.id}
            tasks={columnTasks[column.id] ?? []}
            workflowStatuses={workflowStatuses}
            assigneeOptions={assigneeOptions}
            currentUserId={currentUserId}
            teamMemberIdsByTeamId={teamMemberIdsByTeamId}
            displayProperties={displayPropertySet}
            teamsById={teamsById}
            labelOptions={labelOptions}
            dragDisabled={!isDraggable}
            selectedTaskIds={selectedTaskIds}
            onAssignTask={onAssignTask}
            onChangeTaskStatus={onChangeTaskStatus}
            onChangeTaskLabels={onChangeTaskLabels}
            onChangeTaskEstimate={onChangeTaskEstimate}
            onOpenTask={onOpenTask}
            onAddTask={grouping === "workflow_status" ? onAddTask : undefined}
            onHideColumn={grouping === "workflow_status" ? onToggleColumnHidden : undefined}
            onSelectAllInColumn={selectAllInColumn}
            onToggleTaskSelected={toggleTaskSelected}
          />
        ))}
        {hiddenColumns.length > 0 ? (
          <HiddenColumnsChip hiddenColumns={hiddenColumns} onShowColumn={onToggleColumnHidden} />
        ) : null}
      </KanbanBoard>
      <KanbanOverlay>
        {({ value }) => {
          const task = tasksById.get(String(value));
          if (!task) return null;
          const groupSize =
            selectedTaskIds.has(task.id) && selectedTaskIds.size > 1 ? selectedTaskIds.size : 0;
          return (
            <div className="relative">
              {groupSize > 0 ? (
                <span
                  aria-label={`${groupSize} selected Tasks`}
                  className="-top-2 -right-2 absolute z-10 flex size-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs"
                >
                  {groupSize}
                </span>
              ) : null}
              <TaskKanbanCard
                task={task}
                workflowStatuses={workflowStatuses}
                assigneeOptions={assigneeOptions}
                currentUserId={currentUserId}
                teamMemberIdsByTeamId={teamMemberIdsByTeamId}
                displayProperties={displayPropertySet}
                teamsById={teamsById}
                labelOptions={labelOptions}
                dragDisabled={!isDraggable}
                selectedTaskIds={EMPTY_SELECTION}
                isOverlay
                className="shadow-lg"
              />
            </div>
          );
        }}
      </KanbanOverlay>
    </Kanban>
  );
}

/**
 * Linear-style label badges on a card: a muted tag chip when unlabeled (so the
 * picker stays reachable, like the priority/estimate chips), individual
 * dot+name badges for one or two labels, and a collapsed dot-cluster +
 * "N labels" badge for three or more (density guard).
 */
function TaskCardLabelsBadge({ labels }: { readonly labels: readonly TaskBoardLabelOption[] }) {
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

function HiddenColumnsChip({
  hiddenColumns,
  onShowColumn,
}: {
  readonly hiddenColumns: readonly TaskBoardColumn[];
  readonly onShowColumn?: (workflowStatusId: string) => void;
}) {
  return (
    <div className="flex items-start pt-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              {hiddenColumns.length} hidden
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 p-1">
          {hiddenColumns.map((column) => (
            <button
              key={column.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => onShowColumn?.(column.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <WorkflowStatusIcon taskState={column.taskState} />
                <span className="truncate">{column.title}</span>
              </span>
              <span className="text-muted-foreground text-xs">Show</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface TaskKanbanColumnProps extends Omit<
  ComponentProps<typeof KanbanColumn>,
  "children" | "value"
> {
  readonly column: TaskBoardGroupColumn;
  readonly tasks: readonly TaskBoardTask[];
  readonly value: string;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly displayProperties: ReadonlySet<TaskDisplayProperty>;
  readonly teamsById: ReadonlyMap<string, TaskBoardTeamOption>;
  readonly labelOptions: readonly TaskBoardLabelOption[];
  readonly dragDisabled?: boolean;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly isOverlay?: boolean;
  readonly onAssignTask?: TaskKanbanBoardProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskKanbanBoardProps["onChangeTaskStatus"];
  readonly onChangeTaskLabels?: TaskKanbanBoardProps["onChangeTaskLabels"];
  readonly onChangeTaskEstimate?: TaskKanbanBoardProps["onChangeTaskEstimate"];
  readonly onOpenTask?: (taskIdentifier: string) => void;
  readonly onAddTask?: (workflowStatusId: string) => void;
  readonly onHideColumn?: (workflowStatusId: string) => void;
  readonly onSelectAllInColumn?: (workflowStatusId: string) => void;
  readonly onToggleTaskSelected?: (taskId: string) => void;
}

function TaskKanbanColumn({
  column,
  tasks,
  value,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  displayProperties,
  teamsById,
  labelOptions,
  dragDisabled,
  selectedTaskIds,
  isOverlay,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
  onAddTask,
  onHideColumn,
  onSelectAllInColumn,
  onToggleTaskSelected,
  ...props
}: TaskKanbanColumnProps) {
  return (
    // Columns are not draggable (no KanbanColumnHandle): Board Column order
    // comes from Workflow Status sortOrder, not manual rearrangement.
    <KanbanColumn
      value={value}
      className="h-full min-h-0"
      aria-label={`Workflow Status ${column.title}`}
      {...props}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg bg-muted/50">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {column.taskState ? <WorkflowStatusIcon taskState={column.taskState} /> : null}
            <span className="truncate font-medium text-sm">{column.title}</span>
            <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  // The column header sits on bg-muted/50, so the button's
                  // default aria-expanded:bg-muted open state is invisible
                  // here; use a foreground tint instead.
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="aria-expanded:bg-foreground/10 aria-expanded:text-foreground data-popup-open:bg-foreground/10 data-popup-open:text-foreground"
                    aria-label={`${column.title} Board Column options`}
                  >
                    <EllipsisIcon />
                  </Button>
                }
              />
              {/* w-auto overrides the anchor-width default; the anchor is a
                  tiny icon button, which would wrap the menu item labels. */}
              <DropdownMenuContent align="end" className="w-auto min-w-44">
                <DropdownMenuItem onClick={() => onSelectAllInColumn?.(column.id)}>
                  Select all in column
                </DropdownMenuItem>
                {onHideColumn ? (
                  <DropdownMenuItem onClick={() => onHideColumn(column.id)}>
                    Hide column
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
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
        </div>
        <KanbanColumnContent
          value={value}
          className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
          aria-label={`${column.title} Tasks`}
        >
          {tasks.map((task) => (
            <TaskKanbanCard
              key={task.id}
              task={task}
              workflowStatuses={workflowStatuses}
              assigneeOptions={assigneeOptions}
              currentUserId={currentUserId}
              teamMemberIdsByTeamId={teamMemberIdsByTeamId}
              displayProperties={displayProperties}
              teamsById={teamsById}
              labelOptions={labelOptions}
              dragDisabled={dragDisabled}
              selectedTaskIds={selectedTaskIds}
              asHandle={!isOverlay}
              isOverlay={isOverlay}
              onAssignTask={onAssignTask}
              onChangeTaskStatus={onChangeTaskStatus}
              onChangeTaskLabels={onChangeTaskLabels}
              onChangeTaskEstimate={onChangeTaskEstimate}
              onOpenTask={onOpenTask}
              onToggleTaskSelected={onToggleTaskSelected}
            />
          ))}
        </KanbanColumnContent>
      </div>
    </KanbanColumn>
  );
}

interface TaskKanbanCardProps extends Omit<
  ComponentProps<typeof KanbanItem>,
  "children" | "value"
> {
  readonly task: TaskBoardTask;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly displayProperties: ReadonlySet<TaskDisplayProperty>;
  readonly teamsById: ReadonlyMap<string, TaskBoardTeamOption>;
  readonly labelOptions: readonly TaskBoardLabelOption[];
  readonly dragDisabled?: boolean;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly asHandle?: boolean;
  readonly isOverlay?: boolean;
  readonly onAssignTask?: TaskKanbanBoardProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskKanbanBoardProps["onChangeTaskStatus"];
  readonly onChangeTaskLabels?: TaskKanbanBoardProps["onChangeTaskLabels"];
  readonly onChangeTaskEstimate?: TaskKanbanBoardProps["onChangeTaskEstimate"];
  readonly onOpenTask?: (taskIdentifier: string) => void;
  readonly onToggleTaskSelected?: (taskId: string) => void;
}

function TaskKanbanCard({
  task,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  displayProperties,
  teamsById,
  labelOptions,
  dragDisabled,
  selectedTaskIds,
  asHandle,
  isOverlay,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onOpenTask,
  onToggleTaskSelected,
  className,
  ...props
}: TaskKanbanCardProps) {
  const currentStatus = workflowStatuses.find((status) => status.id === task.workflowStatusId);
  const cardState: TaskBoardTaskState = currentStatus?.taskState ?? task.taskState;
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const teamMemberIds = teamMemberIdsByTeamId.get(task.teamId) ?? EMPTY_USER_ID_SET;
  // The status picker offers only the Task's own Team Workflow's statuses
  // (ADR 0013) — relevant on cross-team boards fed every Team's statuses.
  const statusItems = statusOptions(
    workflowStatuses.filter(
      (status) => status.workflowId === undefined || status.workflowId === task.workflowId,
    ),
  );
  const isSelected = selectedTaskIds.has(task.id);
  const isSelectable = cardState !== "canceled" && onToggleTaskSelected !== undefined;

  // While this card is hovered, keyboard shortcuts open the matching picker.
  // Each selector populates its ref with an imperative opener; the bindings
  // table maps a key (and optional Shift) to the picker it opens.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const pickerHotkeys = useMemo<readonly PickerHotkey[]>(
    () => [
      { key: "s", openRef: statusOpenRef },
      { key: "a", openRef: assigneeOpenRef },
      { key: "p", openRef: priorityOpenRef },
      { key: "e", shift: true, openRef: estimateOpenRef },
      { key: "l", openRef: labelsOpenRef },
    ],
    [],
  );
  useCardPickerHotkeys(isHovered, pickerHotkeys);

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

  const handleCardClick = (event: ReactMouseEvent) => {
    // Card clicks never clear the selection from the board-level handler.
    event.stopPropagation();
    if (event.shiftKey && isSelectable) {
      onToggleTaskSelected(task.id);
      return;
    }
    // Task links carry the Task Identifier, not the database id (ADR 0013).
    onOpenTask?.(task.identifier);
  };

  const cardContent = (
    <Card
      className={cn(
        "gap-0 rounded-md py-0 shadow-xs ring-foreground/10",
        cardState === "canceled" && "opacity-70",
        onOpenTask && "cursor-pointer transition-colors hover:ring-foreground/20",
        isSelected &&
          "bg-primary/5 ring-primary/40 hover:ring-primary/50 group-data-[dragging=true]/kanban-root:opacity-40",
        className,
      )}
      onClick={handleCardClick}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-3 pb-0">
        <div className="flex min-w-0 items-center gap-1.5">
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
                    <span className="flex size-5 items-center justify-center">
                      <WorkflowStatusIcon taskState={cardState} />
                    </span>
                  }
                  value={field.state.value}
                />
              )}
            </form.Field>
          ) : null}
          {showProperty("id") ? (
            <span className="truncate font-medium text-muted-foreground text-xs">
              {task.identifier}
            </span>
          ) : null}
        </div>
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
      </CardHeader>

      <CardContent className="px-3 py-2">
        <CardTitle className="line-clamp-2 font-semibold text-sm leading-snug">
          {task.title}
        </CardTitle>
        {showProperty("parent") && task.parentTask ? (
          <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
            Parent: {task.parentTask.title}
          </p>
        ) : null}
      </CardContent>

      <CardContent className="flex flex-wrap items-center gap-1.5 px-3 pt-0 pb-3">
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
                      className="flex size-6 items-center justify-center rounded-md border bg-background hover:bg-accent"
                    >
                      <Icon className={cn("size-3.5", meta.className)} />
                    </span>
                  }
                  value={field.state.value}
                />
              );
            }}
          </form.Field>
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
                      estimate: next === "no_estimate" ? null : next,
                    });
                  }}
                  openRef={estimateOpenRef}
                  trigger={
                    <span
                      aria-label={`Estimate: ${meta.label}`}
                      className="flex size-6 items-center justify-center rounded-md border bg-background hover:bg-accent"
                    >
                      <Triangle className="size-3.5" />
                    </span>
                  }
                  value={field.state.value}
                />
              );
            }}
          </form.Field>
        ) : null}
        {showProperty("labels") ? (
          onChangeTaskLabels && !isOverlay ? (
            <LabelsComboboxSelector
              onValueChange={(next) => void onChangeTaskLabels({ taskId: task.id, labelIds: next })}
              openRef={labelsOpenRef}
              options={applicableLabels}
              trigger={<TaskCardLabelsBadge labels={taskLabels} />}
              value={task.labelIds ?? []}
            />
          ) : (
            <TaskCardLabelsBadge labels={taskLabels} />
          )
        ) : null}
        {showProperty("due_date") && dueDateLabel ? (
          <Badge className="text-muted-foreground" variant="outline">
            Due {dueDateLabel}
          </Badge>
        ) : null}
        {showProperty("team") && teamName ? <Badge variant="outline">{teamName}</Badge> : null}
      </CardContent>

      {showProperty("created") && createdAtLabel ? (
        <CardContent className="px-3 pt-0 pb-3">
          <p className="text-muted-foreground text-xs">Created {createdAtLabel}</p>
        </CardContent>
      ) : null}
    </Card>
  );

  return (
    <KanbanItem
      value={task.id}
      disabled={dragDisabled || cardState === "canceled"}
      aria-label={`Task card ${task.title}`}
      data-selected={isSelected || undefined}
      {...props}
    >
      {asHandle && !isOverlay ? <KanbanItemHandle>{cardContent}</KanbanItemHandle> : cardContent}
    </KanbanItem>
  );
}
