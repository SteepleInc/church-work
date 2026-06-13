import { getLabelColorForName, normalizeLabelName } from "@church-task/domain/Label";
import { getTeamColorForName } from "@church-task/domain/Team";
import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { components } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";
import { listLabelsForChurch, STARTER_LABELS } from "./labels";

type MutationCtx = GenericMutationCtx<DataModel>;

type BetterAuthTeam = {
  readonly name: string;
};

const DEFAULT_WORKFLOW_KEY = "church-default";

const DEFAULT_WORKFLOW_STATUSES = [
  { key: "to-do", name: "To Do", taskState: "todo", sortOrder: 0 },
  { key: "in-progress", name: "In Progress", taskState: "in_progress", sortOrder: 1 },
  { key: "done", name: "Done", taskState: "done", sortOrder: 2 },
] as const;

const STARTER_TEAMS = [
  "Worship",
  "Production",
  "Kids",
  "Experience",
  "Facilities",
  "Social Media",
] as const;

const STARTER_KEY_DATES = [
  {
    key: "christmas",
    name: "Christmas",
    schedule: { kind: "fixedYearly", month: 12, day: 25 },
  },
  {
    key: "easter",
    name: "Easter",
    schedule: { kind: "computedYearly", rule: "easter" },
  },
  {
    key: "palm-sunday",
    name: "Palm Sunday",
    schedule: { kind: "computedYearly", rule: "palm_sunday" },
  },
  {
    key: "pentecost",
    name: "Pentecost",
    schedule: { kind: "computedYearly", rule: "pentecost" },
  },
  {
    key: "mothers-day",
    name: "Mother's Day",
    schedule: { kind: "computedYearly", rule: "mothers_day" },
  },
  {
    key: "fathers-day",
    name: "Father's Day",
    schedule: { kind: "computedYearly", rule: "fathers_day" },
  },
] as const;

export async function seedDefaultWorkModel(ctx: MutationCtx, churchId: string) {
  const existingWorkflow = await ctx.db
    .query("workflows")
    .withIndex("by_churchId_and_key", (q) =>
      q.eq("churchId", churchId).eq("key", DEFAULT_WORKFLOW_KEY),
    )
    .unique();

  const workflowId =
    existingWorkflow?._id ??
    (await ctx.db.insert("workflows", {
      churchId,
      key: DEFAULT_WORKFLOW_KEY,
      name: "Default Workflow",
      isDefault: true,
      sortOrder: 0,
      archivedAt: null,
    }));

  for (const status of DEFAULT_WORKFLOW_STATUSES) {
    const existingStatus = await ctx.db
      .query("workflowStatuses")
      .withIndex("by_workflowId_and_key", (q) =>
        q.eq("workflowId", workflowId).eq("key", status.key),
      )
      .unique();

    if (!existingStatus) {
      await ctx.db.insert("workflowStatuses", {
        churchId,
        workflowId,
        ...status,
        archivedAt: null,
      });
    }
  }

  for (const keyDate of STARTER_KEY_DATES) {
    const existingKeyDate = await ctx.db
      .query("keyDates")
      .withIndex("by_churchId_and_key", (q) => q.eq("churchId", churchId).eq("key", keyDate.key))
      .unique();

    if (!existingKeyDate) {
      await ctx.db.insert("keyDates", {
        churchId,
        ...keyDate,
        archivedAt: null,
      });
    }
  }

  // Starter Labels (see CONTEXT.md): Church-scoped, seeded idempotently by
  // case-insensitive name. The seed runs at Church creation (and as a manual
  // one-time backfill for pre-existing Churches), so it never duplicates.
  const existingLabels = await listLabelsForChurch(ctx, churchId);
  const existingLabelNames = new Set(existingLabels.map((label) => normalizeLabelName(label.name)));

  for (const name of STARTER_LABELS) {
    if (!existingLabelNames.has(normalizeLabelName(name))) {
      await ctx.db.insert("labels", {
        churchId,
        teamId: null,
        name,
        color: getLabelColorForName(name),
      });
      existingLabelNames.add(normalizeLabelName(name));
    }
  }

  const existingTeams = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "team",
    where: [{ field: "organizationId", value: churchId }],
    paginationOpts: { cursor: null, numItems: 100 },
  })) as { readonly page: ReadonlyArray<BetterAuthTeam> };
  const existingTeamNames = new Set(existingTeams.page.map((team) => team.name));

  for (const [sortOrder, name] of STARTER_TEAMS.entries()) {
    if (!existingTeamNames.has(name)) {
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "team",
          data: {
            name,
            organizationId: churchId,
            createdAt: Date.now(),
            updatedAt: null,
            archivedAt: null,
            sortOrder,
            defaultWorkflowId: null,
            color: getTeamColorForName(name),
          },
        },
      });
      existingTeamNames.add(name);
    }
  }

  return { workflowId };
}

export async function readDefaultWorkModel(
  ctx: { readonly db: GenericDatabaseReader<DataModel> },
  churchId: string,
) {
  const workflows = await ctx.db
    .query("workflows")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const workflowStatuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const keyDates = await ctx.db
    .query("keyDates")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const labels = await listLabelsForChurch(ctx, churchId);

  return {
    workflows,
    workflowStatuses,
    keyDates,
    labels,
  };
}
