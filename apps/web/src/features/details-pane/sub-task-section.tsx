import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { statusOptions } from "@/components/tasks/task-kanban-board-utils";
import { Button } from "@/components/ui/button";
import { SubTaskCreator, type SubTaskCreateInput } from "@/features/details-pane/sub-task-creator";
import { SubTaskOptionsPopover } from "@/features/details-pane/sub-task-options-popover";
import {
  SubTaskHoverProvider,
  useSubTaskHoverShortcuts,
} from "@/features/details-pane/sub-task-row-shortcuts";
import {
  SubTaskRows,
  type SubTaskRowContext,
  type SubTaskRowTask,
} from "@/features/details-pane/sub-task-row";
import {
  buildSubTaskTree,
  computeSubTaskCompletion,
  type SubTaskNode,
  type SubTaskNodeInput,
} from "@/features/details-pane/sub-task-tree";
import {
  DEFAULT_SUB_TASK_VIEW_OPTIONS,
  type SubTaskViewOptions,
} from "@/features/details-pane/sub-task-view-options";
import type { TaskCollectionItem } from "@/data/tasks/tasksData.app";

type Team = { readonly id: string; readonly name: string; readonly color: string | null };
type Label = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly teamId: string | null;
};
type SubTaskEditFields = Parameters<SubTaskRowContext["onEdit"]>[1];
type WorkflowStatus = {
  readonly id: string;
  readonly workflowId: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly taskState: "todo" | "in_progress" | "done" | "canceled";
  readonly archivedAt: string | null;
};

/**
 * The Task details pane's Sub-tasks section: a quiet "+ Add sub-task" opener
 * that expands into an inline creator, the completion count, a local options
 * menu (ordering / completed filter / nesting / display properties), and the
 * nested, inline-editable sub-task rows.
 */
