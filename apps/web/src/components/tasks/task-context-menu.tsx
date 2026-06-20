import {
  Ban,
  CalendarDays,
  CircleCheck,
  Copy,
  FileText,
  Hash,
  Link as LinkIcon,
  RotateCcw,
  SquareArrowOutUpRight,
  Tag,
  Triangle,
  User,
} from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  LabelsComboboxSelector,
  StatusComboboxSelector,
  WorkflowStatusIcon,
  type AssigneeOption,
  type TaskEstimate,
} from "./task-card-fields";
import type {
  TaskBoardEstimate,
  TaskBoardTask,
  TaskBoardTaskState,
  TaskBoardWorkflowStatus,
} from "./task-kanban-adapter";
import type {
  TaskBoardLabelOption,
  TaskCardAssignChange,
  TaskCardEstimateChange,
  TaskCardLabelsChange,
  TaskCardStatusChange,
} from "./task-kanban-board";
import { statusOptions } from "./task-kanban-board-utils";

export type TaskCardDueDateChange = {
  readonly taskId: string;
  readonly dueDate: string | null;
};

export type TaskStateTransition = "complete" | "cancel" | "reopen";

export type TaskTransitionChange = {
  readonly taskId: string;
  readonly transition: TaskStateTransition;
};

const EMPTY_USER_ID_SET: ReadonlySet<string> = new Set();

