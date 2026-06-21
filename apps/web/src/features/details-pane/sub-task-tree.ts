import type { TaskStatus } from "@church-task/domain";

import type {
  SubTaskCompletedFilter,
  SubTaskOrdering,
} from "@/features/details-pane/sub-task-view-options";

/**
 * Pure logic for the Task details pane's Sub-tasks section: building the nested
 * tree of descendants, ordering siblings, applying the completed filter while
 * keeping context ancestors, and computing the completion count. Kept free of
 * React so it can be unit-tested directly.
 */

export type SubTaskNodeInput = {
  readonly id: string;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly createdAt: number;
  readonly taskState: TaskStatus;
  readonly priority: "urgent" | "high" | "medium" | "low" | null;
  readonly assignedUserId: string | null;
  readonly estimate: string | null;
  readonly dueDate: string | null;
  readonly workflowStatusSortOrder: number;
};

export type SubTaskNode = {
  readonly task: SubTaskNodeInput;
  /** Zero-based nesting depth relative to the section's root parent. */
  readonly depth: number;
  /** True when the row is shown only to preserve nesting context for a visible
   * descendant under the active completed filter (rendered muted). */
  readonly isContext: boolean;
  readonly children: readonly SubTaskNode[];
};

const COMPLETED_STATES: ReadonlySet<TaskStatus> = new Set<TaskStatus>(["done", "canceled"]);

export function isSubTaskCompleted(task: { readonly taskState: TaskStatus }): boolean {
  return COMPLETED_STATES.has(task.taskState);
}

const PRIORITY_RANK: Record<NonNullable<SubTaskNodeInput["priority"]>, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ESTIMATE_RANK: Record<string, number> = {
  xs: 0,
  s: 1,
  m: 2,
  l: 3,
  xl: 4,
};

function compareSiblings(
  left: SubTaskNodeInput,
  right: SubTaskNodeInput,
  ordering: SubTaskOrdering,
): number {
  switch (ordering) {
    case "priority": {
      // No priority sorts last; otherwise urgent → low.
      const leftRank = left.priority ? PRIORITY_RANK[left.priority] : 99;
      const rightRank = right.priority ? PRIORITY_RANK[right.priority] : 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.createdAt - right.createdAt;
    }
    case "created":
      return left.createdAt - right.createdAt;
    case "due_date": {
      // Tasks without a due date sort last.
      const leftDue = left.dueDate ?? "\uffff";
      const rightDue = right.dueDate ?? "\uffff";
      if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
      return left.createdAt - right.createdAt;
    }
    case "status": {
      if (left.workflowStatusSortOrder !== right.workflowStatusSortOrder) {
        return left.workflowStatusSortOrder - right.workflowStatusSortOrder;
      }
      return left.createdAt - right.createdAt;
    }
    case "assignee": {
      const leftAssignee = left.assignedUserId ?? "\uffff";
      const rightAssignee = right.assignedUserId ?? "\uffff";
      if (leftAssignee !== rightAssignee) return leftAssignee < rightAssignee ? -1 : 1;
      return left.createdAt - right.createdAt;
    }
    case "estimate": {
      const leftRank = left.estimate ? (ESTIMATE_RANK[left.estimate] ?? 98) : 99;
      const rightRank = right.estimate ? (ESTIMATE_RANK[right.estimate] ?? 98) : 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.createdAt - right.createdAt;
    }
  }
}

/**
 * Builds the ordered, filtered sub-task tree for a parent Task.
 *
 * - `nested === false`: only direct children of `parentId` are returned (depth 0).
 * - `nested === true`: all descendants are returned, recursively nested.
 *
 * The completed filter hides rows, but a hidden row is still emitted as a muted
 * context node when it has at least one visible descendant, so nesting paths
 * stay intact (grilling decision: option 3, both directions).
 */
export function buildSubTaskTree(args: {
  readonly parentId: string;
  readonly tasks: readonly SubTaskNodeInput[];
  readonly nested: boolean;
  readonly ordering: SubTaskOrdering;
  readonly completedFilter: SubTaskCompletedFilter;
}): readonly SubTaskNode[] {
  const childrenByParent = new Map<string, SubTaskNodeInput[]>();
  for (const task of args.tasks) {
    if (task.parentTaskId === null) continue;
    const bucket = childrenByParent.get(task.parentTaskId);
    if (bucket) bucket.push(task);
    else childrenByParent.set(task.parentTaskId, [task]);
  }

  const matchesFilter = (task: SubTaskNodeInput): boolean => {
    if (args.completedFilter === "all") return true;
    const completed = isSubTaskCompleted(task);
    return args.completedFilter === "hide_completed" ? !completed : completed;
  };

  const buildNodes = (parentId: string, depth: number): SubTaskNode[] => {
    const direct = [...(childrenByParent.get(parentId) ?? [])].sort((left, right) =>
      compareSiblings(left, right, args.ordering),
    );

    const nodes: SubTaskNode[] = [];
    for (const task of direct) {
      const children = args.nested ? buildNodes(task.id, depth + 1) : [];
      const selfMatches = matchesFilter(task);

      if (selfMatches) {
        nodes.push({ task, depth, isContext: false, children });
      } else if (children.length > 0) {
        // Hidden by the filter, but kept as a context ancestor so the visible
        // descendants below it still read as nested.
        nodes.push({ task, depth, isContext: true, children });
      }
    }
    return nodes;
  };

  return buildNodes(args.parentId, 0);
}

/**
 * Completion count for the section header (e.g. `2/5`). Honors the nested scope
 * but ignores the completed-visibility filter (grilling decision), so toggling
 * "Hide completed" never changes the denominator.
 */
export function computeSubTaskCompletion(args: {
  readonly parentId: string;
  readonly tasks: readonly SubTaskNodeInput[];
  readonly nested: boolean;
}): { readonly completed: number; readonly total: number } {
  const childrenByParent = new Map<string, SubTaskNodeInput[]>();
  for (const task of args.tasks) {
    if (task.parentTaskId === null) continue;
    const bucket = childrenByParent.get(task.parentTaskId);
    if (bucket) bucket.push(task);
    else childrenByParent.set(task.parentTaskId, [task]);
  }

  let completed = 0;
  let total = 0;

  const walk = (parentId: string) => {
    for (const task of childrenByParent.get(parentId) ?? []) {
      total += 1;
      if (isSubTaskCompleted(task)) completed += 1;
      if (args.nested) walk(task.id);
    }
  };

  walk(args.parentId);
  return { completed, total };
}