export function SubTaskSection({
  parentTask,
  allTasks,
  teams,
  labels,
  workflowStatuses,
  assigneeOptions,
  currentUserId,
  teamMemberships,
  weekLabelByCycleId,
  defaultPriority,
  onOpenTask,
  onCreateSubTask,
  onCreateSubTasks,
  onEditTask,
  onCreateLabel,
}: {
  readonly parentTask: TaskCollectionItem;
  readonly allTasks: readonly TaskCollectionItem[];
  readonly teams: readonly Team[];
  readonly labels: readonly Label[];
  readonly workflowStatuses: readonly WorkflowStatus[];
  readonly assigneeOptions: readonly { readonly id: string; readonly label: string }[];
  readonly currentUserId: string | null;
  readonly teamMemberships: readonly { readonly teamId: string; readonly userId: string }[];
  readonly weekLabelByCycleId: ReadonlyMap<string, string>;
  readonly defaultPriority: "no_priority" | "urgent" | "high" | "medium" | "low";
  readonly onOpenTask: (identifier: string) => void;
  readonly onCreateSubTask: (input: SubTaskCreateInput) => Promise<boolean>;
  readonly onCreateSubTasks: (inputs: readonly SubTaskCreateInput[]) => Promise<boolean>;
  readonly onEditTask: (taskId: string, fields: SubTaskEditFields) => void;
  readonly onCreateLabel?: (name: string) => Promise<string | null>;
}) {
  const [view, setView] = useState<SubTaskViewOptions>(DEFAULT_SUB_TASK_VIEW_OPTIONS);
  const [creating, setCreating] = useState(false);
  const hoverShortcuts = useSubTaskHoverShortcuts();

  const statusSortById = useMemo(
    () => new Map(workflowStatuses.map((status) => [status.id, status.sortOrder])),
    [workflowStatuses],
  );

  const nodeInputs = useMemo<readonly SubTaskNodeInput[]>(
    () =>
      allTasks.map((task) => ({
        id: task.id,
        parentTaskId: task.parentTaskId,
        title: task.title,
        createdAt: task.createdAt,
        taskState: task.taskState,
        priority: task.priority,
        assignedUserId: task.assignedUserId,
        estimate: task.estimate,
        dueDate: task.dueDate,
        workflowStatusSortOrder: statusSortById.get(task.workflowStatusId) ?? 999,
      })),
    [allTasks, statusSortById],
  );

  const tree = useMemo(
    () =>
      buildSubTaskTree({
        parentId: parentTask.id,
        tasks: nodeInputs,
        nested: view.nested,
        ordering: view.ordering,
        completedFilter: view.completedFilter,
      }),
    [parentTask.id, nodeInputs, view.nested, view.ordering, view.completedFilter],
  );

  const completion = useMemo(
    () =>
      computeSubTaskCompletion({
        parentId: parentTask.id,
        tasks: nodeInputs,
        nested: view.nested,
      }),
    [parentTask.id, nodeInputs, view.nested],
  );

  const displayPropertySet = useMemo(
    () => new Set(view.displayProperties),
    [view.displayProperties],
  );
  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.id, task])), [allTasks]);

  const labelAppliesToTeam = (labelId: string, teamId: string) => {
    const label = labels.find((candidate) => candidate.id === labelId);
    return !label || label.teamId === null || label.teamId === teamId;
  };

  const labelOptionsForTeam = (teamId: string) =>
    labels
      .filter((label) => label.teamId === null || label.teamId === teamId)
      .map((label) => ({ id: label.id, name: label.name, color: label.color }));

  const teamMemberIdsForTeam = (teamId: string) =>
    new Set(
      teamMemberships.filter((membership) => membership.teamId === teamId).map((m) => m.userId),
    );

  const depthById = useMemo(() => {
    const map = new Map<string, number>();
    const walk = (nodes: readonly SubTaskNode[]) => {
      for (const node of nodes) {
        map.set(node.task.id, node.depth);
        walk(node.children);
      }
    };
    walk(tree);
    return map;
  }, [tree]);

  const toRowTask = (id: string): SubTaskRowTask | null => {
    const task = taskById.get(id);
    if (!task) return null;
    const depth = depthById.get(id) ?? 0;
    return {
      id: task.id,
      parentTaskId: task.parentTaskId,
      title: task.title,
      createdAt: task.createdAt,
      taskState: task.taskState,
      priority: task.priority,
      assignedUserId: task.assignedUserId,
      estimate: task.estimate,
      dueDate: task.dueDate,
      workflowStatusSortOrder: statusSortById.get(task.workflowStatusId) ?? 999,
      depth,
      identifier: task.identifier,
      labelIds: task.labelIds,
      workflowStatusId: task.workflowStatusId,
      teamId: task.teamId,
    };
  };

  const memberTeamIds = useMemo(
    () =>
      new Set(
        teamMemberships
          .filter((membership) => membership.userId === currentUserId)
          .map((membership) => membership.teamId),
      ),
    [teamMemberships, currentUserId],
  );

  return (
    <section aria-label="Sub-tasks" className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
          Sub-tasks
          {completion.total > 0 ? (
            <span className="font-normal text-muted-foreground">
              {completion.completed}/{completion.total}
            </span>
          ) : null}
        </h3>
        <div className="flex items-center gap-0.5">
          {completion.total > 0 ? (
            <SubTaskOptionsPopover onViewChange={setView} view={view} />
          ) : null}
          <Button
            aria-label="Add sub-task"
            onClick={() => setCreating(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Plus />
          </Button>
        </div>
      </div>

      {tree.length > 0 ? (
        <SubTaskHoverProvider value={hoverShortcuts}>
          {/* Leaving the rows disarms the hover cursor so the parent Task's own
              field shortcuts (S/P/A/L/⇧E) become live again. */}
          <div onMouseLeave={hoverShortcuts.clearHovered}>
            <SubTaskRows
              context={{
                displayProperties: displayPropertySet,
                statusOptionsForTask: (task) =>
                  statusOptions(
                    workflowStatuses.filter((status) => {
                      const t = taskById.get(task.id);
                      return status.workflowId === (t?.workflowId ?? "");
                    }),
                  ),
                assigneeOptions,
                currentUserId,
                teamMemberIdsForTask: (task) => teamMemberIdsForTeam(task.teamId),
                labelOptionsForTask: (task) => labelOptionsForTeam(task.teamId),
                teamForTask: (task) => {
                  const team = teams.find((candidate) => candidate.id === task.teamId);
                  return team ? { name: team.name, color: team.color } : null;
                },
                weekLabelForTask: (task) => {
                  const t = taskById.get(task.id);
                  return t?.cycleId ? (weekLabelByCycleId.get(t.cycleId) ?? null) : null;
                },
                onOpen: onOpenTask,
                onEdit: onEditTask,
                getRowTask: toRowTask,
              }}
              nodes={tree}
            />
          </div>
        </SubTaskHoverProvider>
      ) : null}

      {creating ? (
        <SubTaskCreator
          assigneeOptions={assigneeOptions}
          currentUserId={currentUserId}
          defaults={{
            assignedUserId: parentTask.assignedUserId,
            teamId: parentTask.teamId,
            priority: defaultPriority,
          }}
          labelAppliesToTeam={labelAppliesToTeam}
          labelOptions={labelOptionsForTeam(parentTask.teamId)}
          memberTeamIds={memberTeamIds}
          onClose={() => setCreating(false)}
          onCreate={onCreateSubTask}
          onCreateLabel={onCreateLabel}
          onCreateMany={onCreateSubTasks}
          teamMemberIds={teamMemberIdsForTeam(parentTask.teamId)}
          teamOptions={teams}
          weekLabel={
            parentTask.cycleId ? (weekLabelByCycleId.get(parentTask.cycleId) ?? null) : null
          }
        />
      ) : tree.length === 0 ? (
        <button
          className="flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
          onClick={() => setCreating(true)}
          type="button"
        >
          <Plus className="size-4" />
          Add sub-task
        </button>
      ) : null}
    </section>
  );
}
