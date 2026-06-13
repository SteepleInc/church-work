import { parseTaskIdentifier } from "@church-task/domain/Task";
import { deriveTeamIdentifierBase, normalizeTeamIdentifier } from "@church-task/domain/Team";
import type { GenericDatabaseReader, GenericQueryCtx } from "convex/server";

import { components } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";

/**
 * Identifier resolution (ADR 0013): church + identifier string in, Task out.
 *
 * Matching is case-insensitive. Current identifiers always win over
 * previous-identifier aliases:
 *
 * 1. Find the Team whose current Team Identifier matches the prefix and look
 *    up the Task by team + number.
 * 2. Fall back to Teams whose previous-identifiers list contains the prefix
 *    (a Team Identifier change keeps old links working).
 * 3. Fall back to the Task previous-identifiers list (a team move renumbers
 *    the Task but remembers the old Task Identifier).
 *
 * Shared by the URL layer, the details pane, and the MCP surface.
 */

type ResolutionCtx = {
  readonly db: GenericDatabaseReader<DataModel>;
  readonly runQuery: GenericQueryCtx<DataModel>["runQuery"];
};

type ResolutionTeam = {
  readonly _id: string;
  readonly name: string;
  readonly identifier?: string | null;
  readonly previousIdentifiers?: ReadonlyArray<string> | null;
};

// Teams created outside the app's create paths may lack a stored identifier;
// fall back to the same name-derived base the create path would have used
// (mirrors `currentTeamIdentifier` in confect/app.impl.ts).
const currentIdentifierOf = (team: ResolutionTeam) =>
  normalizeTeamIdentifier(team.identifier ?? deriveTeamIdentifierBase(team.name));

async function readChurchTeams(ctx: ResolutionCtx, churchId: string) {
  const teams = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "team",
    where: [{ field: "organizationId", value: churchId }],
    paginationOpts: { cursor: null, numItems: 100 },
  })) as { readonly page: ReadonlyArray<ResolutionTeam> };

  return teams.page;
}

async function findTaskByTeamAndNumber(
  ctx: ResolutionCtx,
  churchId: string,
  teamId: string,
  taskNumber: number,
) {
  return await ctx.db
    .query("tasks")
    .withIndex("by_churchId_and_teamId_and_number", (q) =>
      q.eq("churchId", churchId).eq("teamId", teamId).eq("number", taskNumber),
    )
    .first();
}

export async function resolveTaskByIdentifier(
  ctx: ResolutionCtx,
  churchId: string,
  identifier: string,
): Promise<DataModel["tasks"]["document"] | null> {
  const normalized = identifier.trim().toUpperCase();
  const parsed = parseTaskIdentifier(normalized);

  // Aliases are stored in canonical identifier form, so a string that does
  // not parse as a Task Identifier cannot resolve to anything.
  if (!parsed) return null;

  const teams = await readChurchTeams(ctx, churchId);

  // Current wins: the Team currently holding the prefix is checked first,
  // even when another Team retired that prefix into its aliases.
  const currentTeam = teams.find((team) => currentIdentifierOf(team) === parsed.teamIdentifier);
  if (currentTeam) {
    const task = await findTaskByTeamAndNumber(ctx, churchId, currentTeam._id, parsed.taskNumber);
    if (task) return task;
  }

  // Team-alias fallback: a Team Identifier change keeps old links resolving.
  for (const team of teams) {
    if (team._id === currentTeam?._id) continue;
    const aliases = (team.previousIdentifiers ?? []).map(normalizeTeamIdentifier);
    if (!aliases.includes(parsed.teamIdentifier)) continue;

    const task = await findTaskByTeamAndNumber(ctx, churchId, team._id, parsed.taskNumber);
    if (task) return task;
  }

  // Task-alias fallback: a team move renumbers the Task but appends its old
  // Task Identifier to the task's previous-identifiers list.
  const churchTasks = await ctx.db
    .query("tasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();

  return (
    churchTasks.find((task) =>
      task.previousIdentifiers.some((alias) => alias.trim().toUpperCase() === normalized),
    ) ?? null
  );
}
