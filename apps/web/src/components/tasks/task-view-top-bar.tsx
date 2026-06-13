import {
  ChartNoAxesColumn,
  Kanban,
  List,
  ListFilter,
  PanelRight,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { ExecutionSurface } from "@/components/tasks/task-execution-surface-utils";
import {
  DEFAULT_TASK_VIEW_OPTIONS,
  getTaskViewTabs,
  TASK_DISPLAY_PROPERTIES,
  toTaskViewSearchValue,
  type ResolvedTaskViewOptions,
  type TaskDisplayProperty,
  type TaskViewGrouping,
  type TaskViewOrdering,
  type TaskViewTab,
} from "@/components/tasks/task-view-options";

type TaskViewTopBarProps = {
  readonly surface: ExecutionSurface;
  readonly tab: TaskViewTab;
  readonly onTabChange: (tab: TaskViewTab) => void;
  readonly view: ResolvedTaskViewOptions;
  readonly onViewChange: (view: ResolvedTaskViewOptions) => void;
  readonly onCreateTask?: () => void;
  readonly insightsOpen?: boolean;
  readonly onToggleInsights?: () => void;
};

const GROUPING_OPTIONS: ReadonlyArray<{
  readonly value: TaskViewGrouping;
  readonly label: string;
}> = [
  { value: "workflow_status", label: "Workflow Status" },
  { value: "task_state", label: "Task State" },
  { value: "assignee", label: "Assignee" },
  { value: "team", label: "Team" },
  { value: "estimate", label: "Estimate" },
];

const ORDERING_OPTIONS: ReadonlyArray<{
  readonly value: TaskViewOrdering;
  readonly label: string;
}> = [
  { value: "created", label: "Created" },
  { value: "due_date", label: "Due date" },
];

/**
 * The per-surface top bar: View Tabs on the left; Create Task and the icon
 * cluster on the right. The filter, insights, and breakdown-panel buttons are
 * intentionally inert stubs — the surface area ships first, the features land
 * behind it.
 */
export function TaskViewTopBar({
  surface,
  tab,
  onTabChange,
  view,
  onViewChange,
  onCreateTask,
  insightsOpen = false,
  onToggleInsights,
}: TaskViewTopBarProps) {
  const tabs = getTaskViewTabs(surface);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div aria-label="View Tabs" className="flex items-center gap-1" role="tablist">
        {tabs.map((candidate) => {
          const isActive = candidate.value === tab;

          return (
            <Button
              aria-selected={isActive}
              className="rounded-full"
              key={candidate.value}
              onClick={() => onTabChange(candidate.value)}
              role="tab"
              size="sm"
              type="button"
              variant={isActive ? "secondary" : "ghost"}
            >
              {candidate.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        {onCreateTask ? (
          <Button onClick={onCreateTask} size="sm" type="button">
            Create Task
          </Button>
        ) : null}
        <Button aria-label="Filter" size="icon-sm" type="button" variant="ghost">
          <ListFilter />
        </Button>
        <TaskViewOptionsPopover onViewChange={onViewChange} view={view} />
        <Button
          aria-label="Insights"
          aria-pressed={insightsOpen}
          onClick={onToggleInsights}
          size="icon-sm"
          type="button"
          variant={insightsOpen ? "secondary" : "ghost"}
        >
          <ChartNoAxesColumn />
        </Button>
        <Button aria-label="Breakdown panel" size="icon-sm" type="button" variant="ghost">
          <PanelRight />
        </Button>
      </div>
    </div>
  );
}

function TaskViewOptionsPopover({
  view,
  onViewChange,
}: {
  readonly view: ResolvedTaskViewOptions;
  readonly onViewChange: (view: ResolvedTaskViewOptions) => void;
}) {
  const toggleDisplayProperty = (property: TaskDisplayProperty) => {
    const isShown = view.displayProperties.includes(property);
    onViewChange({
      ...view,
      displayProperties: isShown
        ? view.displayProperties.filter((candidate) => candidate !== property)
        : [...view.displayProperties, property],
    });
  };

  const isDefaultView = toTaskViewSearchValue(view) === undefined;

  return (
    <Popover>
      <PopoverTrigger
        render={<Button aria-label="View Options" size="icon-sm" type="button" variant="ghost" />}
      >
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 text-xs">
        <div className="grid gap-1.5 p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              className="justify-center"
              size="xs"
              type="button"
              // List mode is a stub: the option ships before the view does.
              disabled
              variant={view.mode === "list" ? "secondary" : "outline"}
            >
              <List /> List
            </Button>
            <Button
              className="justify-center"
              onClick={() => onViewChange({ ...view, mode: "board" })}
              size="xs"
              type="button"
              variant={view.mode === "board" ? "secondary" : "outline"}
            >
              <Kanban /> Board
            </Button>
          </div>

          <div className="grid h-7 grid-cols-[1fr_auto] items-center gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal">Columns</Label>
            <Select
              items={GROUPING_OPTIONS}
              onValueChange={(value) =>
                onViewChange({ ...view, grouping: value as TaskViewGrouping })
              }
              value={view.grouping}
            >
              <SelectTrigger aria-label="Columns" className="h-6 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false} className="w-auto min-w-40">
                {GROUPING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid h-7 grid-cols-[1fr_auto] items-center gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal">Ordering</Label>
            <Select
              items={ORDERING_OPTIONS}
              onValueChange={(value) =>
                onViewChange({ ...view, ordering: value as TaskViewOrdering })
              }
              value={view.ordering}
            >
              <SelectTrigger aria-label="Ordering" className="h-6 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false} className="w-auto min-w-40">
                {ORDERING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="p-1.5">
          <div className="flex h-6 items-center justify-between gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal" htmlFor="show-subtasks">
              Show sub-tasks
            </Label>
            <Switch
              checked={view.showSubtasks}
              className="scale-90"
              id="show-subtasks"
              onCheckedChange={(checked) => onViewChange({ ...view, showSubtasks: checked })}
            />
          </div>
        </div>

        <Separator />

        <div className="grid gap-1 p-1.5">
          <p className="text-muted-foreground px-1 text-xs font-medium">Board options</p>

          <div className="flex h-6 items-center justify-between gap-2 px-1">
            <Label
              className="text-muted-foreground text-xs font-normal"
              htmlFor="show-empty-columns"
            >
              Show empty columns
            </Label>
            <Switch
              checked={view.showEmptyColumns}
              className="scale-90"
              id="show-empty-columns"
              onCheckedChange={(checked) => onViewChange({ ...view, showEmptyColumns: checked })}
            />
          </div>

          <div className="grid gap-1 px-1 pb-0.5">
            <p className="text-muted-foreground text-xs font-normal">Display properties</p>
            <div className="flex flex-wrap gap-1">
              {TASK_DISPLAY_PROPERTIES.map((property) => {
                const isShown = view.displayProperties.includes(property.value);

                return (
                  <button
                    aria-pressed={isShown}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-xs transition-colors",
                      isShown
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                    key={property.value}
                    onClick={() => toggleDisplayProperty(property.value)}
                    type="button"
                  >
                    {property.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex h-8 items-center justify-end px-1.5">
          <Button
            className="text-muted-foreground"
            disabled={isDefaultView}
            onClick={() => onViewChange({ ...DEFAULT_TASK_VIEW_OPTIONS })}
            size="xs"
            type="button"
            variant="ghost"
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
