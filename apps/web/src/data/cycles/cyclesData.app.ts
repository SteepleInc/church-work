import { mutators, queries, type Cycle } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type CycleCollectionItem = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly name: string | null;
  readonly description: string | null;
  readonly displayName: string;
};

type CycleMutationResult = Promise<
  | { readonly ok: true; readonly data: undefined }
  | { readonly ok: false; readonly error: { readonly message: string } }
>;
type ZeroMutationResult = {
  readonly server: Promise<
    | { readonly type: "success" }
    | { readonly type: "error"; readonly error: { readonly message: string } }
  >;
};

const parseIsoDate = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

/**
 * A Week always runs Monday–Sunday, so the range is shown compactly:
 * "Jun 15 – 21" within a month, "Jun 29 – Jul 5" across months, and the year
 * is appended only when the Week falls outside the current year. When a date
 * cannot be parsed we fall back to the raw ISO range so nothing is hidden.
 */
export const formatWeekDateRange = (
  cycle: {
    readonly startDate: string;
    readonly endDate: string;
  },
  now: Date = new Date(),
) => {
  const start = parseIsoDate(cycle.startDate);
  const end = parseIsoDate(cycle.endDate);
  if (!start || !end) return `${cycle.startDate} – ${cycle.endDate}`;

  const sameYear =
    start.getFullYear() === now.getFullYear() && end.getFullYear() === now.getFullYear();
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const yearOption = sameYear ? {} : { year: "numeric" as const };

  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...yearOption,
  });
  const endLabel = end.toLocaleDateString("en-US", {
    ...(sameMonth ? {} : { month: "short" }),
    day: "numeric",
    ...yearOption,
  });

  return `${startLabel} – ${endLabel}`;
};

export const getWeekDisplayName = (
  cycle: {
    readonly name: string | null;
    readonly startDate: string;
    readonly endDate: string;
  },
  now: Date = new Date(),
) => cycle.name?.trim() || formatWeekDateRange(cycle, now);

// --- Week picker options ----------------------------------------------------
// The rich rows the Week picker renders, mirroring Linear's cycle picker but in
// our domain language (Week, not Cycle): a status, the Week's name, its date
// range and a short relative cue ("Current"/"Next week"/"Last week"). The
// picker pairs each row with a live Task count fetched per-row.

export type WeekPickerStatus = "current" | "upcoming" | "completed";

export type WeekPickerOption = {
  readonly id: string;
  /** The Week's primary label (custom name, else its date range). */
  readonly label: string;
  /** Compact Monday–Sunday range, e.g. "Jun 21 – Jul 18". */
  readonly dateRange: string;
  /** ISO start date (YYYY-MM-DD), used to order and curate the picker window. */
  readonly startDate: string;
  readonly status: WeekPickerStatus;
  /** A short cue like "Current", "Next week" or "Last week"; null when none applies. */
  readonly relativeLabel: string | null;
  /** Lowercased haystack (name + date range + cue) the picker filters against. */
  readonly searchText: string;
};

const isoDaysBetween = (from: string, to: string): number | null => {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null;
  return Math.round((toTime - fromTime) / 86_400_000);
};

const weekPickerStatus = (
  cycle: { readonly startDate: string; readonly endDate: string },
  today: string,
): WeekPickerStatus => {
  if (cycle.startDate <= today && today <= cycle.endDate) return "current";
  if (cycle.startDate > today) return "upcoming";
  return "completed";
};

const weekPickerRelativeLabel = (
  cycle: { readonly startDate: string; readonly endDate: string },
  today: string,
): string | null => {
  const status = weekPickerStatus(cycle, today);
  if (status === "current") return "Current";
  if (status === "upcoming") {
    const daysUntilStart = isoDaysBetween(today, cycle.startDate);
    return daysUntilStart !== null && daysUntilStart <= 7 ? "Next week" : "Upcoming";
  }
  const daysSinceEnd = isoDaysBetween(cycle.endDate, today);
  return daysSinceEnd !== null && daysSinceEnd <= 7 ? "Last week" : "Previous";
};

