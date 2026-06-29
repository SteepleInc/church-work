import { AppHeaderSlot } from "@/components/app-header-slot";
import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useMultiCycleProjectedTasksCollection } from "@/data/tasks/tasksData.app";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  Layers,
  MoreHorizontal,
  Play,
} from "lucide-react";

import {
  buildTeamWeekBurndown,
  buildProjectedWeekCycles,
  buildTeamWeeksTimelineRows,
  type TeamWeeksIndexStatus,
  type TeamWeeksTimelineRow,
} from "./team-weeks-index-data";
import type { WeekCsvTask } from "./week-actions-data";
import { WeekActionsMenu } from "./week-actions-menu";
import { WeekBurndownChart } from "./week-burndown-chart";

const STATUS_LABEL: Record<TeamWeeksIndexStatus, string> = {
  current: "Current",
  upcoming: "Upcoming",
  completed: "Completed",
};

// A Week's lifecycle position reads from a single leading icon, matching
// Linear's Cycles list: the live Week glows with the primary accent, future
// Weeks show a hollow play, and past Weeks recede into a muted check.
const STATUS_ICON: Record<TeamWeeksIndexStatus, typeof Play> = {
  current: CirclePlay,
  upcoming: Play,
  completed: CircleCheck,
};

const STATUS_ICON_CLASS: Record<TeamWeeksIndexStatus, string> = {
  current: "text-primary",
  upcoming: "text-muted-foreground",
  completed: "text-muted-foreground/60",
};

const STATUS_PILL_CLASS: Record<TeamWeeksIndexStatus, string> = {
  current: "bg-primary/10 text-primary",
  upcoming: "bg-muted text-muted-foreground",
  completed: "bg-muted text-muted-foreground",
};

const CLOSED_PROGRESS_CYCLE_ID = "closed";

function resolveExpandedCycleId({
  progressCycleId,
  rows,
}: {
  readonly progressCycleId?: string | null;
  readonly rows: readonly TeamWeeksTimelineRow[];
}): string | null {
  if (progressCycleId === CLOSED_PROGRESS_CYCLE_ID) return null;
  if (progressCycleId) return progressCycleId;
  return rows.find((row) => row.status === "current")?.id ?? null;
}

