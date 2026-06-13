import { getLabelColorForName, normalizeLabelName } from "@church-task/domain/Label";
import {
  deriveTeamIdentifierBase,
  generateTeamIdentifier,
  getTeamColorForName,
} from "@church-task/domain/Team";
import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { components } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";
import { listLabelsForChurch, STARTER_LABELS } from "./labels";

type MutationCtx = GenericMutationCtx<DataModel>;

type BetterAuthTeam = {
  readonly _id: string;
  readonly name: string;
  readonly identifier?: string | null;
};

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

/**
 * Seed a Team its own To Do / In Progress / Done Workflow (ADR 0013: every
 * Team owns its Workflow; there is no Church default Workflow). Idempotent:
 * a Team that already has a Workflow keeps it, and missing statuses are
 * filled in.
 */
export async function seedTeamWorkflow(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly teamId: string; readonly name: string },
) {
  const existingWorkflow = await ctx.db
    .query("workflows")
    .withIndex("by_churchId_and_teamId", (q) =>
      q.eq("churchId", args.churchId).eq("teamId", args.teamId),
    )
    .first();

  const workflowId =
    existingWorkflow?._id ??
    (await ctx.db.insert("workflows", {
      churchId: args.churchId,
      teamId: args.teamId,
      key: `team-${args.teamId}`,
      name: args.name,
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
        churchId: args.churchId,
        workflowId,
        ...status,
        archivedAt: null,
      });
    }
  }

  return { workflowId };
}

export async function seedDefaultWorkModel(ctx: MutationCtx, churchId: string) {
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
  // Teams created before identifiers were stored count their name-derived
  // base as taken, matching the read-path fallback.
  const takenIdentifiers = existingTeams.page.map(
    (team) => team.identifier ?? deriveTeamIdentifierBase(team.name),
  );

  for (const [sortOrder, name] of STARTER_TEAMS.entries()) {
    if (!existingTeamNames.has(name)) {
      const identifier = generateTeamIdentifier(name, takenIdentifiers);
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
            color: getTeamColorForName(name),
            identifier,
            previousIdentifiers: [],
          },
        },
      });
      existingTeamNames.add(name);
      takenIdentifiers.push(identifier);
    }
  }

  // Every Team owns its Workflow (ADR 0013): seed one for any Team in the
  // Church that does not have one yet (covers Starter Teams just created
  // above and is idempotent on re-runs).
  const allTeams = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "team",
    where: [{ field: "organizationId", value: churchId }],
    paginationOpts: { cursor: null, numItems: 100 },
  })) as { readonly page: ReadonlyArray<BetterAuthTeam> };

  for (const team of allTeams.page) {
    await seedTeamWorkflow(ctx, { churchId, teamId: team._id, name: team.name });
  }

  return null;
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
