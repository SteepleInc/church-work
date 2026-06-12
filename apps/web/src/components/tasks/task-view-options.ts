import { Schema } from "effect";

import { lenientSearchField } from "@/shared/lenient-search";

/**
 * View Options (see CONTEXT.md): the presentation settings for the active
 * Saved View carried in the URL under the `view` search key, so a shared link
 * reproduces exactly what its sender sees. Absent fields mean "use the Saved
 * View's default". View Tabs travel separately under the `tab` key.
 */

export const TaskViewModeSchema = Schema.Literal("list", "board");
export type TaskViewMode = typeof TaskViewModeSchema.Type;

export const TaskViewGroupingSchema = Schema.Literal(
  "workflow_status",
  "task_state",
  "assignee",
  "team",
);
export type TaskViewGrouping = typeof TaskViewGroupingSchema.Type;

export const TaskViewOrderingSchema = Schema.Literal("created", "due_date");
export type TaskViewOrdering = typeof TaskViewOrderingSchema.Type;

export const TaskDisplayPropertySchema = Schema.Literal(
  "status",
  "id",
  "assignee",
  "due_date",
  "team",
  "created",
  "parent",
  "priority",
  "estimate",
);
export type TaskDisplayProperty = typeof TaskDisplayPropertySchema.Type;

export const TaskViewOptionsSchema = Schema.Struct({
  mode: Schema.optional(TaskViewModeSchema),
  grouping: Schema.optional(TaskViewGroupingSchema),
  ordering: Schema.optional(TaskViewOrderingSchema),
  showSubtasks: Schema.optional(Schema.Boolean),
  showEmptyColumns: Schema.optional(Schema.Boolean),
  displayProperties: Schema.optional(Schema.Array(TaskDisplayPropertySchema)),
});
export type TaskViewOptions = typeof TaskViewOptionsSchema.Type;

export type ResolvedTaskViewOptions = {
  readonly mode: TaskViewMode;
  readonly grouping: TaskViewGrouping;
  readonly ordering: TaskViewOrdering;
  readonly showSubtasks: boolean;
  readonly showEmptyColumns: boolean;
  readonly displayProperties: readonly TaskDisplayProperty[];
};

export const TASK_DISPLAY_PROPERTIES: ReadonlyArray<{
  readonly value: TaskDisplayProperty;
  readonly label: string;
}> = [
  { value: "status", label: "Status" },
  { value: "id", label: "ID" },
  { value: "assignee", label: "Assignee" },
  { value: "due_date", label: "Due date" },
  { value: "team", label: "Team" },
  { value: "created", label: "Created" },
  { value: "parent", label: "Parent" },
  { value: "priority", label: "Priority" },
  { value: "estimate", label: "Estimate" },
];

export const DEFAULT_TASK_VIEW_OPTIONS: ResolvedTaskViewOptions = {
  mode: "board",
  grouping: "workflow_status",
  ordering: "created",
  showSubtasks: true,
  showEmptyColumns: true,
  // All display properties on by default except Team.
  displayProperties: TASK_DISPLAY_PROPERTIES.map((property) => property.value).filter(
    (property) => property !== "team",
  ),
};

export function resolveTaskViewOptions(view: TaskViewOptions | undefined): ResolvedTaskViewOptions {
  return {
    mode: view?.mode ?? DEFAULT_TASK_VIEW_OPTIONS.mode,
    grouping: view?.grouping ?? DEFAULT_TASK_VIEW_OPTIONS.grouping,
    ordering: view?.ordering ?? DEFAULT_TASK_VIEW_OPTIONS.ordering,
    showSubtasks: view?.showSubtasks ?? DEFAULT_TASK_VIEW_OPTIONS.showSubtasks,
    showEmptyColumns: view?.showEmptyColumns ?? DEFAULT_TASK_VIEW_OPTIONS.showEmptyColumns,
    displayProperties: view?.displayProperties ?? DEFAULT_TASK_VIEW_OPTIONS.displayProperties,
  };
}

function sameDisplayProperties(
  left: readonly TaskDisplayProperty[],
  right: readonly TaskDisplayProperty[],
): boolean {
  return left.length === right.length && left.every((property) => right.includes(property));
}

/**
 * Strip default-valued fields so a clean configuration produces a clean URL
 * (no `view` key at all).
 */
export function toTaskViewSearchValue(view: ResolvedTaskViewOptions): TaskViewOptions | undefined {
  const next: TaskViewOptions = {
    ...(view.mode !== DEFAULT_TASK_VIEW_OPTIONS.mode ? { mode: view.mode } : {}),
    ...(view.grouping !== DEFAULT_TASK_VIEW_OPTIONS.grouping ? { grouping: view.grouping } : {}),
    ...(view.ordering !== DEFAULT_TASK_VIEW_OPTIONS.ordering ? { ordering: view.ordering } : {}),
    ...(view.showSubtasks !== DEFAULT_TASK_VIEW_OPTIONS.showSubtasks
      ? { showSubtasks: view.showSubtasks }
      : {}),
    ...(view.showEmptyColumns !== DEFAULT_TASK_VIEW_OPTIONS.showEmptyColumns
      ? { showEmptyColumns: view.showEmptyColumns }
      : {}),
    ...(sameDisplayProperties(view.displayProperties, DEFAULT_TASK_VIEW_OPTIONS.displayProperties)
      ? {}
      : { displayProperties: view.displayProperties }),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

// --- View Tabs ---------------------------------------------------------------

export const MyWorkViewTabSchema = Schema.Literal("assigned", "created");
export type MyWorkViewTab = typeof MyWorkViewTabSchema.Type;

export const ChurchWorkViewTabSchema = Schema.Literal("all", "active", "done");
export type ChurchWorkViewTab = typeof ChurchWorkViewTabSchema.Type;

export type TaskViewTab = MyWorkViewTab | ChurchWorkViewTab;

type TaskViewSurface = "my_work" | "our_work" | "team_board";

export function getTaskViewTabs(
  surface: TaskViewSurface,
): ReadonlyArray<{ readonly value: TaskViewTab; readonly label: string }> {
  if (surface === "my_work") {
    return [
      { value: "assigned", label: "Assigned" },
      { value: "created", label: "Created" },
    ];
  }

  return [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "done", label: "Done" },
  ];
}

export function getDefaultTaskViewTab(surface: TaskViewSurface): TaskViewTab {
  return surface === "my_work" ? "assigned" : "active";
}

export function resolveTaskViewTab(
  surface: TaskViewSurface,
  tab: TaskViewTab | undefined,
): TaskViewTab {
  const tabs = getTaskViewTabs(surface);
  return tab && tabs.some((candidate) => candidate.value === tab)
    ? tab
    : getDefaultTaskViewTab(surface);
}

// --- URL search schemas for the task routes ----------------------------------

export const MyWorkSearchSchema = Schema.Struct({
  tab: lenientSearchField(MyWorkViewTabSchema),
  view: lenientSearchField(TaskViewOptionsSchema),
});

export const ChurchWorkSearchSchema = Schema.Struct({
  tab: lenientSearchField(ChurchWorkViewTabSchema),
  view: lenientSearchField(TaskViewOptionsSchema),
});

export type TaskViewSearch = {
  readonly tab?: TaskViewTab;
  readonly view?: TaskViewOptions;
};
