import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanMoveEvent,
} from "@/components/reui/kanban";
import { useAppForm } from "@/components/form/ts-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVerticalIcon, Triangle } from "lucide-react";
import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react";

import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  formatCreatedAt,
  getPriorityMeta,
  getSizeMeta,
  PriorityComboboxSelector,
  SizeComboboxSelector,
  StatusComboboxSelector,
  WorkflowStatusIcon,
  type AssigneeOption,
  type TaskPriority,
  type TaskSize,
} from "./task-card-fields";
import {
  buildTaskBoardColumns,
  groupTasksByWorkflowStatus,
  moveTaskBetweenBoardColumns,
  type TaskBoardColumn,
  type TaskBoardTask,
  type TaskBoardTaskState,
  type TaskBoardWorkflowStatus,
} from "./task-kanban-adapter";
import {
  matchPickerHotkey,
  statusOptions,
  toTaskIdentifier,
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

type TaskKanbanBoardProps = {
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly tasks: readonly TaskBoardTask[];
  readonly assigneeOptions?: readonly AssigneeOption[];
  // The signed-in user, pinned to the top of the assignee picker.
  readonly currentUserId?: string | null;
  // Set of member user ids per Team id, used to render the "Team members"
  // section of the assignee picker for a Task's Team.
  readonly teamMemberIdsByTeamId?: ReadonlyMap<string, ReadonlySet<string>>;
  readonly onMoveTask: (move: {
    readonly taskId: string;
    readonly workflowStatusId: string;
  }) => void | Promise<void>;
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onOpenTask?: (taskId: string) => void;
  readonly className?: string;
};

// Signature of the derived board layout. When this changes (tasks moved,
// assigned, added, removed) the controlled Kanban value is re-synced from props
// so optimistic query updates show immediately instead of waiting on a remount.
function boardSignature(
  columns: readonly TaskBoardColumn[],
  tasks: readonly TaskBoardTask[],
): string {
  return [
    ...columns.map((column) => `${column.id}:${column.title}`),
    ...tasks.map(
      (task) =>
        `${task.id}:${task.workflowStatusId}:${task.taskState}:${task.assignedUserId ?? ""}`,
    ),
  ].join(":");
}

const EMPTY_TEAM_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map();
const EMPTY_USER_ID_SET: ReadonlySet<string> = new Set();

// Avoid hijacking shortcut keys while the user is typing in a field (e.g.
// another open combobox/search box on the page).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

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
  currentUserId = null,
  teamMemberIdsByTeamId = EMPTY_TEAM_MEMBERS,
  onMoveTask,
  onAssignTask,
  onChangeTaskStatus,
  onOpenTask,
  className,
}: TaskKanbanBoardProps) {
  const columns = useMemo(() => buildTaskBoardColumns(workflowStatuses), [workflowStatuses]);
  const derivedColumnTasks = useMemo(
    () => groupTasksByWorkflowStatus(columns, tasks),
    [columns, tasks],
  );
  const signature = boardSignature(columns, tasks);

  // The Kanban root is fully controlled, so dnd-kit needs a mutable `value` for
  // same-column reordering. We mirror the props-derived layout in state and
  // re-sync whenever the derived signature changes (the React "reset state on
  // prop change" pattern), keeping the query as the source of truth.
  const [columnTasks, setColumnTasks] = useState(derivedColumnTasks);
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setColumnTasks(derivedColumnTasks);
    setSyncedSignature(signature);
  }

  const handleMove = (event: KanbanMoveEvent) => {
    // Persist the cross-column move; the optimistic update reorders the cached
    // tasks, which flows back through props and re-syncs `columnTasks`.
    moveTaskBetweenBoardColumns({
      columns: columnTasks,
      taskId: String(event.event.active.id),
      destinationWorkflowStatusId: event.overContainer,
      destinationIndex: event.overIndex,
      persistMove: onMoveTask,
    });
  };

  return (
    <Kanban
      value={columnTasks}
      onValueChange={setColumnTasks}
      getItemValue={(task) => task.id}
      onMove={handleMove}
      className={className}
    >
      <KanbanBoard className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 sm:grid-cols-none">
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
            onAssignTask={onAssignTask}
            onChangeTaskStatus={onChangeTaskStatus}
            onOpenTask={onOpenTask}
          />
        ))}
      </KanbanBoard>
      <KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
    </Kanban>
  );
}

interface TaskKanbanColumnProps extends Omit<
  ComponentProps<typeof KanbanColumn>,
  "children" | "value"
> {
  readonly column: TaskBoardColumn;
  readonly tasks: readonly TaskBoardTask[];
  readonly value: string;
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly isOverlay?: boolean;
  readonly onAssignTask?: TaskKanbanBoardProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskKanbanBoardProps["onChangeTaskStatus"];
  readonly onOpenTask?: (taskId: string) => void;
}

