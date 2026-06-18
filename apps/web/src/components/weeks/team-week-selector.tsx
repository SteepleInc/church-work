import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatWeekDateRange } from "@/data/cycles/cyclesData.app";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

type SelectorCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
};

type WeekStatus = "current" | "upcoming" | "completed";

function getWeekStatus(
  cycle: { readonly startDate: string; readonly endDate: string },
  today: string,
): WeekStatus {
  if (cycle.startDate <= today && today <= cycle.endDate) return "current";
  if (cycle.startDate > today) return "upcoming";
  return "completed";
}

const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  current: "Current",
  upcoming: "Upcoming",
  completed: "Completed",
};

// A Week's lifecycle position reads at a glance: the live Week is tinted with
// the primary accent, future Weeks stay neutral-prominent (solid foreground),
// and past Weeks recede into the muted track so the selector telegraphs "where
// am I in time". Upcoming and completed stay clearly separable so a bare dot —
// the only status carrier on the trigger below `sm` and in the step tooltips —
// never collapses into "just another gray".
const WEEK_STATUS_DOT: Record<WeekStatus, string> = {
  current: "bg-primary",
  upcoming: "bg-foreground/70",
  completed: "bg-muted-foreground/30",
};

function weekLabel(cycle: SelectorCycle): string {
  return cycle.name?.trim() || formatWeekDateRange(cycle);
}

function weekStepLabel(direction: "previous" | "next", cycle: SelectorCycle | null): string {
  if (direction === "previous") {
    return cycle ? `Previous Week, ${weekLabel(cycle)}` : "No earlier Week";
  }

  return cycle ? `Next Week, ${weekLabel(cycle)}` : "No later Week";
}

/**
 * The nearby Week navigator for a Team Week board. It centers on the Week in
 * view and lets Users step one Week at a time (prev / next chevrons) or jump to
 * any of the Team's Weeks from a status-grouped menu, without leaving the
 * board. Each Week carries a Current / Upcoming / Completed status so the
 * time window is always legible — the same vocabulary the Team Cycles View uses.
 */
export function TeamWeekSelector({
  cycles,
  currentCycleId,
  selectedCycleId,
  teamIdentifier,
  today,
}: {
  readonly cycles: readonly SelectorCycle[];
  readonly currentCycleId: string | null;
  readonly selectedCycleId: string;
  readonly teamIdentifier: string;
  readonly today: string;
}) {
  const navigate = useNavigate();
  const ordered = [...cycles].sort((left, right) => left.startDate.localeCompare(right.startDate));
  const selectedIndex = ordered.findIndex((cycle) => cycle.id === selectedCycleId);
  const selected = selectedIndex >= 0 ? ordered[selectedIndex] : null;

  const goToWeek = (cycleId: string) => {
    const weekNumber = ordered.findIndex((cycle) => cycle.id === cycleId) + 1;
    if (weekNumber < 1) return;
    void navigate({
      to: "/team/$teamIdentifier/week/$weekNumber",
      params: { teamIdentifier, weekNumber: String(weekNumber) },
      search: true,
    });
  };

  const previousWeek = selectedIndex > 0 ? ordered[selectedIndex - 1] : null;
  const nextWeek =
    selectedIndex >= 0 && selectedIndex < ordered.length - 1 ? ordered[selectedIndex + 1] : null;

  const selectedStatus = selected ? getWeekStatus(selected, today) : null;

  // Group the jump menu by lifecycle so "this Week" is one glance away and
  // upcoming planning sits above the completed archive.
  const grouped: Record<WeekStatus, SelectorCycle[]> = {
    current: [],
    upcoming: [],
    completed: [],
  };
  for (const cycle of ordered) grouped[getWeekStatus(cycle, today)].push(cycle);
  // Completed Weeks read newest-first; upcoming Weeks read soonest-first.
  grouped.completed.reverse();

  const menuSections: { readonly status: WeekStatus; readonly cycles: readonly SelectorCycle[] }[] =
    [
      { status: "current", cycles: grouped.current },
      { status: "upcoming", cycles: grouped.upcoming },
      { status: "completed", cycles: grouped.completed },
    ];

  return (
    <div
      aria-label="Week selector"
      className="flex h-9 items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
      role="group"
    >
      <WeekStepButton cycle={previousWeek} direction="previous" onSelect={goToWeek} today={today} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-8 min-w-0 gap-2 rounded-md px-2.5 font-medium aria-expanded:bg-background data-popup-open:bg-background"
              aria-label={
                selected
                  ? `Selected Week: ${weekLabel(selected)}. Choose a different Week`
                  : "Choose a Week"
              }
            >
              {selectedStatus ? (
                <span
                  aria-hidden
                  className={cn("size-1.5 shrink-0 rounded-full", WEEK_STATUS_DOT[selectedStatus])}
                />
              ) : null}
              <span className="truncate text-sm">
                {selected ? weekLabel(selected) : "Select a Week"}
              </span>
              {selectedStatus ? (
                <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                  {WEEK_STATUS_LABEL[selectedStatus]}
                </Badge>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="max-h-80 w-64 min-w-56">
          {menuSections.map((section) =>
            section.cycles.length === 0 ? null : (
              <div key={section.status}>
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", WEEK_STATUS_DOT[section.status])}
                  />
                  {WEEK_STATUS_LABEL[section.status]}
                </DropdownMenuLabel>
                {section.cycles.map((cycle) => {
                  const isSelected = cycle.id === selectedCycleId;
                  const isCurrent = cycle.id === currentCycleId;
                  return (
                    <DropdownMenuItem
                      key={cycle.id}
                      onClick={() => void goToWeek(cycle.id)}
                      className="gap-2"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{weekLabel(cycle)}</span>
                        {cycle.name?.trim() ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {formatWeekDateRange(cycle)}
                          </span>
                        ) : null}
                      </span>
                      {isCurrent && !isSelected ? (
                        <span className="shrink-0 text-xs text-muted-foreground">Now</span>
                      ) : null}
                      {isSelected ? (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          strokeWidth={2}
                          className="size-4 shrink-0 text-foreground"
                        />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <WeekStepButton cycle={nextWeek} direction="next" onSelect={goToWeek} today={today} />
    </div>
  );
}

function WeekStepButton({
  cycle,
  direction,
  onSelect,
  today,
}: {
  readonly cycle: SelectorCycle | null;
  readonly direction: "previous" | "next";
  readonly onSelect: (cycleId: string) => unknown;
  readonly today: string;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const label = weekStepLabel(direction, cycle);

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
      disabled={cycle === null}
      aria-label={label}
      onClick={() => {
        if (cycle) void onSelect(cycle.id);
      }}
    >
      <Icon className="size-4" />
    </Button>
  );

  if (!cycle) return button;

  const status = getWeekStatus(cycle, today);
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 rounded-full", WEEK_STATUS_DOT[status])} />
          {weekLabel(cycle)}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