/**
 * Build the Week picker's rich rows from a set of cycles, in chronological
 * order (earliest Week first) so the timeline reads top-to-bottom regardless of
 * whether a Week is past, current, or upcoming. Projected/ghost Weeks (no
 * persisted Cycle id) are dropped — a Task can only be moved to a real Week.
 */
export function buildWeekPickerOptions(
  cycles: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly startDate: string;
    readonly endDate: string;
    readonly projected?: boolean;
  }[],
  today: string,
  now: Date = new Date(),
): readonly WeekPickerOption[] {
  return cycles
    .filter((cycle) => cycle.projected !== true)
    .map((cycle): WeekPickerOption => {
      const label = getWeekDisplayName(cycle, now);
      const dateRange = formatWeekDateRange(cycle, now);
      const relativeLabel = weekPickerRelativeLabel(cycle, today);
      return {
        id: cycle.id,
        startDate: cycle.startDate,
        label,
        dateRange,
        status: weekPickerStatus(cycle, today),
        relativeLabel,
        searchText: `${label} ${dateRange} ${relativeLabel ?? ""}`.toLowerCase(),
      };
    })
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

/**
 * The curated default window the Week picker shows before the user searches,
 * mirroring Linear: the most-recent Previous Week (shown in its own section),
 * the Current Week, and up to the next two Upcoming Weeks. Searching bypasses
 * this window and filters the full list instead.
 */
export function curateWeekPickerOptions(options: readonly WeekPickerOption[]): {
  readonly previous: readonly WeekPickerOption[];
  readonly currentAndUpcoming: readonly WeekPickerOption[];
} {
  const previousAll = options.filter((option) => option.status === "completed");
  const previous = previousAll.slice(-1);
  const current = options.filter((option) => option.status === "current");
  const upcoming = options.filter((option) => option.status === "upcoming").slice(0, 2);
  return { previous, currentAndUpcoming: [...current, ...upcoming] };
}

const mutationResult = async (run: () => ZeroMutationResult): CycleMutationResult => {
  try {
    const result = await run().server;
    if (result.type === "error") {
      return { error: { message: result.error.message }, ok: false };
    }

    return { data: undefined, ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not update Week." },
      ok: false,
    };
  }
};

const mapCycle = (cycle: Cycle): CycleCollectionItem => ({
  description: cycle.description ?? null,
  displayName: getWeekDisplayName({
    endDate: cycle.end_date,
    name: cycle.name ?? null,
    startDate: cycle.start_date,
  }),
  endDate: cycle.end_date,
  endsAt: cycle.ends_at,
  id: cycle.id,
  name: cycle.name ?? null,
  startDate: cycle.start_date,
  startsAt: cycle.starts_at,
});

/**
 * Live count of the Tasks scoped to a single Week, used by the Week picker's
 * trailing count (Linear shows the issue count beside each cycle). Canceled
 * Tasks are excluded so the number matches the Weeks index counting. A null
 * `cycleId` (the "No week" row) is not counted here — that row's count is the
 * set of Tasks with no Week, which the picker passes in directly.
 */
export function useWeekTaskCount(params: {
  readonly churchId: string | null;
  readonly cycleId: string | null;
}): number {
  const [rows] = useQuery(
    queries.tasks.by_cycle({
      church_id: params.churchId ?? "__no_church__",
      cycle_id: params.cycleId ?? "__no_cycle__",
    }),
  );

  if (params.churchId === null || params.cycleId === null) return 0;

  return rows.filter((task) => task.task_state !== "canceled").length;
}

export function useCyclesCollection(params: {
  readonly churchId: string | null;
  readonly currentUserId: string | null;
}) {
  const [rows] = useQuery(
    queries.cycles.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection =
    params.churchId === null || params.currentUserId === null ? [] : rows.map(mapCycle);

  return {
    loading: false,
    collection,
    cyclesCollection: collection,
  };
}

export function useUpdateWeekDetailsMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly cycleId: string;
    readonly name: string | null;
    readonly description: string | null;
  }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.cycles.updateDetails({
          church_id: params.churchId,
          cycle_id: params.cycleId,
          description: params.description,
          name: params.name,
        }),
      ),
    );
}