export function TeamWeeksIndex({
  churchId,
  currentUserId,
  team,
  progressCycleId,
  onProgressCycleIdChange,
  churchTimeZone = "UTC",
}: {
  readonly churchId: string;
  readonly currentUserId: string;
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string;
    readonly color?: string | null;
  };
  readonly progressCycleId?: string | null;
  readonly onProgressCycleIdChange?: (cycleId: string | null) => void;
  readonly churchTimeZone?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const cycles = buildProjectedWeekCycles({
    churchTimeZone,
    cycles: cyclesCollection.cyclesCollection,
    today,
  });
  // Project Template Tasks across every Week (saved + Projected) so future
  // Weeks count the Template Tasks scheduled into them rather than showing an
  // empty "0 scope". Projection dedups against materialized Tasks, so saved
  // Weeks never double-count. Each Cycle's id/window drives the placement.
  const projectionCycles = cycles.map((cycle) => ({
    id: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
  }));
  const tasksCollection = useMultiCycleProjectedTasksCollection({
    churchId,
    currentUserId,
    filters: { teamId: team.id },
    projectionCycles,
  });
  const rows = buildTeamWeeksTimelineRows({
    cycles,
    tasks: tasksCollection.tasksCollection,
    teamId: team.id,
    teamIdentifier: team.identifier,
    today,
    churchTimeZone,
  });
  // Lightweight CSV rows for the per-Week "Export tasks" action. The index does
  // not resolve workflow-status/assignee display names, so those name-derived
  // columns stay null here; the core columns (including projected Template
  // Tasks) still export.
  const weekCsvTasks: readonly WeekCsvTask[] = tasksCollection.tasksCollection.map((task) => ({
    identifier: task.identifier,
    title: task.title,
    taskState: task.taskState,
    workflowStatusName: null,
    assignedUserName: null,
    teamName: team.name,
    dueDate: task.dueDate,
    cycleId: task.cycleId,
  }));
  const isLoading = cyclesCollection.loading || tasksCollection.loading;
  const expandedCycleId = resolveExpandedCycleId({ progressCycleId, rows });

  return (
    // The page wrapper hands this surface zero padding; the ScrollArea owns the
    // page's horizontal/top padding (inside the scroll viewport) so the
    // scrollbar can sit flush at the panel edge, Linear-style. The list spans
    // the full panel width rather than a narrow centered column.
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Linear keeps the page title in the top breadcrumb bar rather than in a
          separate in-page header. Mirror that: render the Team › Weeks crumb
          into the shell header slot and let the list start at the top. */}
      <AppHeaderSlot>
        <TeamWeeksBreadcrumb
          teamColor={team.color}
          teamIdentifier={team.identifier}
          teamName={team.name}
        />
      </AppHeaderSlot>

      {isLoading ? (
        <div className="px-4 pt-1">
          <TeamWeeksIndexSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 pt-1">
          <EmptyWeeks />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {/* The ScrollArea owns the page padding (px-4 pt-1), so it lives
              inside the scroll viewport. The row dividers live on the content
              column only, so the timeline rail column stays a clean, unbroken
              vertical line — as in Linear. */}
          <ul className="flex flex-col px-4 pt-1">
            {rows.map((row, index) => (
              <li className="flex" key={row.id}>
                <TimelineMarker
                  isFirst={index === 0}
                  isLast={index === rows.length - 1}
                  row={row}
                />
                <div className="min-w-0 flex-1 border-b">
                  <WeekRow
                    churchId={churchId}
                    expanded={row.id === expandedCycleId}
                    onProgressCycleIdChange={onProgressCycleIdChange}
                    row={row}
                    tasks={weekCsvTasks}
                    teamIdentifier={team.identifier}
                  />
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  );
}

// The Team › Weeks breadcrumb, rendered into the shell's header slot so it sits
// in the top bar exactly where Linear shows "Team › Cycles". The Team segment
// carries its avatar and links back to the board; "Weeks" is the current page.
function TeamWeeksBreadcrumb({
  teamColor,
  teamIdentifier,
  teamName,
}: {
  readonly teamColor?: string | null;
  readonly teamIdentifier: string;
  readonly teamName: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link
        className="-mx-1 flex min-w-0 items-center gap-1.5 truncate rounded-md px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        params={{ teamIdentifier }}
        search={true}
        to="/team/$teamIdentifier"
      >
        <TeamAvatar color={teamColor} name={teamName} size={18} />
        <span className="truncate">{teamName}</span>
      </Link>
      <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-60" />
      <span className="font-medium text-foreground">Weeks</span>
    </nav>
  );
}

// The timeline marker that sits to the left of each Week row, mirroring
// Linear's Cycles timeline. The Week's start date is stacked (month over day)
// and right-aligned against the rail; a continuous vertical line runs through
// every marker (clipped at the first/last row). Linear draws hollow rings for
// past and future Weeks and fills only the live Week's dot with the primary
// accent, tinting the rail from the current Week downward through the Weeks
// that have already passed. Living inside each row keeps the rail aligned even
// when a row expands to show its burndown chart.
//
// Rows are ordered newest-first, so the segment *below* the current Week leads
// into completed Weeks: that lower half is the accent-tinted "elapsed" run.
function TimelineMarker({
  row,
  isFirst,
  isLast,
}: {
  readonly row: TeamWeeksTimelineRow;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}) {
  const isCurrent = row.status === "current";
  const isCompleted = row.status === "completed";
  // The accent run starts at the current Week and continues through every
  // already-elapsed Week below it; future Weeks above stay on the neutral rail.
  const elapsedRail = isCurrent || isCompleted;

  // The rail (line + dot) is pinned to the right edge of the marker cell; the
  // stacked date sits to its left, matching Linear's "date · rail · content".
  const dotCenter = 12;

  return (
    <div aria-hidden className="relative hidden w-[76px] shrink-0 sm:block">
      {/* Date label, stacked month-over-day and right-aligned toward the rail. */}
      <div
        className="absolute top-[14px] flex flex-col items-end text-right leading-none text-muted-foreground"
        style={{ right: dotCenter + 16 }}
      >
        <span className="text-[11px]">{row.startLabelMonth}</span>
        <span className="mt-1 text-[11px] tabular-nums">{row.startLabelDay}</span>
      </div>

      {/* The rail is split into two halves at the dot's exact vertical center
          (top 14px + half of the 14px dot = 21px) so the line passes cleanly
          through every dot with no kink. The upper segment (toward future
          Weeks) and lower segment (toward elapsed Weeks) are tinted
          independently — Linear lights the elapsed run with the accent. */}
      {!isFirst ? (
        <span
          className={cn(
            "absolute top-0 h-[21px] w-px",
            // The short segment above the current dot reaches up into a future
            // Week, so it stays neutral; elsewhere the elapsed run is tinted.
            elapsedRail && !isCurrent ? "bg-primary/60" : "bg-border",
          )}
          style={{ right: dotCenter }}
        />
      ) : null}
      {!isLast ? (
        <span
          className={cn(
            "absolute top-[21px] bottom-0 w-px",
            elapsedRail ? "bg-primary/60" : "bg-border",
          )}
          style={{ right: dotCenter }}
        />
      ) : null}

      <div className="absolute z-10 top-[14px]" style={{ right: dotCenter - 7 }}>
        {/* A solid background ring masks the rail behind the marker so the line
            never shows through the circle. */}
        <span className="grid size-[14px] shrink-0 place-items-center rounded-full bg-background">
          {isCurrent ? (
            // The live Week: a solid accent dot, the focal point of the rail.
            <span className="size-[9px] rounded-full bg-primary" />
          ) : isCompleted ? (
            // Elapsed Weeks: small solid muted dots sitting on the accent run.
            <span className="size-[7px] rounded-full bg-muted-foreground/50" />
          ) : (
            // Future Weeks: hollow rings on the neutral rail.
            <span className="size-[9px] rounded-full border-2 border-muted-foreground/40 bg-background" />
          )}
        </span>
      </div>
    </div>
  );
}

function WeekRow({
  row,
  teamIdentifier,
  expanded,
  churchId,
  tasks,
  onProgressCycleIdChange,
}: {
  readonly row: TeamWeeksTimelineRow;
  readonly teamIdentifier: string;
  readonly expanded: boolean;
  readonly churchId: string;
  readonly tasks: readonly WeekCsvTask[];
  readonly onProgressCycleIdChange?: (cycleId: string | null) => void;
}) {
  const StatusIcon = STATUS_ICON[row.status];
  const headline = row.displayPrimary;
  const toggleProgress = () =>
    onProgressCycleIdChange?.(expanded ? CLOSED_PROGRESS_CYCLE_ID : row.id);

  return (
    <div className={cn("group/week", expanded && "bg-muted/20")}>
      {/* The whole header is a click target that opens the Week. A full-row
          Link sits behind the content (absolute, z-0) so any "dead" space still
          navigates, while the interactive controls (progress toggle, actions
          menu) sit above it (relative, z-10) and stop propagation. This mirrors
          Linear's Cycles rows, where clicking anywhere opens the Cycle. */}
      <div className="relative flex items-center gap-3 py-3.5 pr-4 pl-5 transition-colors group-hover/week:bg-muted/40 has-focus-visible:bg-muted/40">
        <Link
          aria-label={`Open ${headline}`}
          className="absolute inset-0 z-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          params={{ teamIdentifier, weekNumber: String(row.ordinal) }}
          search={true}
          tabIndex={-1}
          to="/team/$teamIdentifier/week/$weekNumber"
        />

        <StatusIcon
          aria-hidden
          className={cn("relative z-10 size-4 shrink-0", STATUS_ICON_CLASS[row.status])}
        />

        <Link
          className="relative z-10 flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          params={{ teamIdentifier, weekNumber: String(row.ordinal) }}
          search={true}
          to="/team/$teamIdentifier/week/$weekNumber"
        >
          <span className="truncate text-sm font-medium">{headline}</span>
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            - {row.dateRange}
          </span>
        </Link>

        {/* Linear clusters a Cycle's metadata at the row's right (status ·
            capacity · scope · ⋯) with a steady, compact gap. The pill keeps its
            natural size; only the numeric columns get fixed widths so their
            rings and counts line up into clean vertical lanes row-to-row. */}
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_PILL_CLASS[row.status],
            )}
          >
            {STATUS_LABEL[row.status]}
          </span>

          <button
            aria-expanded={expanded}
            className="hidden w-[92px] shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
            onClick={(event) => {
              event.stopPropagation();
              toggleProgress();
            }}
            type="button"
          >
            <CapacityRing percentage={row.completedPercentage} />
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{row.completedPercentage}%</span> done
            </span>
          </button>

          <span className="hidden w-[72px] shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <Layers aria-hidden className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{row.taskCount}</span> scope
            </span>
          </span>

          {/* The "⋯" menu only materializes on row hover / keyboard focus, the
              way Linear reveals a Cycle's actions. It stays mounted while the
              menu is open so the popup doesn't close on pointer-leave. */}
          <WeekActionsMenu
            align="end"
            churchId={churchId}
            cycle={{
              id: row.id,
              startDate: row.targetCycle.startDate,
              endDate: row.targetCycle.endDate,
              name: row.name,
              description: row.description,
            }}
            tasks={tasks}
            trigger={
              <button
                aria-label="Week actions"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[color,background-color,opacity] hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/week:opacity-100 aria-expanded:bg-muted aria-expanded:text-foreground aria-expanded:opacity-100 data-popup-open:opacity-100"
                onClick={(event) => event.stopPropagation()}
                type="button"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
        </div>
      </div>

      {expanded ? <WeekExpandedPanel row={row} /> : null}
    </div>
  );
}

// A small ring that fills clockwise with completion, echoing Linear's capacity
// dial. Empty Weeks show a dashed placeholder.
function CapacityRing({ percentage }: { readonly percentage: number }) {
  if (percentage === 0) {
    return <CircleDashed aria-hidden className="size-4 text-muted-foreground/50" />;
  }
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(percentage, 100) / 100) * circumference;
  return (
    <svg aria-hidden className="size-4 -rotate-90" viewBox="0 0 16 16">
      <circle cx="8" cy="8" fill="none" r={radius} stroke="var(--color-muted)" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        fill="none"
        r={radius}
        stroke="var(--color-primary)"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function WeekExpandedPanel({ row }: { readonly row: TeamWeeksTimelineRow }) {
  const burndown = buildTeamWeekBurndown({
    scope: row.taskCount,
    started: row.startedCount,
    completed: row.completedCount,
    startLabel: row.startLabel,
    endLabel: row.endLabel,
  });

  if (row.taskCount === 0) {
    // A future Week with no saved Cycle row is a Projected Week: it is real to
    // plan into, but reads as "nothing scheduled yet" rather than "empty Week".
    const isFuture = row.status === "upcoming";
    return (
      <div className="pr-4 pb-5 pl-5">
        <div className="grid place-items-center gap-1 rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
          <p className="text-sm font-medium">
            {isFuture ? "Nothing planned yet" : "No Tasks this Week"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isFuture
              ? "Add Tasks to this Week and it starts tracking progress automatically."
              : "Progress appears once this Team has Tasks in the Week."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pr-4 pb-5 pl-5 lg:grid-cols-[1fr_220px]">
      <WeekBurndownChart burndown={burndown} className="min-w-0" />
      <dl className="flex flex-col justify-center gap-3 lg:border-l lg:pl-5">
        <LegendStat dotClassName="bg-muted-foreground/40" label="Scope" value={burndown.scope} />
        <LegendStat
          dotClassName="bg-amber-400"
          hint={`${burndown.startedPercentage}%`}
          label="Started"
          value={burndown.started}
        />
        <LegendStat
          dotClassName="bg-primary"
          hint={`${burndown.completedPercentage}%`}
          label="Completed"
          value={burndown.completed}
        />
      </dl>
    </div>
  );
}

function LegendStat({
  label,
  value,
  hint,
  dotClassName,
}: {
  readonly label: string;
  readonly value: number;
  readonly hint?: string;
  readonly dotClassName: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("size-2.5 shrink-0 rounded-sm", dotClassName)} />
      <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-sm font-semibold">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

function TeamWeeksIndexSkeleton() {
  return (
    <div className="flex flex-col border-t">
      {[0, 1, 2, 3, 4].map((row) => (
        <div className="flex items-center gap-3 border-b py-3.5 pr-4 pl-5" key={row}>
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <div className="ml-auto flex items-center gap-4">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyWeeks() {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed bg-muted/10 px-6 py-16 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <CalendarDays className="size-5" />
      </span>
      <p className="text-sm font-medium">No Weeks to show yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Upcoming Weeks are projected from the Church calendar — they appear here even before this
        Team has Tasks.
      </p>
    </div>
  );
}
