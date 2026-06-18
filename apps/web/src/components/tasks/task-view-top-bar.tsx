import { Kanban, List, ListFilter, PanelRight, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type MutableRefObject } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

import type { ColumnConfig, FilterItem } from "@/components/data-table-filter/core/types";
import type { ExecutionSurface } from "@/components/tasks/task-execution-surface-utils";
import { TaskFilterAddMenu, TaskFilterChips } from "@/components/tasks/task-filters-bar";
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
  readonly filterFields?: ReadonlyArray<ColumnConfig<unknown>>;
  readonly filters?: readonly FilterItem[];
  readonly onFiltersChange?: (filters: FilterItem[]) => void;
  // Imperative opener populated for the keyboard layer: Shift+V opens View
  // Options. The route passes a mutable ref the keyboard layer calls. (Filter's
  // `F` shortcut is handled natively by TaskFilterAddMenu.)
  readonly openDisplayOptionsRef?: MutableRefObject<(() => void) | null>;
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
  filterFields,
  filters,
  onFiltersChange,
  openDisplayOptionsRef,
}: TaskViewTopBarProps) {
  const tabs = getTaskViewTabs(surface);
  const canFilter = Boolean(filterFields && onFiltersChange);
  const activeFilters = filters ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div aria-label="View Tabs" className="flex flex-wrap items-center gap-2" role="tablist">
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
        </div>

        <div className="flex items-center gap-1">
          {onCreateTask ? (
            <Button onClick={onCreateTask} size="sm" type="button">
              Create Task
            </Button>
          ) : null}
          {canFilter ? (
            <TaskFilterAddMenu
              fields={filterFields!}
              filters={activeFilters}
              onChange={onFiltersChange!}
              enableShortcut
              trigger={
                <Button aria-label="Filter" size="icon-sm" type="button" variant="ghost">
                  <ListFilter />
                </Button>
              }
            />
          ) : (
            <Button aria-label="Filter" size="icon-sm" type="button" variant="ghost">
              <ListFilter />
            </Button>
          )}
          <TaskViewOptionsPopover
            onViewChange={onViewChange}
            openRef={openDisplayOptionsRef}
            view={view}
          />
          <PanelToggleButton
            insightsOpen={insightsOpen}
            onToggleInsights={onToggleInsights}
            surface={surface}
          />
        </div>
      </div>

      {canFilter && activeFilters.length > 0 ? (
        <TaskFilterChips
          fields={filterFields!}
          filters={activeFilters}
          onChange={onFiltersChange!}
        />
      ) : null}
    </div>
  );
}

/**
 * The right-pane toggle in the top bar — the sidebar affordance (Linear's right
 * panel). On a Team Week board the pane is Week Progress (a gauge of
 * Started/Completed against Scope); everywhere else it is the chart-driven
 * Insights pane. The label and tooltip switch with the surface so the button
 * never promises a chart it will not show. Mirrors the Cmd/Ctrl+I shortcut the
 * keyboard layer fires, surfaced in the tooltip like Linear.
 */
function PanelToggleButton({
  surface,
  insightsOpen,
  onToggleInsights,
}: {
  readonly surface: ExecutionSurface;
  readonly insightsOpen: boolean;
  readonly onToggleInsights?: () => void;
}) {
  const label = surface === "team_board" ? "Week Progress" : "Insights";
  const tooltip = insightsOpen ? `Hide ${label}` : `Show ${label}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={insightsOpen}
            onClick={onToggleInsights}
            size="icon-sm"
            type="button"
            variant={insightsOpen ? "secondary" : "ghost"}
          />
        }
      >
        <PanelRight />
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-1.5">
        <span>{tooltip}</span>
        <kbd className="bg-muted text-muted-foreground rounded px-1 text-[10px] font-medium">
          ⌘ I
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function TaskViewOptionsPopover({
  view,
  onViewChange,
  openRef,
}: {
  readonly view: ResolvedTaskViewOptions;
  readonly onViewChange: (view: ResolvedTaskViewOptions) => void;
  readonly openRef?: MutableRefObject<(() => void) | null>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => setOpen(true);
    return () => {
      openRef.current = null;
    };
  }, [openRef]);

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
    <Popover open={open} onOpenChange={setOpen}>
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
              onClick={() => onViewChange({ ...view, mode: "list" })}
              size="xs"
              type="button"
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
