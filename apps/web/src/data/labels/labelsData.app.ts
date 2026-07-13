import { getLabelColorForName } from "@church-work/domain";
import { getLabelId } from "@church-work/shared/get-ids";
import { mutators, queries, type Label, type Task } from "@church-work/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useChurchId } from "@/data/useChurchId";

export type LabelItem = {
  readonly id: string;
  readonly churchId: string;
  readonly teamId: string | null;
  readonly name: string;
  readonly color: string;
  // Epoch ms of the Label's creation.
  readonly createdAt: number;
  // Number of Tasks currently carrying this Label.
  readonly taskCount: number;
  // ISO timestamp of the most recent application to a Task, or null.
  readonly lastAppliedAt: string | null;
};

type LabelMutationResult<Data = undefined> = Promise<
  | { readonly ok: true; readonly data: Data }
  | { readonly ok: false; readonly error: { readonly message: string } }
>;
type ZeroMutationResult = {
  readonly server: Promise<
    | { readonly type: "success" }
    | { readonly type: "error"; readonly error: { readonly message: string } }
  >;
};

const parseStringArray = (value: string | null | undefined): readonly string[] => {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const mutationResult = async (run: () => ZeroMutationResult): LabelMutationResult => {
  try {
    const result = await run().server;
    if (result.type === "error") {
      return { error: { message: result.error.message }, ok: false };
    }

    return { data: undefined, ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not update Labels." },
      ok: false,
    };
  }
};

const mapLabel = (label: Label, tasks: readonly Task[]): LabelItem => {
  const matchingTasks = tasks.filter((task) => parseStringArray(task.label_ids).includes(label.id));

  return {
    churchId: label.church_id,
    color: label.color,
    createdAt: label.created_at ?? 0,
    id: label.id,
    lastAppliedAt: null,
    name: label.name,
    taskCount: matchingTasks.length,
    teamId: label.team_id ?? null,
  };
};

/**
 * Church Labels ride along on the work-defaults read (like Workflows), so the
 * picker, cards, and settings page share one cached query.
 */
export function useLabelsCollection(params: { readonly churchId: string | null }) {
  const [labelRows] = useQuery(
    queries.labels.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const [taskRows] = useQuery(
    queries.tasks.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection =
    params.churchId === null ? [] : labelRows.map((label) => mapLabel(label, taskRows));

  return {
    collection,
    labelsCollection: collection,
    loading: false,
  };
}

/**
 * The resolved data a Label hover card renders: the Label's own fields plus the
 * count of Tasks carrying it and the name of its owning Team (a Team Label), or
 * `null` for a Church-wide Label.
 */
export type TaskLabelCard = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly taskCount: number;
  readonly teamName: string | null;
};

/**
 * Resolves a single Label's hover-card data from its id, reading the active
 * Church from ambient context so callers pass only `labelId`. Both sources
 * (Labels + Teams) are Church-scoped, so every Label hover shares the same
 * queries (collapsing to one subscription each). Returns `null` for an unknown
 * Label id.
 */
export function useTaskLabelCard(labelId: string | null): TaskLabelCard | null {
  const churchId = useChurchId();
  const { labelsCollection } = useLabelsCollection({ churchId });
  const { teamsCollection } = useTeamsCollection({ churchId });

  if (labelId === null) return null;
  const label = labelsCollection.find((candidate) => candidate.id === labelId);
  if (!label) return null;

  const teamName =
    label.teamId === null
      ? null
      : (teamsCollection.find((team) => team.id === label.teamId)?.name ?? null);

  return {
    id: label.id,
    name: label.name,
    color: label.color,
    taskCount: label.taskCount,
    teamName,
  };
}

/**
 * Resolves a single Label's current name by id through its own `labels.by_id`
 * subscription, for per-row lookups (e.g. naming a Label referenced in an
 * Activity Feed line). Returns `null` while loading or when the Label is gone,
 * so callers can fall back to a snapshot label. Zero dedupes identical
 * subscriptions, so many rows naming the same Label share one query.
 */
export function useLabelName(params: {
  readonly churchId: string | null;
  readonly labelId: string | null;
}): string | null {
  const [row] = useQuery(
    queries.labels.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: params.labelId ?? "__no_label__",
    }),
    { enabled: params.churchId !== null && params.labelId !== null },
  );

  return row?.name ?? null;
}

export function useCreateLabelMutation() {
  const zero = useZero();
  const churchId = useChurchId();

  return async (params: { readonly name: string }) => {
    if (churchId === null) {
      return { error: { message: "Active Church required." }, ok: false } as const;
    }

    const labelId = getLabelId();
    const result = await mutationResult(() =>
      zero.mutate(
        mutators.labels.create({
          label_id: labelId,
          name: params.name,
        }),
      ),
    );
    if (!result.ok) return result;

    return {
      data: {
        labels: [
          {
            churchId,
            color: getLabelColorForName(params.name),
            createdAt: Date.now(),
            id: labelId,
            lastAppliedAt: null,
            name: params.name,
            taskCount: 0,
            teamId: null,
          },
        ],
      },
      ok: true as const,
    };
  };
}

export function useUpdateLabelMutation() {
  const zero = useZero();

  return (params: { readonly labelId: string; readonly name?: string; readonly color?: string }) =>
    mutationResult(() =>
      zero.mutate(
        mutators.labels.update({
          color: params.color,
          label_id: params.labelId,
          name: params.name,
        }),
      ),
    );
}

export function useDeleteLabelMutation() {
  const zero = useZero();

  return (params: { readonly labelId: string }) =>
    mutationResult(() => zero.mutate(mutators.labels.delete({ label_id: params.labelId })));
}
