import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WeekProgressPanel } from "@/components/tasks/week-progress-panel";
import { useCyclesCollection } from "@/data/cycles/cyclesData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, GaugeCircle } from "lucide-react";
import { useId, useMemo, type ComponentProps } from "react";

import {
  buildTeamWeeksIndexRows,
  groupTeamWeeksIndexRows,
  type TeamWeeksIndexRow,
  type TeamWeeksIndexStatus,
} from "./team-weeks-index-data";

const STATUS_LABEL: Record<TeamWeeksIndexStatus, string> = {
  current: "Current",
  upcoming: "Upcoming",
  completed: "Completed",
};

// A Week's lifecycle position reads at a glance from a single dot, matching the
// Team Week board selector: the live Week is tinted with the primary accent,
// future Weeks stay neutral-prominent, and past Weeks recede into the muted
// track. Keeping this vocabulary identical across the index and the board means
// a User learns "where am I in time" once.
const STATUS_DOT: Record<TeamWeeksIndexStatus, string> = {
  current: "bg-primary",
  upcoming: "bg-foreground/70",
  completed: "bg-muted-foreground/30",
};

const CLOSED_PROGRESS_CYCLE_ID = "closed";

type TeamWeeksIndexProgressTask = ComponentProps<typeof WeekProgressPanel>["tasks"][number] & {
  readonly cycleId?: string | null;
};

function resolveExpandedCycleId({
  progressCycleId,
  rows,
}: {
  readonly progressCycleId?: string | null;
  readonly rows: readonly TeamWeeksIndexRow[];
}) {
  if (progressCycleId === CLOSED_PROGRESS_CYCLE_ID) {
    return null;
  }

  if (progressCycleId) {
    return progressCycleId;
  }

  return rows.find((row) => row.status === "current")?.id ?? null;
}

export function TeamWeeksIndex({
  churchId,
  currentUserId,
  team,
  progressCycleId,
  onProgressCycleIdChange,
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
}) {
  const today = new Date().toISOString().slice(0, 10);
  const cyclesCollection = useCyclesCollection({ churchId, currentUserId });
  const tasksCollection = useTasksCollection({
    churchId,
    currentUserId,
    filters: { teamId: team.id },
  });
  const usersCollection = useChurchUsersCollection({ churchId });
  const labelsCollection = useLabelsCollection({ churchId });
  const rows = buildTeamWeeksIndexRows({
    cycles: cyclesCollection.cyclesCollection,
    tasks: tasksCollection.tasksCollection,
    teamId: team.id,
    teamIdentifier: team.identifier,
    today,
  });
  const sections = groupTeamWeeksIndexRows(rows);
  const isLoading = cyclesCollection.loading || tasksCollection.loading;
  const expandedCycleId = resolveExpandedCycleId({ progressCycleId, rows });
  const tasksByCycleId = useMemo(() => {
    const grouped = new Map<string, TeamWeeksIndexProgressTask[]>();

    for (const task of tasksCollection.tasksCollection) {
      if (!task.cycleId) {
        continue;
      }

      const cycleTasks = grouped.get(task.cycleId);
      if (cycleTasks) {
        cycleTasks.push(task);
      } else {
        grouped.set(task.cycleId, [task]);
      }
    }

    return grouped;
  }, [tasksCollection.tasksCollection]);
  const progressMeta = {
    assignees: usersCollection.usersCollection.map((user) => ({
      id: user.id,
      label: getUserDisplayName(user),
    })),
    labels: labelsCollection.labelsCollection,
    teams: [{ id: team.id, name: team.name }],
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3">
        <TeamWeeksBreadcrumb teamIdentifier={team.identifier} teamName={team.name} />
        <div className="flex items-center gap-3">
          <TeamAvatar color={team.color} name={team.name} size={36} />
          <div className="grid gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Weeks</h1>
            <p className="text-sm text-muted-foreground">
              Church-wide Weeks for {team.name}, including empty Weeks ready for planning.
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <TeamWeeksIndexSkeleton />
      ) : sections.length === 0 ? (
        <EmptyWeeks />
      ) : (
        <div className="flex flex-col gap-7">
          {sections.map((section) => (
            <WeekSection
              key={section.status}
              status={section.status}
              rows={section.rows}
              teamIdentifier={team.identifier}
              expandedCycleId={expandedCycleId}
              onProgressCycleIdChange={onProgressCycleIdChange}
              progressMeta={progressMeta}
              tasksByCycleId={tasksByCycleId}
            />
          ))}
        </div>
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
        to="/team/$teamIdentifier"
        params={{ teamIdentifier }}
        search={true}
        className="truncate rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {teamName}
      </Link>
      <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
      <span className="font-medium text-foreground/80">Weeks</span>
    </nav>
  );
}

