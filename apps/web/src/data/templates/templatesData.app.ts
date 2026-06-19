import { mutators, queries } from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useCallback } from "react";

export type TemplateCollectionItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly placementShape: string | null;
};

type TemplateMutationResult = Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: { readonly message: string } }
>;

type WeeklyTemplateTaskInput = {
  readonly assignedUserId: string | null;
  readonly description: string | null;
  readonly estimate: string | null;
  readonly key: string;
  readonly labelIds: readonly string[];
  readonly placementCycleOffset: number;
  readonly placementWeekday: number;
  readonly templateTeamKey: string;
  readonly title: string;
};

const mutationResult = async (
  run: () => {
    readonly server: Promise<
      | { readonly type: "success" }
      | { readonly type: "error"; readonly error: { readonly message: string } }
    >;
  },
): TemplateMutationResult => {
  try {
    const result = await run().server;
    if (result.type === "error") return { error: { message: result.error.message }, ok: false };
    return { ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not create Template." },
      ok: false,
    };
  }
};

export function useTemplatesCollection(params: { readonly churchId: string | null }) {
  const [rows, result] = useQuery(
    queries.templates.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection: readonly TemplateCollectionItem[] =
    params.churchId === null
      ? []
      : rows.map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          placementShape: row.placement_shape,
        }));

  return {
    collection,
    loading: params.churchId !== null && result.type !== "complete",
    templatesCollection: collection,
  };
}

export function useCreateWeeklyServiceTemplate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly key: string;
      readonly name: string;
      readonly serviceWeekday: number;
      readonly startDate: string;
      readonly schedule: boolean;
      readonly tasks: readonly WeeklyTemplateTaskInput[];
      readonly templateTeams: readonly {
        readonly key: string;
        readonly mapped_team_id: string;
        readonly name: string;
      }[];
    }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.templates.create({
            church_id: params.churchId,
            focus_windows: [],
            key: params.key,
            name: params.name,
            placement_shape: "weekly_service",
            recurrence: "weekly",
            template_schedule: params.schedule
              ? {
                  end_date: null,
                  key: `${params.key}-schedule`,
                  kind: "weekly",
                  name: params.name,
                  recurrence: "repeating",
                  rule: { kind: "weekly", weekdays: [params.serviceWeekday] },
                  start_date: params.startDate,
                }
              : null,
            template_tasks: params.tasks.map((task) => ({
              assigned_user_id: task.assignedUserId,
              description: task.description,
              estimate: task.estimate,
              key: task.key,
              label_ids: [...task.labelIds],
              parent_template_task_key: null,
              placement_cycle_offset: task.placementCycleOffset,
              placement_weekday: task.placementWeekday,
              scheduling_rule: {
                baseLocalDate: params.startDate,
                dayOffset: task.placementWeekday - params.serviceWeekday,
                kind: "cycleOffset",
                offsetCycles: task.placementCycleOffset,
              },
              template_team_key: task.templateTeamKey,
              title: task.title,
            })),
            template_teams: [...params.templateTeams],
          }),
        ),
      ),
    [zero],
  );
}
