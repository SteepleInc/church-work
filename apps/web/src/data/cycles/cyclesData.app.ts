import { mutators, queries, type Cycle } from "@church-task/zero";
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
