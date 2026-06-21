import { SlidersHorizontal } from "lucide-react";

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

import {
  SUB_TASK_COMPLETED_OPTIONS,
  SUB_TASK_DISPLAY_PROPERTIES,
  SUB_TASK_ORDERING_OPTIONS,
  type SubTaskCompletedFilter,
  type SubTaskDisplayProperty,
  type SubTaskOrdering,
  type SubTaskViewOptions,
} from "@/features/details-pane/sub-task-view-options";

/**
 * Local presentation menu for the Sub-tasks section, mirroring the task
 * overview's View Options but scoped to a single Task and held in local state.
 */
export function SubTaskOptionsPopover({
  view,
  onViewChange,
}: {
  readonly view: SubTaskViewOptions;
  readonly onViewChange: (view: SubTaskViewOptions) => void;
}) {
  const toggleDisplayProperty = (property: SubTaskDisplayProperty) => {
    const isShown = view.displayProperties.includes(property);
    onViewChange({
      ...view,
      displayProperties: isShown
        ? view.displayProperties.filter((candidate) => candidate !== property)
        : [...view.displayProperties, property],
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button aria-label="Sub-task options" size="icon-sm" type="button" variant="ghost" />
        }
      >
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 text-xs">
        <div className="grid gap-1.5 p-1.5">
          <div className="grid h-7 grid-cols-[1fr_auto] items-center gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal">Ordering</Label>
            <Select
              items={SUB_TASK_ORDERING_OPTIONS}
              onValueChange={(value) =>
                onViewChange({ ...view, ordering: value as SubTaskOrdering })
              }
              value={view.ordering}
            >
              <SelectTrigger aria-label="Ordering" className="h-6 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false} className="w-auto min-w-40">
                {SUB_TASK_ORDERING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid h-7 grid-cols-[1fr_auto] items-center gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal">Completed tasks</Label>
            <Select
              items={SUB_TASK_COMPLETED_OPTIONS}
              onValueChange={(value) =>
                onViewChange({ ...view, completedFilter: value as SubTaskCompletedFilter })
              }
              value={view.completedFilter}
            >
              <SelectTrigger aria-label="Completed tasks" className="h-6 text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false} className="w-auto min-w-40">
                {SUB_TASK_COMPLETED_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex h-6 items-center justify-between gap-2 px-1">
            <Label className="text-muted-foreground text-xs font-normal" htmlFor="nested-subtasks">
              Nested sub-tasks
            </Label>
            <Switch
              checked={view.nested}
              className="scale-90"
              id="nested-subtasks"
              onCheckedChange={(checked) => onViewChange({ ...view, nested: checked })}
            />
          </div>
        </div>

        <Separator />

        <div className="grid gap-1 p-1.5">
          <p className="text-muted-foreground px-1 text-xs font-normal">Display properties</p>
          <div className="flex flex-wrap gap-1 px-1 pb-0.5">
            {SUB_TASK_DISPLAY_PROPERTIES.map((property) => {
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
      </PopoverContent>
    </Popover>
  );
}
