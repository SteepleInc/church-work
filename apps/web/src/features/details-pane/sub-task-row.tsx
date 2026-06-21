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
  WorkflowStatusIcon,
  type CardSelectOption,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { useRegisterSubTaskRow } from "@/features/details-pane/sub-task-row-shortcuts";
import {
  SUB_TASK_MAX_INDENT_DEPTH,
  type SubTaskDisplayProperty,
} from "@/features/details-pane/sub-task-view-options";
import type { SubTaskNode } from "@/features/details-pane/sub-task-tree";
import { cn } from "@/lib/utils";
import { useMemo, useRef, type MutableRefObject } from "react";

export type SubTaskRowTask = SubTaskNode["task"] & {
  readonly depth: number;
  readonly identifier: string;
  readonly labelIds: readonly string[];
  readonly workflowStatusId: string;
  readonly teamId: string;
};

/** Estimate value as persisted (no UI "no_estimate" sentinel). */
type PersistedEstimate = Exclude<TaskEstimate, "no_estimate">;

export type SubTaskRowContext = {
  readonly displayProperties: ReadonlySet<SubTaskDisplayProperty>;
  readonly statusOptionsForTask: (task: SubTaskRowTask) => readonly CardSelectOption<string>[];
  readonly assigneeOptions: readonly { readonly id: string; readonly label: string }[];
  readonly currentUserId: string | null;
  readonly teamMemberIdsForTask: (task: SubTaskRowTask) => ReadonlySet<string>;
  readonly labelOptionsForTask: (
    task: SubTaskRowTask,
  ) => readonly { readonly id: string; readonly name: string; readonly color: string }[];
  readonly teamForTask: (
    task: SubTaskRowTask,
  ) => { readonly name: string; readonly color: string | null } | null;
  readonly weekLabelForTask: (task: SubTaskRowTask) => string | null;
  readonly onOpen: (identifier: string) => void;
  readonly onEdit: (
    taskId: string,
    fields: {
      readonly workflowStatusId?: string;
      readonly assignedUserId?: string | null;
      readonly priority?: "urgent" | "high" | "medium" | "low" | null;
      readonly estimate?: PersistedEstimate | null;
      readonly labelIds?: readonly string[];
      readonly dueDate?: string | null;
    },
  ) => void;
  readonly getRowTask: (id: string) => SubTaskRowTask | null;
};

/** Renders a sub-task node and (recursively) its visible descendants. */
export function SubTaskRows({
  nodes,
  context,
}: {
  readonly nodes: readonly SubTaskNode[];
  readonly context: SubTaskRowContext;
}) {
  return (
    <div className="grid gap-1.5">
      {nodes.map((node) => (
        <SubTaskNodeRows context={context} key={node.task.id} node={node} />
      ))}
    </div>
  );
}

