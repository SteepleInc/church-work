import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  Layers,
  Play,
} from "lucide-react";

import {
  buildTeamWeekBurndown,
  buildProjectedWeekCycles,
  buildTeamWeeksTimelineRows,
  type TeamWeeksIndexStatus,
  type TeamWeeksTimelineRow,
} from "./team-weeks-index-data";
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
  const tasksCollection = useTasksCollection({
    churchId,
    currentUserId,
    filters: { teamId: team.id },
  });
  const cycles = buildProjectedWeekCycles({
    churchTimeZone,
    cycles: cyclesCollection.cyclesCollection,
    today,
  });
  const rows = buildTeamWeeksTimelineRows({
    cycles,
    tasks: tasksCollection.tasksCollection,
    teamId: team.id,
    teamIdentifier: team.identifier,
    today,
    churchTimeZone,
  });
  const isLoading = cyclesCollection.loading || tasksCollection.loading;
  const expandedCycleId = resolveExpandedCycleId({ progressCycleId, rows });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3">
        <TeamWeeksBreadcrumb teamIdentifier={team.identifier} teamName={team.name} />
        <div className="flex items-center gap-3">
          <TeamAvatar color={team.color} name={team.name} size={32} />
          <h1 className="text-lg font-semibold tracking-tight">Weeks</h1>
        </div>
      </header>

      {isLoading ? (
        <TeamWeeksIndexSkeleton />
      ) : rows.length === 0 ? (
        <EmptyWeeks />
      ) : (
        <ul className="flex flex-col border-t">
          {rows.map((row, index) => (
            <li className="flex border-b" key={row.id}>
              <TimelineMarker isFirst={index === 0} isLast={index === rows.length - 1} row={row} />
              <div className="min-w-0 flex-1">
                <WeekRow
                  expanded={row.id === expandedCycleId}
                  onProgressCycleIdChange={onProgressCycleIdChange}
                  row={row}
                  teamIdentifier={team.identifier}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamWeeksBreadcrumb({
  teamIdentifier,
  teamName,
}: {
  readonly teamIdentifier: string;
  readonly teamName: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link
        className="truncate rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        params={{ teamIdentifier }}
        search={true}
        to="/team/$teamIdentifier"
      >
        {teamName}
      </Link>
      <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
      <span className="font-medium text-foreground/80">Weeks</span>
    </nav>
  );
}

// The timeline marker that sits to the left of each Week row, mirroring
// Linear's Cycles timeline. A continuous vertical line runs through every
// marker cell (clipped at the first/last row), the dot is pinned to the row's
// header height, and the current Week's connecting segment is tinted with the
// primary accent so the present moment stands out. Living inside each row keeps
// the line aligned even when a row expands to show its burndown chart.
function TimelineMarker({
  row,
  isFirst,
  isLast,
}: {
  readonly row: TeamWeeksTimelineRow;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}) {
  const lineClass = row.status === "current" ? "bg-primary/60" : "bg-border";

  return (
    <div aria-hidden className="relative hidden w-20 shrink-0 sm:block">
      {/* Connecting line, clipped so the rail doesn't overshoot the ends. */}
      <span
        className={cn("absolute left-[11px] w-px", lineClass)}
        style={{ top: isFirst ? 22 : 0, bottom: isLast ? "auto" : 0, height: isLast ? 22 : "auto" }}
      />
      <div className="flex items-start gap-2 pt-[14px] pl-2">
        <span
          className={cn(
            "mt-0.5 size-[9px] shrink-0 rounded-full ring-4 ring-background",
            row.status === "current"
              ? "bg-primary"
              : row.status === "upcoming"
                ? "bg-muted-foreground/50"
                : "bg-muted-foreground/30",
          )}
        />
        <span className="pt-px text-[11px] leading-tight tabular-nums text-muted-foreground">
          {row.startLabel}
        </span>
      </div>
    </div>
  );
}

function WeekRow({
  row,
  teamIdentifier,
  expanded,
  onProgressCycleIdChange,
}: {
  readonly row: TeamWeeksTimelineRow;
  readonly teamIdentifier: string;
  readonly expanded: boolean;
  readonly onProgressCycleIdChange?: (cycleId: string | null) => void;
}) {
  const StatusIcon = STATUS_ICON[row.status];
  const headline = row.ordinal > 0 ? `Week ${row.ordinal}` : row.displayName;
  const hasCustomName = row.displayName !== row.dateRange;
  const toggleProgress = () =>
    onProgressCycleIdChange?.(expanded ? CLOSED_PROGRESS_CYCLE_ID : row.id);

  return (
    <div className={cn("group/week", expanded && "bg-muted/20")}>
      <div className="flex items-center gap-3 px-2 py-3.5 transition-colors group-hover/week:bg-muted/40">
        <StatusIcon aria-hidden className={cn("size-4 shrink-0", STATUS_ICON_CLASS[row.status])} />

        <Link
          className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          params={{ teamIdentifier, weekNumber: String(row.ordinal) }}
          search={true}
          to="/team/$teamIdentifier/week/$weekNumber"
        >
          <span className="truncate text-sm font-medium">{headline}</span>
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {hasCustomName ? row.displayName : row.dateRange}
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
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
            className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
            onClick={toggleProgress}
            type="button"
          >
            <CapacityRing percentage={row.completedPercentage} />
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{row.completedPercentage}%</span> done
            </span>
          </button>

          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <Layers aria-hidden className="size-3.5" />
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{row.taskCount}</span> scope
            </span>
          </span>
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
      <div className="px-2 pb-5">
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
    <div className="grid gap-4 px-2 pb-5 lg:grid-cols-[1fr_220px]">
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
        <div className="flex items-center gap-3 border-b px-2 py-3.5" key={row}>
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
