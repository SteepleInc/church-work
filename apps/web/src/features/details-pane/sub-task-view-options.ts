/**
 * Local presentation settings for the Sub-tasks section of the Task details
 * pane. Unlike the task overview's View Options (URL-carried, shareable), these
 * are local UI state for a single open Task and are not persisted.
 *
 * They intentionally use a Sub-task-specific display-property enum rather than
 * the overview's `TaskDisplayProperty`: the sub-task list shows Week/Cycle and
 * has no use for a "Parent" column, and the two surfaces may diverge further.
 */

export type SubTaskOrdering =
  | "priority"
  | "created"
  | "due_date"
  | "status"
  | "assignee"
  | "estimate";

export const SUB_TASK_ORDERING_OPTIONS: ReadonlyArray<{
  readonly value: SubTaskOrdering;
  readonly label: string;
}> = [
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "due_date", label: "Due date" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "estimate", label: "Estimate" },
];

/** Which completed sub-tasks are shown. The denominator of the completion count
 * is unaffected by this filter (see CONTEXT.md / grilling decisions). */
export type SubTaskCompletedFilter = "all" | "hide_completed" | "only_completed";

export const SUB_TASK_COMPLETED_OPTIONS: ReadonlyArray<{
  readonly value: SubTaskCompletedFilter;
  readonly label: string;
}> = [
  { value: "all", label: "All" },
  { value: "hide_completed", label: "Hide completed" },
  { value: "only_completed", label: "Only completed" },
];

export type SubTaskDisplayProperty =
  | "status"
  | "priority"
  | "assignee"
  | "estimate"
  | "labels"
  | "cycle"
  | "due_date"
  | "id"
  | "team";

export const SUB_TASK_DISPLAY_PROPERTIES: ReadonlyArray<{
  readonly value: SubTaskDisplayProperty;
  readonly label: string;
}> = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "estimate", label: "Estimate" },
  { value: "labels", label: "Labels" },
  { value: "cycle", label: "Week" },
  { value: "due_date", label: "Due date" },
  { value: "id", label: "ID" },
  { value: "team", label: "Team" },
];

export type SubTaskViewOptions = {
  readonly ordering: SubTaskOrdering;
  readonly completedFilter: SubTaskCompletedFilter;
  readonly nested: boolean;
  readonly displayProperties: readonly SubTaskDisplayProperty[];
};

/** Maximum visual indentation depth; deeper descendants share this level. */
export const SUB_TASK_MAX_INDENT_DEPTH = 4;

export const DEFAULT_SUB_TASK_VIEW_OPTIONS: SubTaskViewOptions = {
  ordering: "priority",
  completedFilter: "all",
  nested: true,
  // On by default: Status, Priority, Assignee, Estimate, Labels, Week.
  // Off by default: Due date, ID, Team.
  displayProperties: ["status", "priority", "assignee", "estimate", "labels", "cycle"],
};