function SubTaskNodeRows({
  node,
  context,
}: {
  readonly node: SubTaskNode;
  readonly context: SubTaskRowContext;
}) {
  const rowTask = context.getRowTask(node.task.id);
  return (
    <>
      {rowTask ? <SubTaskRow context={context} isContext={node.isContext} task={rowTask} /> : null}
      {node.children.length > 0 ? (
        <div className="grid gap-1.5">
          {node.children.map((child) => (
            <SubTaskNodeRows context={context} key={child.task.id} node={child} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function SubTaskRow({
  task,
  isContext,
  context,
}: {
  readonly task: SubTaskRowTask;
  readonly isContext: boolean;
  readonly context: SubTaskRowContext;
}) {
  const show = (property: SubTaskDisplayProperty) => context.displayProperties.has(property);
  const depth = Math.min(task.depth ?? 0, SUB_TASK_MAX_INDENT_DEPTH);

  // Each selector publishes an imperative opener; the hover-keyboard layer fires
  // the matching one (S/A/P/L/Shift+E) for the row under the pointer.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const pickers = useMemo<
    Partial<
      Record<
        "status" | "assignee" | "priority" | "labels" | "estimate",
        MutableRefObject<(() => void) | null>
      >
    >
  >(
    () => ({
      status: statusOpenRef,
      assignee: assigneeOpenRef,
      priority: priorityOpenRef,
      labels: labelsOpenRef,
      estimate: estimateOpenRef,
    }),
    [],
  );
  const { onHover } = useRegisterSubTaskRow(task.id, {
    open: () => context.onOpen(task.identifier),
    pickers,
  });

  const priorityMeta = getPriorityMeta((task.priority ?? "no_priority") as TaskPriority);
  const PriorityIcon = priorityMeta.icon;
  const estimateValue = (task.estimate ?? "no_estimate") as TaskEstimate;
  const estimateMeta = getEstimateMeta(estimateValue);
  const selectedAssignee =
    context.assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const labelOptions = context.labelOptionsForTask(task);
  const selectedLabels = task.labelIds
    .map((id) => labelOptions.find((label) => label.id === id))
    .filter((label) => label !== undefined);
  const team = context.teamForTask(task);
  const dueDateLabel = formatDueDate(task.dueDate);
  const weekLabel = context.weekLabelForTask(task);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm transition-colors hover:bg-accent",
        isContext && "opacity-60",
      )}
      data-sub-task-row=""
      onMouseEnter={onHover}
      style={depth > 0 ? { marginLeft: depth * 20 } : undefined}
    >
      {/* Status: icon always visible; the "status" property adds the name. */}
      <StatusComboboxSelector
        emptyText="No statuses."
        onValueChange={(next) => {
          if (next) context.onEdit(task.id, { workflowStatusId: next });
        }}
        openRef={statusOpenRef}
        options={context.statusOptionsForTask(task)}
        trigger={
          <span className="inline-flex cursor-pointer items-center">
            <WorkflowStatusIcon className="size-4 shrink-0" taskState={task.taskState} />
          </span>
        }
        value={task.workflowStatusId}
      />

      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => context.onOpen(task.identifier)}
        type="button"
      >
        {show("id") ? (
          <span className="shrink-0 font-medium text-muted-foreground text-xs">
            {task.identifier}
          </span>
        ) : null}
        <span className="truncate">{task.title}</span>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        {show("priority") ? (
          <PriorityComboboxSelector
            onValueChange={(next) =>
              context.onEdit(task.id, {
                priority: next === "no_priority" ? null : next,
              })
            }
            openRef={priorityOpenRef}
            trigger={
              <RowPill muted={(task.priority ?? "no_priority") === "no_priority"}>
                <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
              </RowPill>
            }
            value={(task.priority ?? "no_priority") as TaskPriority}
          />
        ) : null}

        {show("labels") ? (
          <LabelsComboboxSelector
            onValueChange={(next) => context.onEdit(task.id, { labelIds: next })}
            openRef={labelsOpenRef}
            options={labelOptions}
            trigger={
              // The pill only shows when labels exist; when empty the trigger is
              // a zero-size anchor so the `L` hover shortcut can still open it.
              selectedLabels.length > 0 ? (
                <RowPill>
                  <span className="-space-x-1 flex items-center">
                    {selectedLabels.slice(0, 3).map((label) => (
                      <span
                        className={cn(
                          "size-2.5 rounded-full ring-2 ring-background",
                          labelDotClassName(label),
                        )}
                        key={label.id}
                      />
                    ))}
                  </span>
                </RowPill>
              ) : (
                <span className="sr-only" />
              )
            }
            value={task.labelIds}
          />
        ) : null}

        {show("cycle") && weekLabel ? (
          <span className="hidden text-muted-foreground text-xs sm:inline">{weekLabel}</span>
        ) : null}

        {show("due_date") && dueDateLabel ? (
          <DueDateSelector
            onValueChange={(next) => context.onEdit(task.id, { dueDate: next })}
            trigger={
              <RowPill>
                <span className="text-muted-foreground text-xs">{dueDateLabel}</span>
              </RowPill>
            }
            value={task.dueDate}
          />
        ) : null}

        {show("estimate") ? (
          <EstimateComboboxSelector
            onValueChange={(next) =>
              context.onEdit(task.id, { estimate: next === "no_estimate" ? null : next })
            }
            openRef={estimateOpenRef}
            trigger={
              estimateValue !== "no_estimate" ? (
                <RowPill>
                  <span className="text-muted-foreground text-xs">{estimateMeta.label}</span>
                </RowPill>
              ) : (
                <span className="sr-only" />
              )
            }
            value={estimateValue}
          />
        ) : null}

        {show("team") && team ? (
          <span className="inline-flex items-center">
            <TeamAvatar color={team.color} name={team.name} size={16} />
          </span>
        ) : null}

        {show("assignee") ? (
          <AssigneeComboboxSelector
            align="end"
            currentUserId={context.currentUserId}
            onValueChange={(next) => context.onEdit(task.id, { assignedUserId: next })}
            openRef={assigneeOpenRef}
            options={context.assigneeOptions}
            teamMemberIds={context.teamMemberIdsForTask(task)}
            trigger={
              <span className="inline-flex cursor-pointer items-center">
                <AssigneeAvatar assignee={selectedAssignee} size={20} />
              </span>
            }
            value={task.assignedUserId}
          />
        ) : null}
      </div>
    </div>
  );
}

function RowPill({
  children,
  muted = false,
}: {
  readonly children: React.ReactNode;
  readonly muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border px-1.5 transition-colors hover:bg-accent",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
