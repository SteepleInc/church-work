import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatWeekDateRange, formatWeekNameParts } from "@/data/cycles/cyclesData.app";
import { cn } from "@/lib/utils";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarRange, ChevronDown, ChevronRight } from "lucide-react";

type SelectorCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
};

function weekLabel(cycle: SelectorCycle): string {
  return cycle.name?.trim() || formatWeekNameParts(cycle).fullLabel;
}

/**
 * The Team Week switcher, modeled on Linear's Cycle switcher. It lives in the
 * page header as the final, interactive segment of the Team › Weeks › Week
 * breadcrumb. Opening it reveals the immediate neighbors — the next (upcoming)
 * Week and the previous (completed) Week — each jumpable in one click or with
 * the `K` / `J` shortcuts, so stepping through Weeks never leaves the board.
 */
export function TeamWeekSelector({
  cycles,
  selectedCycleId,
  teamIdentifier,
  teamName,
}: {
  readonly cycles: readonly SelectorCycle[];
  readonly selectedCycleId: string;
  readonly teamIdentifier: string;
  readonly teamName: string;
}) {
  const navigate = useNavigate();
  const ordered = [...cycles].sort((left, right) => left.startDate.localeCompare(right.startDate));
  const selectedIndex = ordered.findIndex((cycle) => cycle.id === selectedCycleId);
  const selected = selectedIndex >= 0 ? ordered[selectedIndex] : null;

  const previousWeek = selectedIndex > 0 ? ordered[selectedIndex - 1] : null;
  const nextWeek =
    selectedIndex >= 0 && selectedIndex < ordered.length - 1 ? ordered[selectedIndex + 1] : null;

  const goToWeek = (cycleId: string) => {
    const weekNumber = ordered.findIndex((cycle) => cycle.id === cycleId) + 1;
    if (weekNumber < 1) return;
    void navigate({
      to: "/team/$teamIdentifier/week/$weekNumber",
      params: { teamIdentifier, weekNumber: String(weekNumber) },
      search: true,
    });
  };

  // `⌥K` / `⌥J` step to the next / previous Week — Linear's exact Cycle
  // shortcuts. As single-letter Alt combos they default to `ignoreInputs: true`,
  // so they're skipped while a text field has focus. Option remaps letters on
  // macOS (⌥K → "˚", ⌥J → "∆"), but the manager falls back to event.code, so
  // these fire regardless of layout.
  useHotkey("Alt+K", () => nextWeek && goToWeek(nextWeek.id), {
    enabled: Boolean(nextWeek),
    preventDefault: true,
  });
  useHotkey("Alt+J", () => previousWeek && goToWeek(previousWeek.id), {
    enabled: Boolean(previousWeek),
    preventDefault: true,
  });

  return (
    <nav
      aria-label="Week"
      className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground"
    >
      <Link
        to="/team/$teamIdentifier"
        params={{ teamIdentifier }}
        search={true}
        className="truncate rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {teamName}
      </Link>
      <BreadcrumbChevron />
      <Link
        to="/team/$teamIdentifier/weeks"
        params={{ teamIdentifier }}
        search={true}
        className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Weeks
      </Link>
      <BreadcrumbChevron />

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={
            selected
              ? `Selected Week: ${weekLabel(selected)}. Choose a different Week`
              : "Choose a Week"
          }
          className="-mx-1 flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 font-medium text-foreground transition-colors hover:bg-muted aria-expanded:bg-muted data-popup-open:bg-muted"
        >
          <CalendarRange aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          {selected ? (
            <WeekNameInline cycle={selected} />
          ) : (
            <span className="truncate">Select a Week</span>
          )}
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {nextWeek ? (
            <>
              <DropdownMenuLabel>Next Week (upcoming)</DropdownMenuLabel>
              <WeekMenuItem cycle={nextWeek} onSelect={goToWeek} shortcut="⌥K" />
            </>
          ) : null}
          {previousWeek ? (
            <>
              <DropdownMenuLabel>Previous Week (completed)</DropdownMenuLabel>
              <WeekMenuItem cycle={previousWeek} onSelect={goToWeek} shortcut="⌥J" />
            </>
          ) : null}
          {!nextWeek && !previousWeek ? (
            <DropdownMenuLabel className="font-normal">No other Weeks</DropdownMenuLabel>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

function WeekNameInline({ cycle }: { readonly cycle: SelectorCycle }) {
  const name = cycle.name?.trim();
  const fallback = formatWeekNameParts(cycle);
  return (
    <span className="min-w-0 truncate">
      {name || fallback.primary}
      <span className="text-muted-foreground">
        {" "}
        - {name ? formatWeekDateRange(cycle) : fallback.dateRange}
      </span>
    </span>
  );
}

function BreadcrumbChevron() {
  return <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-60" />;
}

function WeekMenuItem({
  cycle,
  onSelect,
  shortcut,
}: {
  readonly cycle: SelectorCycle;
  readonly onSelect: (cycleId: string) => unknown;
  readonly shortcut: string;
}) {
  const name = cycle.name?.trim();
  const fallback = formatWeekNameParts(cycle);
  return (
    <DropdownMenuItem className="gap-2" onClick={() => void onSelect(cycle.id)}>
      <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{name || fallback.primary}</span>
        <span className="truncate text-xs text-muted-foreground">
          {name ? formatWeekDateRange(cycle) : fallback.dateRange}
        </span>
      </span>
      <DropdownMenuShortcut className={cn("tracking-normal", name ? "self-start" : undefined)}>
        {shortcut}
      </DropdownMenuShortcut>
    </DropdownMenuItem>
  );
}
