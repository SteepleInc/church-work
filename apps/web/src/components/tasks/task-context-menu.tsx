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
  Users,
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
  TeamComboboxSelector,
  WorkflowStatusIcon,
  type AssigneeOption,
  type TeamPickerOption,
} from "./task-card-fields";
import {
  buildPersistedTaskFieldTarget,
  buildProjectedTaskFieldTarget,
  type TaskFieldTarget,
} from "./task-field-target";
import type {
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
  readonly teamOptions?: readonly TeamPickerOption[];
  readonly memberTeamIds?: ReadonlySet<string>;
  readonly currentUserId: string | null;
  readonly teamMemberIdsByTeamId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly rowState: TaskBoardTaskState;
  readonly children: ReactNode;
  readonly onAssignTask?: (change: TaskCardAssignChange) => void | Promise<void>;
  readonly onChangeTaskStatus?: (change: TaskCardStatusChange) => void | Promise<void>;
  readonly onChangeTaskLabels?: (change: TaskCardLabelsChange) => void | Promise<void>;
  readonly onChangeTaskEstimate?: (change: TaskCardEstimateChange) => void | Promise<void>;
  readonly onChangeTaskDueDate?: (change: TaskCardDueDateChange) => void | Promise<void>;
  readonly onChangeTaskTeam?: (change: {
    readonly taskId: string;
    readonly teamId: string;
    readonly labelIds: readonly string[];
  }) => void | Promise<void>;
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
  teamOptions = [],
  memberTeamIds = EMPTY_USER_ID_SET,
  currentUserId,
  teamMemberIdsByTeamId,
  rowState,
  children,
  onAssignTask,
  onChangeTaskStatus,
  onChangeTaskLabels,
  onChangeTaskEstimate,
  onChangeTaskDueDate,
  onChangeTaskTeam,
  onTransitionTask,
  onOpenTask,
  buildTaskUrl,
}: TaskContextMenuProps) {
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);
  const teamOpenRef = useRef<(() => void) | null>(null);

  const ids = targetTaskIds.length > 0 ? targetTaskIds : [task.id];
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

  const target: TaskFieldTarget = isProjected
    ? buildProjectedTaskFieldTarget({
        task,
        labelOptions,
        onAssignTask,
        onChangeTaskLabels,
        onChangeTaskEstimate,
        onChangeTaskDueDate,
        onChangeTaskTeam,
      })
    : buildPersistedTaskFieldTarget({
        task,
        targetTaskIds: ids,
        labelOptions,
        onAssignTask,
        onChangeTaskStatus,
        onChangeTaskLabels,
        onChangeTaskEstimate,
        onChangeTaskDueDate,
        onChangeTaskTeam,
        onTransitionTask,
        onOpenTask,
        buildTaskUrl,
      });

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
          {target.fields.status.set ? (
            <StatusComboboxSelector
              disabled={statusItems.length === 0}
              emptyText="No statuses."
              onValueChange={target.fields.status.set}
              openRef={statusOpenRef}
              options={statusItems}
              trigger={hiddenTrigger}
              value={target.fields.status.value}
            />
          ) : null}
          {target.fields.assignee.set ? (
            <AssigneeComboboxSelector
              currentUserId={currentUserId}
              onValueChange={target.fields.assignee.set}
              openRef={assigneeOpenRef}
              options={assigneeOptions}
              teamMemberIds={teamMemberIds}
              trigger={hiddenTrigger}
              value={target.fields.assignee.value}
            />
          ) : null}
          {target.fields.labels.set ? (
            <LabelsComboboxSelector
              onValueChange={target.fields.labels.set}
              openRef={labelsOpenRef}
              options={applicableLabels}
              trigger={hiddenTrigger}
              value={target.fields.labels.value}
            />
          ) : null}
          {target.fields.estimate.set ? (
            <EstimateComboboxSelector
              onValueChange={target.fields.estimate.set}
              openRef={estimateOpenRef}
              trigger={hiddenTrigger}
              triggerLabel="Context menu estimate picker"
              value={target.fields.estimate.value}
            />
          ) : null}
          {target.fields.dueDate.set ? (
            <DueDateSelector
              onValueChange={target.fields.dueDate.set}
              openRef={dueDateOpenRef}
              trigger={hiddenTrigger}
              value={target.fields.dueDate.value}
            />
          ) : null}
          {target.fields.team.set ? (
            <TeamComboboxSelector
              disabled={teamOptions.length === 0}
              memberTeamIds={memberTeamIds}
              onValueChange={target.fields.team.set}
              openRef={teamOpenRef}
              options={teamOptions}
              trigger={hiddenTrigger}
              value={target.fields.team.value}
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          {target.fields.status.set ? (
            <ContextMenuItem
              disabled={statusItems.length === 0}
              onClick={() => openPicker(statusOpenRef)}
            >
              <WorkflowStatusIcon taskState={rowState} />
              Status
              <ContextMenuShortcut>S</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {target.fields.assignee.set ? (
            <ContextMenuItem onClick={() => openPicker(assigneeOpenRef)}>
              <User />
              Assignee
              <ContextMenuShortcut>A</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {target.fields.estimate.set ? (
            <ContextMenuItem onClick={() => openPicker(estimateOpenRef)}>
              <Triangle />
              Estimate
              <ContextMenuShortcut>⇧E</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {target.fields.labels.set ? (
            <ContextMenuItem onClick={() => openPicker(labelsOpenRef)}>
              <Tag />
              Labels
              <ContextMenuShortcut>L</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {target.fields.dueDate.set ? (
            <ContextMenuItem onClick={() => openPicker(dueDateOpenRef)}>
              <CalendarDays />
              Due date
              <ContextMenuShortcut>D</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          {target.fields.team.set ? (
            <ContextMenuItem onClick={() => openPicker(teamOpenRef)}>
              <Users />
              Team
              <ContextMenuShortcut>T</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
        </ContextMenuGroup>

        {target.actions.transition ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <CircleCheck />
                Mark as
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => target.actions.transition?.("complete")}>
                  <CircleCheck className="text-emerald-500" />
                  Complete
                </ContextMenuItem>
                <ContextMenuItem onClick={() => target.actions.transition?.("cancel")}>
                  <Ban />
                  Canceled
                </ContextMenuItem>
                <ContextMenuItem onClick={() => target.actions.transition?.("reopen")}>
                  <RotateCcw />
                  Reopen
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}

        {target.actions.copyId ||
        target.actions.copyLink ||
        target.actions.copyTitle ||
        target.actions.copyMarkdown ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Copy />
                Copy
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52">
                {target.actions.copyId ? (
                  <ContextMenuItem
                    onClick={() => void copyText(target.actions.copyId?.() ?? "", "ID")}
                  >
                    <Hash />
                    Copy ID
                  </ContextMenuItem>
                ) : null}
                {target.actions.copyLink ? (
                  <ContextMenuItem
                    onClick={() => void copyText(target.actions.copyLink?.() ?? "", "Link")}
                  >
                    <LinkIcon />
                    Copy link
                  </ContextMenuItem>
                ) : null}
                {target.actions.copyTitle ? (
                  <ContextMenuItem
                    onClick={() => void copyText(target.actions.copyTitle?.() ?? "", "Title")}
                  >
                    <Copy />
                    Copy title
                  </ContextMenuItem>
                ) : null}
                {target.actions.copyMarkdown ? (
                  <ContextMenuItem
                    onClick={() => void copyText(target.actions.copyMarkdown?.() ?? "", "Markdown")}
                  >
                    <FileText />
                    Copy as Markdown
                  </ContextMenuItem>
                ) : null}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}

        {target.actions.open ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => target.actions.open?.()}>
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
