import { formatWeekDateRange } from "@/data/cycles/cyclesData.app";
import { CalendarDays } from "lucide-react";

import { WeekActionsMenu, type WeekActionsMenuCycle } from "./week-actions-menu";

/**
 * The Week's identity for an execution surface: a Church-wide name when one is
 * set, otherwise the immutable Monday–Sunday date range. The whole block is the
 * actions trigger so naming/renaming the Week is one click from where the work
 * lives, while the date range stays visible to anchor "which week is this?".
 */
export function WeekHeader({
  churchId,
  cycle,
}: {
  readonly churchId: string;
  readonly cycle: WeekActionsMenuCycle;
}) {
  const dateRange = formatWeekDateRange(cycle);
  const name = cycle.name?.trim() || null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <WeekActionsMenu
        churchId={churchId}
        cycle={cycle}
        trigger={
          <button
            aria-label={name ? `Week: ${name}. Edit Week details` : "Name this Week"}
            className="group/week -mx-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted aria-expanded:bg-muted"
            type="button"
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            {name ? (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-semibold leading-none">{name}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {dateRange}
                </span>
              </span>
            ) : (
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold leading-none">{dateRange}</span>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover/week:opacity-100">
                  Name this Week
                </span>
              </span>
            )}
          </button>
        }
      />
    </div>
  );
}
