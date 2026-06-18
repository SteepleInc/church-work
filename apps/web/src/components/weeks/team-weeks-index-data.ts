import {
  addLocalDateDays,
  cycleStartDateForLocalDate,
  localMidnightToUtcInstant,
} from "@church-task/domain";

import { formatWeekDateRange } from "@/data/cycles/cyclesData.app";

export type TeamWeeksIndexStatus = "current" | "upcoming" | "completed";

export type TeamWeeksIndexCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
  readonly description?: string | null;
  readonly startsAt?: number;
  readonly endsAt?: number;
  readonly projected?: boolean;
  readonly targetCycle?: TeamWeeksTargetCycle;
};

export type TeamWeeksTargetCycle = {
  readonly churchTimeZone: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly startsAt: string;
  readonly endsAt: string;
};

export type TeamWeeksIndexTask = {
  readonly id: string;
  readonly cycleId: string | null;
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
  readonly projected: boolean;
  readonly targetCycle: TeamWeeksTargetCycle;
};

export function buildTargetCycle(args: {
  readonly churchTimeZone: string;
  readonly startDate: string;
}): TeamWeeksTargetCycle {
  const endDate = addLocalDateDays(args.startDate, 6);
  return {
    churchTimeZone: args.churchTimeZone,
    endDate,
    endsAt: localMidnightToUtcInstant(
      addLocalDateDays(args.startDate, 7),
      args.churchTimeZone,
    ).toISOString(),
    startDate: args.startDate,
    startsAt: localMidnightToUtcInstant(args.startDate, args.churchTimeZone).toISOString(),
  };
}

