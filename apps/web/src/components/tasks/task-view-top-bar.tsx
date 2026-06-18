import {
  CalendarRange,
  ChartNoAxesColumn,
  Kanban,
  List,
  ListFilter,
  PanelRight,
  SlidersHorizontal,
} from "lucide-react";
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
  type TaskWeekScope,
  type TaskViewTab,
} from "@/components/tasks/task-view-options";

type TaskViewTopBarProps = {
  readonly surface: ExecutionSurface;
  readonly tab: TaskViewTab;
  readonly onTabChange: (tab: TaskViewTab) => void;
  readonly scope?: TaskWeekScope;
  readonly onScopeChange?: (scope: TaskWeekScope) => void;
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
  scope = "current_week",
  onScopeChange,
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
          {surface !== "team_board" && onScopeChange ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <WeekScopeControl onScopeChange={onScopeChange} scope={scope} />
            </>
          ) : null}
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
 * The Week scope control for the Cycle-scoped Work Views (My Work, Our Work).
 * Current Week is the resting default every visit; All is the explicit
 * per-visit escape hatch (CONTEXT: Cycle-scoped Work View). It is deliberately
 * shaped unlike the View Tabs — a calendar-led, inset segmented toggle behind a
 * vertical divider — so the time window never reads as another View Tab and
 * scope choices do not feel like they carry between surfaces.
 */
function WeekScopeControl({
  scope,
  onScopeChange,
}: {
  readonly scope: TaskWeekScope;
  readonly onScopeChange: (scope: TaskWeekScope) => void;
}) {
  const isCurrentWeek = scope === "current_week";

  // Elevated "thumb" for the active segment. The track is an inset muted pill,
  // so the active option lifts off it with the surface background, a hairline
  // border, and a soft shadow — `secondary` reads almost identically to the
  // track in both themes and would leave the selection ambiguous.
  const segmentClassName = "h-6 rounded-full px-2.5 text-xs font-medium transition-colors";
  const activeSegmentClassName =
    "bg-background text-foreground border-border/60 border shadow-sm hover:bg-background";
  const inactiveSegmentClassName =
    "text-muted-foreground hover:text-foreground border border-transparent hover:bg-background/50";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            aria-label="Week scope"
            className="bg-muted/60 text-muted-foreground flex h-7 items-center gap-0.5 rounded-full px-1.5"
            role="group"
          />
        }
      >
        <CalendarRange aria-hidden className="size-3.5 shrink-0" />
        <Button
          aria-pressed={isCurrentWeek}
          className={cn(
            segmentClassName,
            isCurrentWeek ? activeSegmentClassName : inactiveSegmentClassName,
          )}
          onClick={() => onScopeChange("current_week")}
          size="sm"
          type="button"
          variant="ghost"
        >
          Current Week
        </Button>
        <Button
          aria-pressed={!isCurrentWeek}
          className={cn(
            segmentClassName,
            isCurrentWeek ? inactiveSegmentClassName : activeSegmentClassName,
          )}
          onClick={() => onScopeChange("all")}
          size="sm"
          type="button"
          variant="ghost"
        >
          All
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isCurrentWeek
          ? "Showing this Week's Tasks. Switch to All for every Task."
          : "Showing every Task. This Week is the default each visit."}
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
