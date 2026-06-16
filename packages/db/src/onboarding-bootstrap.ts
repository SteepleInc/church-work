import {
  DEFAULT_WORKFLOW_STATUSES,
  generateTeamIdentifier,
  getLabelColorForName,
  getTeamColorForName,
  STARTER_LABELS,
  STARTER_TEAM_NAMES,
} from "@church-task/domain";
import {
  getLabelId,
  getTeamId,
  getTeamMembershipId,
  getWorkflowId,
  getWorkflowStatusId,
} from "@church-task/shared/get-ids";
import { and, eq, isNull } from "drizzle-orm";

import type { ChurchTaskDb } from "./client";
import { labels, team_memberships, teams, workflow_statuses, workflows } from "./schema";

export type BootstrapChurchOnboardingArgs = {
  readonly church_id: string;
  readonly user_id: string;
};

export const bootstrapChurchOnboarding = async (
  db: ChurchTaskDb,
  args: BootstrapChurchOnboardingArgs,
) => {
  const existingTeams = await db
    .select({ identifier: teams.identifier })
    .from(teams)
    .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)));
  const takenIdentifiers = existingTeams.map((team) => team.identifier);

  for (const [index, name] of STARTER_TEAM_NAMES.entries()) {
    const identifier = generateTeamIdentifier(name, takenIdentifiers);
    takenIdentifiers.push(identifier);

    const now = new Date();
    const teamId = getTeamId();
    const workflowId = getWorkflowId();

    await db.insert(teams).values({
      _tag: "team",
      church_id: args.church_id,
      color: getTeamColorForName(name),
      created_at: now,
      created_by: args.user_id,
      id: teamId,
      identifier,
      name,
      previous_identifiers: "[]",
      sort_order: index,
      updated_at: now,
      updated_by: args.user_id,
    });

    await db.insert(team_memberships).values({
      _tag: "teammembership",
      church_id: args.church_id,
      created_at: now,
      created_by: args.user_id,
      id: getTeamMembershipId(),
      team_id: teamId,
      updated_at: now,
      updated_by: args.user_id,
      user_id: args.user_id,
    });

    await db.insert(workflows).values({
      _tag: "workflow",
      church_id: args.church_id,
      created_at: now,
      created_by: args.user_id,
      id: workflowId,
      name: `${name} Workflow`,
      team_id: teamId,
      updated_at: now,
      updated_by: args.user_id,
    });

    await db.insert(workflow_statuses).values(
      DEFAULT_WORKFLOW_STATUSES.map((status) => ({
        _tag: "workflowstatus",
        church_id: args.church_id,
        created_at: now,
        created_by: args.user_id,
        id: getWorkflowStatusId(),
        key: status.key,
        name: status.name,
        sort_order: status.sort_order,
        task_state: status.task_state,
        updated_at: now,
        updated_by: args.user_id,
        workflow_id: workflowId,
      })),
    );
  }

  for (const name of STARTER_LABELS) {
    const now = new Date();

    await db.insert(labels).values({
      _tag: "label",
      church_id: args.church_id,
      color: getLabelColorForName(name),
      created_at: now,
      created_by: args.user_id,
      id: getLabelId(),
      name,
      team_id: null,
      updated_at: now,
      updated_by: args.user_id,
    });
  }
};
