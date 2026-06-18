import { formatWeekDateRange } from "@/data/cycles/cyclesData.app";

export type TeamWeeksIndexStatus = "current" | "upcoming" | "completed";

export type TeamWeeksIndexCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
  readonly description?: string | null;
};

export type TeamWeeksIndexTask = {
  readonly id: string;
  readonly cycleId: string;
  readonly teamId: string;
  readonly taskState: "todo" | "in_progress" | "done" | "canceled";
};

export type TeamWeeksIndexRow = {
  readonly id: string;
  readonly displayName: string;
  readonly dateRange: string;
  /** A short relative cue such as "This week" or "Next week", when one applies. */
  readonly relativeLabel: string | null;
  readonly description: string | null;
  readonly href: string;
  readonly status: TeamWeeksIndexStatus;
  readonly taskCount: number;
  readonly startedCount: number;
  readonly completedCount: number;
  /** Whole-percent share of this Week's scoped Tasks that are Done (0 when empty). */
  readonly completedPercentage: number;
};

export type TeamWeeksIndexSection = {
  readonly status: TeamWeeksIndexStatus;
  readonly rows: readonly TeamWeeksIndexRow[];
};

export function getTeamWeekStatus(
  cycle: { readonly startDate: string; readonly endDate: string },
  today: string,
): TeamWeeksIndexStatus {
  if (cycle.startDate <= today && today <= cycle.endDate) return "current";
  if (cycle.startDate > today) return "upcoming";
  return "completed";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDaysBetween(from: string, to: string): number | null {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null;
  return Math.round((toTime - fromTime) / MS_PER_DAY);
}

/**
 * A short relative cue for a Week, anchored on today. The current Week reads
 * "This week"; the immediately adjacent Weeks read "Next week" / "Last week" so
 * the planning horizon is legible at a glance. Weeks further out fall back to
 * their date range alone (relativeLabel is null).
 */
export function getTeamWeekRelativeLabel(
  cycle: { readonly startDate: string; readonly endDate: string },
  today: string,
): string | null {
  const status = getTeamWeekStatus(cycle, today);
  if (status === "current") return "This week";
  if (status === "upcoming") {
    const daysUntilStart = isoDaysBetween(today, cycle.startDate);
    if (daysUntilStart !== null && daysUntilStart <= 7) return "Next week";
    return null;
  }
  const daysSinceEnd = isoDaysBetween(cycle.endDate, today);
  if (daysSinceEnd !== null && daysSinceEnd <= 7) return "Last week";
  return null;
}

export function buildTeamWeeksIndexRows({
  cycles,
  tasks,
  teamId,
  teamIdentifier,
  today,
}: {
  readonly cycles: readonly TeamWeeksIndexCycle[];
  readonly tasks: readonly TeamWeeksIndexTask[];
  readonly teamId: string;
  readonly teamIdentifier: string;
  readonly today: string;
}): readonly TeamWeeksIndexRow[] {
  const taskCounts = new Map<
    string,
    { taskCount: number; startedCount: number; completedCount: number }
  >();

  for (const task of tasks) {
    if (task.teamId !== teamId || task.taskState === "canceled") continue;
    const counts = taskCounts.get(task.cycleId) ?? {
      taskCount: 0,
      startedCount: 0,
      completedCount: 0,
    };
    counts.taskCount += 1;
    if (task.taskState === "in_progress" || task.taskState === "done") counts.startedCount += 1;
    if (task.taskState === "done") counts.completedCount += 1;
    taskCounts.set(task.cycleId, counts);
  }

  return [...cycles]
    .sort((left, right) => {
      const leftStatus = getTeamWeekStatus(left, today);
      const rightStatus = getTeamWeekStatus(right, today);
      const statusOrder = { current: 0, upcoming: 1, completed: 2 } as const;
      if (statusOrder[leftStatus] !== statusOrder[rightStatus]) {
        return statusOrder[leftStatus] - statusOrder[rightStatus];
      }
      return leftStatus === "completed"
        ? right.startDate.localeCompare(left.startDate)
        : left.startDate.localeCompare(right.startDate);
    })
    .map((cycle) => {
      const counts = taskCounts.get(cycle.id) ?? {
        taskCount: 0,
        startedCount: 0,
        completedCount: 0,
      };
      const dateRange = formatWeekDateRange(cycle);
      return {
        id: cycle.id,
        completedCount: counts.completedCount,
        completedPercentage:
          counts.taskCount === 0 ? 0 : Math.round((counts.completedCount / counts.taskCount) * 100),
        dateRange,
        description: cycle.description ?? null,
        displayName: cycle.name?.trim() || dateRange,
        href: `/team/${teamIdentifier}/weeks/${cycle.id}`,
        relativeLabel: getTeamWeekRelativeLabel(cycle, today),
        startedCount: counts.startedCount,
        status: getTeamWeekStatus(cycle, today),
        taskCount: counts.taskCount,
      };
    });
}

/**
 * Group the index rows into Current → Upcoming → Completed sections, preserving
 * the within-status ordering produced by buildTeamWeeksIndexRows. Empty
 * sections are dropped so the surface only renders the statuses that exist.
 */
export function groupTeamWeeksIndexRows(
  rows: readonly TeamWeeksIndexRow[],
): readonly TeamWeeksIndexSection[] {
  const order: readonly TeamWeeksIndexStatus[] = ["current", "upcoming", "completed"];
  return order
    .map((status) => ({ status, rows: rows.filter((row) => row.status === status) }))
    .filter((section) => section.rows.length > 0);
}