export function buildProjectedWeekCycles(args: {
  readonly cycles: readonly TeamWeeksIndexCycle[];
  readonly today: string;
  readonly churchTimeZone: string;
  readonly pastWeeks?: number;
  readonly futureWeeks?: number;
}): readonly TeamWeeksIndexCycle[] {
  const currentStart = cycleStartDateForLocalDate(args.today);
  const pastWeeks = args.pastWeeks ?? 2;
  const futureWeeks = args.futureWeeks ?? 8;
  const byStartDate = new Map(args.cycles.map((cycle) => [cycle.startDate, cycle]));

  for (let offset = -pastWeeks; offset <= futureWeeks; offset += 1) {
    const startDate = addLocalDateDays(currentStart, offset * 7);
    if (byStartDate.has(startDate)) continue;
    const target = buildTargetCycle({ churchTimeZone: args.churchTimeZone, startDate });
    byStartDate.set(startDate, {
      id: `projected-week:${startDate}`,
      description: null,
      endDate: target.endDate,
      endsAt: Date.parse(target.endsAt),
      name: null,
      projected: true,
      startDate,
      startsAt: Date.parse(target.startsAt),
      targetCycle: target,
    });
  }

  return [...byStartDate.values()].map((cycle) => ({
    ...cycle,
    targetCycle:
      cycle.targetCycle ??
      buildTargetCycle({ churchTimeZone: args.churchTimeZone, startDate: cycle.startDate }),
  }));
}

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
  churchTimeZone = "UTC",
}: {
  readonly cycles: readonly TeamWeeksIndexCycle[];
  readonly tasks: readonly TeamWeeksIndexTask[];
  readonly teamId: string;
  readonly teamIdentifier: string;
  readonly today: string;
  readonly churchTimeZone?: string;
}): readonly TeamWeeksIndexRow[] {
  const taskCounts = new Map<
    string,
    { taskCount: number; startedCount: number; completedCount: number }
  >();

  for (const task of tasks) {
    if (task.teamId !== teamId || task.taskState === "canceled") continue;
    if (task.cycleId === null) continue;
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
      const targetCycle =
        cycle.targetCycle ??
        buildTargetCycle({
          churchTimeZone,
          startDate: cycle.startDate,
        });
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
        projected: cycle.projected ?? false,
        targetCycle,
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

// ---------------------------------------------------------------------------
// Linear "Cycles"-style timeline layout
//
// The Weeks view mirrors Linear's Cycles screen: a single chronological list
// of Weeks (furthest-out Week on top, oldest at the bottom) sitting beside a
// vertical timeline rail. Each row aligns to a dot on the rail, and the live
// Week's span is highlighted so a User reads "where am I in time" at a glance.
// ---------------------------------------------------------------------------

/**
 * One row in the chronological Weeks list. Extends the counting-oriented
 * {@link TeamWeeksIndexRow} with the chronological ordinal Linear shows as the
 * Week's primary name ("Cycle 5" → "Week 5") and the compact `start`/`end`
 * labels the timeline rail and burndown axis read from.
 */
export type TeamWeeksTimelineRow = TeamWeeksIndexRow & {
  /**
   * The Week's chronological position across all generated Weeks, oldest = 1.
   * Used as the headline label so Weeks read like Linear Cycles ("Week 5").
   */
  readonly ordinal: number;
  readonly startLabel: string;
  readonly endLabel: string;
};

function formatTimelineLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Build the chronological Weeks list for the timeline layout. Weeks are ordered
 * newest/furthest-out first (descending start date) to match Linear, and each
 * carries its chronological ordinal so the headline reads "Week N".
 */
export function buildTeamWeeksTimelineRows(args: {
  readonly cycles: readonly TeamWeeksIndexCycle[];
  readonly tasks: readonly TeamWeeksIndexTask[];
  readonly teamId: string;
  readonly teamIdentifier: string;
  readonly today: string;
  readonly churchTimeZone?: string;
}): readonly TeamWeeksTimelineRow[] {
  const rows = buildTeamWeeksIndexRows(args);

  // Ordinal is chronological (oldest Week = 1), independent of display order.
  const ordinalById = new Map<string, number>();
  [...args.cycles]
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .forEach((cycle, index) => ordinalById.set(cycle.id, index + 1));

  const cycleById = new Map(args.cycles.map((cycle) => [cycle.id, cycle]));

  return [...rows]
    .sort((left, right) => {
      const leftCycle = cycleById.get(left.id);
      const rightCycle = cycleById.get(right.id);
      if (!leftCycle || !rightCycle) return 0;
      return rightCycle.startDate.localeCompare(leftCycle.startDate);
    })
    .map((row) => {
      const cycle = cycleById.get(row.id);
      return {
        ...row,
        ordinal: ordinalById.get(row.id) ?? 0,
        startLabel: cycle ? formatTimelineLabel(cycle.startDate) : "",
        endLabel: cycle ? formatTimelineLabel(cycle.endDate) : "",
      };
    });
}

// ---------------------------------------------------------------------------
// Burndown series for the expanded Week
// ---------------------------------------------------------------------------

export type TeamWeekBurndownPoint = {
  /** Day label, e.g. "Mon" or "Jun 8". */
  readonly label: string;
  /** Fractional position along the x-axis, 0..1. */
  readonly t: number;
  /** Scope (total scoped Tasks) at this point. */
  readonly scope: number;
  /** Ideal remaining-scope guide (scope counting down to 0). */
  readonly ideal: number;
  /** Started count (in_progress + done) at this point. */
  readonly started: number;
  /** Completed (done) count at this point. */
  readonly completed: number;
};

export type TeamWeekBurndown = {
  readonly scope: number;
  readonly started: number;
  readonly completed: number;
  readonly startedPercentage: number;
  readonly completedPercentage: number;
  readonly points: readonly TeamWeekBurndownPoint[];
  readonly axisLabels: readonly string[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Build a 7-point (Mon–Sun) burndown-style series for a Week. We do not store
 * historical daily snapshots, so the chart shows the Week's *current* totals as
 * flat scope/started/completed lines against an ideal countdown guide — the
 * same shape Linear renders for an in-progress Cycle. As real per-day history
 * lands this becomes a true burndown without changing the view.
 */
export function buildTeamWeekBurndown(args: {
  readonly scope: number;
  readonly started: number;
  readonly completed: number;
  readonly startLabel: string;
  readonly endLabel: string;
}): TeamWeekBurndown {
  const { scope, started, completed } = args;
  const lastIndex = DAY_LABELS.length - 1;
  const points: TeamWeekBurndownPoint[] = DAY_LABELS.map((label, index) => ({
    label,
    t: index / lastIndex,
    scope,
    ideal: scope * (1 - index / lastIndex),
    started,
    completed,
  }));

  return {
    scope,
    started,
    completed,
    startedPercentage: scope === 0 ? 0 : Math.round((started / scope) * 100),
    completedPercentage: scope === 0 ? 0 : Math.round((completed / scope) * 100),
    points,
    axisLabels: [args.startLabel, args.endLabel],
  };
}