function TaskKanbanColumn({
  column,
  tasks,
  value,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  isOverlay,
  onAssignTask,
  onChangeTaskStatus,
  onOpenTask,
  ...props
}: TaskKanbanColumnProps) {
  return (
    <KanbanColumn value={value} aria-label={`Workflow Status ${column.title}`} {...props}>
      <Card className="mb-2.5 h-full min-w-64 bg-muted/25">
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="truncate text-sm font-semibold">{column.title}</span>
              <Badge variant="outline">{tasks.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {column.taskState.replace("_", " ")}
            </p>
          </div>
          <KanbanColumnHandle
            render={(handleProps) => (
              <Button
                {...handleProps}
                size="icon-xs"
                variant="ghost"
                aria-label={`Move ${column.title}`}
              >
                <GripVerticalIcon />
              </Button>
            )}
          />
        </CardHeader>
        <CardContent className="px-3">
          <KanbanColumnContent
            value={value}
            className="flex min-h-24 flex-col gap-2.5"
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
                asHandle={!isOverlay}
                isOverlay={isOverlay}
                onAssignTask={onAssignTask}
                onChangeTaskStatus={onChangeTaskStatus}
                onOpenTask={onOpenTask}
              />
            ))}
          </KanbanColumnContent>
        </CardContent>
      </Card>
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
  readonly asHandle?: boolean;
  readonly isOverlay?: boolean;
  readonly onAssignTask?: TaskKanbanBoardProps["onAssignTask"];
  readonly onChangeTaskStatus?: TaskKanbanBoardProps["onChangeTaskStatus"];
  readonly onOpenTask?: (taskId: string) => void;
}

function TaskKanbanCard({
  task,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  asHandle,
  isOverlay,
  onAssignTask,
  onChangeTaskStatus,
  onOpenTask,
  className,
  ...props
}: TaskKanbanCardProps) {
  const currentStatus = workflowStatuses.find((status) => status.id === task.workflowStatusId);
  const cardState: TaskBoardTaskState = currentStatus?.taskState ?? task.taskState;
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const teamMemberIds =
    (task.teamId ? teamMemberIdsByTeamId.get(task.teamId) : undefined) ?? EMPTY_USER_ID_SET;
  const statusItems = statusOptions(workflowStatuses);

  // While this card is hovered, keyboard shortcuts open the matching picker.
  // Each selector populates its ref with an imperative opener; the bindings
  // table maps a key (and optional Shift) to the picker it opens.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const sizeOpenRef = useRef<(() => void) | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const pickerHotkeys = useMemo<readonly PickerHotkey[]>(
    () => [
      { key: "s", openRef: statusOpenRef },
      { key: "a", openRef: assigneeOpenRef },
      { key: "p", openRef: priorityOpenRef },
      { key: "e", shift: true, openRef: sizeOpenRef },
    ],
    [],
  );
  useCardPickerHotkeys(isHovered, pickerHotkeys);

  const form = useAppForm({
    defaultValues: {
      priority: "no_priority" as TaskPriority,
      size: "no_estimate" as TaskSize,
      assignedUserId: task.assignedUserId ?? null,
      workflowStatusId: task.workflowStatusId,
    },
  });

  const createdAtLabel = formatCreatedAt(task.createdAt);

  const cardContent = (
    <Card
      className={cn(
        "gap-0 py-0 shadow-xs",
        cardState === "canceled" && "opacity-70",
        onOpenTask && "cursor-pointer transition-colors hover:border-ring",
        className,
      )}
      onClick={onOpenTask ? () => onOpenTask(task.id) : undefined}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-3 pb-0">
        <div className="flex min-w-0 items-center gap-1.5">
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
          <span className="truncate font-medium text-muted-foreground text-xs">
            {toTaskIdentifier(task.id)}
          </span>
        </div>
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
      </CardHeader>

      <CardContent className="px-3 py-2">
        <CardTitle className="line-clamp-2 font-semibold text-sm leading-snug">
          {task.title}
        </CardTitle>
        {task.parentTask ? (
          <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
            Parent: {task.parentTask.title}
          </p>
        ) : null}
      </CardContent>

      <CardContent className="flex flex-wrap items-center gap-1.5 px-3 pt-0 pb-3">
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
        <form.Field name="size">
          {(field) => {
            const meta = getSizeMeta(field.state.value);
            return (
              <SizeComboboxSelector
                onValueChange={(next) => field.handleChange(next)}
                openRef={sizeOpenRef}
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
      </CardContent>

      {createdAtLabel ? (
        <CardContent className="px-3 pt-0 pb-3">
          <p className="text-muted-foreground text-xs">Created {createdAtLabel}</p>
        </CardContent>
      ) : null}
    </Card>
  );

  return (
    <KanbanItem
      value={task.id}
      disabled={cardState === "canceled"}
      aria-label={`Task card ${task.title}`}
      {...props}
    >
      {asHandle && !isOverlay ? <KanbanItemHandle>{cardContent}</KanbanItemHandle> : cardContent}
    </KanbanItem>
  );
}