function WeekSection({
  status,
  rows,
  teamIdentifier,
  expandedCycleId,
  onProgressCycleIdChange,
  progressMeta,
  tasksByCycleId,
}: {
  readonly status: TeamWeeksIndexStatus;
  readonly rows: readonly TeamWeeksIndexRow[];
  readonly teamIdentifier: string;
  readonly expandedCycleId: string | null;
  readonly onProgressCycleIdChange?: (cycleId: string | null) => void;
  readonly progressMeta: ComponentProps<typeof WeekProgressPanel>["meta"];
  readonly tasksByCycleId: ReadonlyMap<string, readonly TeamWeeksIndexProgressTask[]>;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[status])} />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABEL[status]}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground/70">{rows.length}</span>
      </div>
      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id}>
              <WeekRow
                row={row}
                teamIdentifier={teamIdentifier}
                expanded={row.id === expandedCycleId}
                onProgressCycleIdChange={onProgressCycleIdChange}
                progressMeta={progressMeta}
                tasks={tasksByCycleId.get(row.id) ?? []}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WeekRow({
  row,
  teamIdentifier,
  expanded,
  onProgressCycleIdChange,
  progressMeta,
  tasks,
}: {
  readonly row: TeamWeeksIndexRow;
  readonly teamIdentifier: string;
  readonly expanded: boolean;
  readonly onProgressCycleIdChange?: (cycleId: string | null) => void;
  readonly progressMeta: ComponentProps<typeof WeekProgressPanel>["meta"];
  readonly tasks: ComponentProps<typeof WeekProgressPanel>["tasks"];
}) {
  const hasName = row.displayName !== row.dateRange;
  const panelId = useId();
  const toggleProgress = () =>
    onProgressCycleIdChange?.(expanded ? CLOSED_PROGRESS_CYCLE_ID : row.id);

  return (
    <div className={cn("group/week transition-colors", expanded && "bg-muted/30")}>
      <div className="flex items-center gap-3 px-4 py-3 transition-colors group-hover/week:bg-muted/40">
        <span
          aria-hidden
          className={cn("mt-1 size-2 shrink-0 self-start rounded-full", STATUS_DOT[row.status])}
        />

        <Link
          to="/team/$teamIdentifier/weeks/$cycleId"
          params={{ teamIdentifier, cycleId: row.id }}
          search={true}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-medium">{row.displayName}</span>
            {hasName ? (
              <span className="truncate text-xs text-muted-foreground">{row.dateRange}</span>
            ) : null}
            {row.relativeLabel ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
                  row.status === "current"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {row.relativeLabel}
              </span>
            ) : null}
          </div>
          <WeekRowMeta row={row} />
        </Link>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-controls={panelId}
                aria-expanded={expanded}
                className="gap-1.5"
                onClick={toggleProgress}
                size="sm"
                type="button"
                variant={expanded ? "secondary" : "ghost"}
              />
            }
          >
            <GaugeCircle aria-hidden className="size-4" />
            <span className="hidden sm:inline">Progress</span>
          </TooltipTrigger>
          <TooltipContent>{expanded ? "Hide Week Progress" : "Show Week Progress"}</TooltipContent>
        </Tooltip>

        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover/week:text-muted-foreground"
        />
      </div>
      {expanded ? (
        <div
          className="overflow-hidden border-t bg-muted/10 px-4 py-4 duration-200 animate-in fade-in-0 slide-in-from-top-1"
          id={panelId}
        >
          <WeekProgressPanel
            className="w-full rounded-none border-0 bg-transparent p-0 shadow-none"
            meta={progressMeta}
            onClose={() => onProgressCycleIdChange?.(CLOSED_PROGRESS_CYCLE_ID)}
            tasks={tasks}
          />
        </div>
      ) : null}
    </div>
  );
}

function WeekRowMeta({ row }: { readonly row: TeamWeeksIndexRow }) {
  if (row.taskCount === 0) {
    return <p className="text-xs text-muted-foreground">No Team Tasks yet</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-xs tabular-nums text-muted-foreground">
        {row.taskCount} {row.taskCount === 1 ? "Task" : "Tasks"}
      </span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {row.completedCount}/{row.taskCount} completed
      </span>
      <CompletionBar
        completedCount={row.completedCount}
        startedCount={row.startedCount}
        taskCount={row.taskCount}
      />
    </div>
  );
}

// Mirrors the Team Week board's Week Progress bar: a lighter Started fill sits
// behind the solid Completed fill (every Done Task is also Started), so the
// index telegraphs momentum — not just completion — in the same visual language
// a User meets on the board itself.
function CompletionBar({
  completedCount,
  startedCount,
  taskCount,
}: {
  readonly completedCount: number;
  readonly startedCount: number;
  readonly taskCount: number;
}) {
  const startedPercentage = taskCount === 0 ? 0 : Math.round((startedCount / taskCount) * 100);
  const completedPercentage = taskCount === 0 ? 0 : Math.round((completedCount / taskCount) * 100);
  return (
    <div
      aria-label={`${startedCount} of ${taskCount} Tasks started, ${completedCount} completed`}
      className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      role="img"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary/30 transition-all"
        style={{ width: `${startedPercentage}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all"
        style={{ width: `${completedPercentage}%` }}
      />
    </div>
  );
}

function TeamWeeksIndexSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-2">
          <Skeleton className="ml-1 h-3 w-20" />
          <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
            <ul className="divide-y">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                </li>
              ))}
            </ul>
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
      <p className="text-sm font-medium">No Weeks generated yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Once Church-wide Weeks exist, they will appear here even before this Team has Tasks.
      </p>
    </div>
  );
}