export type TaskContextMenuProps = {
  /** The right-clicked Task. */
  readonly task: TaskBoardTask;
  /**
   * Every Task the action should apply to. When the right-clicked Task is part
   * of the current multi-selection this is the whole selection; otherwise it is
   * just `[task.id]`. The caller computes this so the menu stays presentation-
   * only.
   */
  readonly targetTaskIds: readonly string[];
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly assigneeOptions: readonly AssigneeOption[];
  readonly labelOptions: readonly TaskBoardLabelOption[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly rowState: TaskBoardTaskState;
  readonly children: ReactNode;
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onChangeTaskLabels?: (change: TaskCardLabelsChange) => void | Promise<void>;
  readonly onChangeTaskEstimate?: (change: TaskCardEstimateChange) => void | Promise<void>;
  readonly onChangeTaskDueDate?: (change: TaskCardDueDateChange) => void | Promise<void>;
  readonly onTransitionTask?: (change: TaskTransitionChange) => void | Promise<void>;
  readonly onOpenTask?: (taskIdentifier: string) => void;
  /** Builds the absolute URL copied by "Copy link" for a Task Identifier. */
  readonly buildTaskUrl?: (taskIdentifier: string) => string;
};

/** Fires an imperative picker opener stored on a ref (next tick, so the menu can close first). */
function openPicker(ref: MutableRefObject<(() => void) | null>) {
  // The context menu closes on item click; defer so the picker mounts/opens
  // after the menu's own close handling settles.
  requestAnimationFrame(() => ref.current?.());
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard?.writeText(text);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
}

/** Renders a Task as Markdown: the title as an H1 plus its description body. */
function taskToMarkdown(task: TaskBoardTask): string {
  const body = task.description?.trim();
  return body ? `# ${task.title}\n\n${body}\n` : `# ${task.title}\n`;
}

/**
 * Linear-style right-click menu for a Task card/row. Wraps `children` in a
 * `ContextMenuTrigger`; right-clicking opens a menu whose field actions (Status,
 * Assignee, Labels, Estimate, Due date) reuse the same searchable pickers as the
 * inline card selectors — opened imperatively from the menu item via each
 * picker's `openRef`, so "search everywhere" and the digit shortcuts come for
 * free. State actions (Mark as complete/cancel/reopen) and Copy actions cover
 * what the backend supports today.
 *
 * Every field/state action applies to `targetTaskIds`, so when the right-clicked
 * Task is part of the multi-selection the menu acts on the whole selection
 * (Linear behavior); otherwise it acts on just this Task.
 */
export function TaskContextMenu({
  task,
  targetTaskIds,
  workflowStatuses,
  assigneeOptions,
  labelOptions,
  currentUserId,
  teamMemberIdsByTeamId,
  rowState,
  children,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onChangeTaskDueDate,
  onTransitionTask,
  onOpenTask,
  buildTaskUrl,
}: TaskContextMenuProps) {
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);

  const ids = targetTaskIds.length > 0 ? targetTaskIds : [task.id];
  const multiple = ids.length > 1;
  // A projected Template Task has no Task row yet: its Cycle Adjustment only
  // carries planning fields (assignee, estimate, labels, due date, etc.), so
  // Workflow Status, state transitions, and Open/Copy reference actions don't
  // apply until it materializes.
  const isProjected = task.isProjected ?? false;

  // The status picker offers only the Task's own Team Workflow's statuses
  // (ADR 0013) — relevant on cross-team surfaces fed every Team's statuses.
  const statusItems = statusOptions(
    workflowStatuses.filter(
      (status) => status.workflowId === undefined || status.workflowId === task.workflowId,
    ),
  );
  const teamMemberIds = teamMemberIdsByTeamId.get(task.teamId) ?? EMPTY_USER_ID_SET;
  // Church Labels plus the Task's Team's Labels apply (see CONTEXT.md "Team Label").
  const applicableLabels = labelOptions.filter(
    (option) => (option.teamId ?? null) === null || option.teamId === task.teamId,
  );

  const applyStatus = (next: string | null) => {
    if (!next || !onChangeTaskStatus) return;
    for (const taskId of ids) void onChangeTaskStatus({ taskId, workflowStatusId: next });
  };
  const applyAssignee = (next: string | null) => {
    if (!onAssignTask) return;
    for (const taskId of ids) void onAssignTask({ taskId, assignedUserId: next });
  };
  const applyLabels = (next: readonly string[]) => {
    if (!onChangeTaskLabels) return;
    // Labels are scoped per Task's Team, so multi-Task label edits only make
    // sense for the single right-clicked Task.
    void onChangeTaskLabels({ taskId: task.id, labelIds: next });
  };
  const applyEstimate = (next: TaskEstimate) => {
    if (!onChangeTaskEstimate) return;
    const estimate = next === "no_estimate" ? null : (next as TaskBoardEstimate);
    for (const taskId of ids) void onChangeTaskEstimate({ taskId, estimate });
  };
  const applyDueDate = (next: string | null) => {
    if (!onChangeTaskDueDate) return;
    for (const taskId of ids) void onChangeTaskDueDate({ taskId, dueDate: next });
  };
  const applyTransition = (transition: TaskStateTransition) => {
    if (!onTransitionTask) return;
    for (const taskId of ids) void onTransitionTask({ taskId, transition });
  };

  const hiddenTrigger = (
    <span aria-hidden className="pointer-events-none absolute size-0 opacity-0" />
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<div className="relative" />}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {children}
        {/* Hidden pickers: keep their trigger buttons out of normal flow so they
            do not add a phantom row under list items. */}
        <div className="absolute size-0 overflow-hidden">
          {onChangeTaskStatus ? (
            <StatusComboboxSelector
              disabled={statusItems.length === 0}
              emptyText="No statuses."
              onValueChange={applyStatus}
              openRef={statusOpenRef}
              options={statusItems}
              trigger={hiddenTrigger}
              value={multiple ? null : task.workflowStatusId}
            />
          ) : null}
          {onAssignTask ? (
            <AssigneeComboboxSelector
              currentUserId={currentUserId}
              onValueChange={applyAssignee}
              openRef={assigneeOpenRef}
              options={assigneeOptions}
              teamMemberIds={teamMemberIds}
              trigger={hiddenTrigger}
              value={multiple ? null : (task.assignedUserId ?? null)}
            />
          ) : null}
          {onChangeTaskLabels && !multiple ? (
            <LabelsComboboxSelector
              onValueChange={applyLabels}
              openRef={labelsOpenRef}
              options={applicableLabels}
              trigger={hiddenTrigger}
              value={task.labelIds ?? []}
            />
          ) : null}
          {onChangeTaskEstimate ? (
            <EstimateComboboxSelector
              onValueChange={applyEstimate}
              openRef={estimateOpenRef}
              trigger={hiddenTrigger}
              triggerLabel="Context menu estimate picker"
              value={multiple ? "no_estimate" : ((task.estimate ?? "no_estimate") as TaskEstimate)}
            />
          ) : null}
          {onChangeTaskDueDate ? (
            <DueDateSelector
              onValueChange={applyDueDate}
              openRef={dueDateOpenRef}
              trigger={hiddenTrigger}
              value={multiple ? null : (task.dueDate ?? null)}
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          {onChangeTaskStatus && !isProjected ? (
            <ContextMenuItem
              disabled={statusItems.length === 0}
              onClick={() => openPicker(statusOpenRef)}
            >
              <WorkflowStatusIcon taskState={rowState} />
              Status
              <ContextMenuShortcut>S</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {onAssignTask ? (
            <ContextMenuItem onClick={() => openPicker(assigneeOpenRef)}>
              <User />
              Assignee
              <ContextMenuShortcut>A</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {onChangeTaskEstimate ? (
            <ContextMenuItem onClick={() => openPicker(estimateOpenRef)}>
              <Triangle />
              Estimate
              <ContextMenuShortcut>⇧E</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {onChangeTaskLabels && !multiple ? (
            <ContextMenuItem onClick={() => openPicker(labelsOpenRef)}>
              <Tag />
              Labels
              <ContextMenuShortcut>L</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {onChangeTaskDueDate ? (
            <ContextMenuItem onClick={() => openPicker(dueDateOpenRef)}>
              <CalendarDays />
              Due date
              <ContextMenuShortcut>D</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
        </ContextMenuGroup>

        {onTransitionTask && !isProjected ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <CircleCheck />
                Mark as
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => applyTransition("complete")}>
                  <CircleCheck className="text-emerald-500" />
                  Complete
                </ContextMenuItem>
                <ContextMenuItem onClick={() => applyTransition("cancel")}>
                  <Ban />
                  Canceled
                </ContextMenuItem>
                <ContextMenuItem onClick={() => applyTransition("reopen")}>
                  <RotateCcw />
                  Reopen
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}

        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            {/* A projection has no Task Identifier or link yet ("Projected"),
                so only the copyable planning text is offered. */}
            {!isProjected ? (
              <ContextMenuItem onClick={() => void copyText(task.identifier, "ID")}>
                <Hash />
                Copy ID
              </ContextMenuItem>
            ) : null}
            {buildTaskUrl && !isProjected ? (
              <ContextMenuItem onClick={() => void copyText(buildTaskUrl(task.identifier), "Link")}>
                <LinkIcon />
                Copy link
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onClick={() => void copyText(task.title, "Title")}>
              <Copy />
              Copy title
            </ContextMenuItem>
            <ContextMenuItem onClick={() => void copyText(taskToMarkdown(task), "Markdown")}>
              <FileText />
              Copy as Markdown
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {onOpenTask && !isProjected ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onOpenTask(task.identifier)}>
              <SquareArrowOutUpRight />
              Open
              <ContextMenuShortcut>↵</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// --- Provider + per-task wrapper --------------------------------------------
// Both Task surfaces (Board + List) receive the same option collections and
// change callbacks from the orchestrator. Rather than drill five more props
// through TaskKanbanColumn -> TaskKanbanCard and TaskListGroup -> TaskListRow,
// the orchestrator publishes them once via this provider and each card/row
// pulls a ready-to-use wrapper from `useTaskContextMenu`.

/** Shared context-menu data + callbacks, published once around both surfaces. */
export type TaskContextMenuConfig = Omit<
  TaskContextMenuProps,
  "task" | "targetTaskIds" | "rowState" | "children"
> & {
  /** The current multi-selection, used so a menu action can apply to it. */
  readonly selectedTaskIds: ReadonlySet<string>;
};

const TaskContextMenuContext = createContext<TaskContextMenuConfig | null>(null);

export function TaskContextMenuProvider({
  config,
  children,
}: {
  readonly config: TaskContextMenuConfig;
  readonly children: ReactNode;
}) {
  return (
    <TaskContextMenuContext.Provider value={config}>{children}</TaskContextMenuContext.Provider>
  );
}

/**
 * Returns a function that wraps a card/row in the Task context menu, or `null`
 * when no provider is mounted (the wrapper then renders children as-is). The
 * menu acts on the whole selection when `task` is part of it, else just `task`.
 */
export function useTaskContextMenu(): (args: {
  readonly task: TaskBoardTask;
  readonly rowState: TaskBoardTaskState;
  readonly children: ReactNode;
}) => ReactNode {
  const config = useContext(TaskContextMenuContext);

  return useMemo(
    () =>
      ({ task, rowState, children }) => {
        if (!config) return children;
        const { selectedTaskIds, ...menuProps } = config;
        const targetTaskIds =
          selectedTaskIds.has(task.id) && selectedTaskIds.size > 1
            ? [...selectedTaskIds]
            : [task.id];
        return (
          <TaskContextMenu
            {...menuProps}
            rowState={rowState}
            targetTaskIds={targetTaskIds}
            task={task}
          >
            {children}
          </TaskContextMenu>
        );
      },
    [config],
  );
}
