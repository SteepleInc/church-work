import {
  DEFAULT_WORKFLOW_STATUSES,
  addLocalDateDays,
  cycleStartDateForLocalDate,
  generateTeamIdentifier,
  getLabelColorForName,
  getTeamColorForName,
  localDateForInstant,
  localMidnightToUtcInstant,
  STARTER_LABELS,
  STARTER_TEAM_NAMES,
} from "@church-task/domain";
import {
  getLabelId,
  getCycleId,
  getTeamId,
  getTeamMembershipId,
  getWorkflowId,
  getWorkflowStatusId,
} from "@church-task/shared/get-ids";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { ChurchTaskDb } from "./client";
import {
  cycles,
  labels,
  organization,
  team_memberships,
  teams,
  workflow_statuses,
  workflows,
} from "./schema";

const currentAndNextCycleStartDates = (churchTimeZone: string, now = new Date()) => {
  const currentCycleStartDate = cycleStartDateForLocalDate(
    localDateForInstant(now, churchTimeZone),
  );

  return [currentCycleStartDate, addLocalDateDays(currentCycleStartDate, 7)] as const;
};

const buildOnboardingCycleInsert = (args: {
  readonly church_id: string;
  readonly churchTimeZone: string;
  readonly createdByUserId: string;
  readonly startDate: string;
}) => ({
  _tag: "cycle" as const,
  church_id: args.church_id,
  church_time_zone: args.churchTimeZone,
  created_by: args.createdByUserId,
  end_date: addLocalDateDays(args.startDate, 6),
  ends_at: localMidnightToUtcInstant(addLocalDateDays(args.startDate, 7), args.churchTimeZone),
  id: getCycleId(),
  start_date: args.startDate,
  starts_at: localMidnightToUtcInstant(args.startDate, args.churchTimeZone),
  updated_by: args.createdByUserId,
});

export type BootstrapChurchOnboardingArgs = {
  readonly church_id: string;
  readonly user_id: string;
};

export const bootstrapChurchOnboarding = async (
  db: ChurchTaskDb,
  args: BootstrapChurchOnboardingArgs,
) => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${args.church_id}))`);

    const [church] = await tx
      .select({ churchTimeZone: organization.churchTimeZone })
      .from(organization)
      .where(eq(organization.id, args.church_id))
      .limit(1);
    const churchTimeZone = church?.churchTimeZone ?? "America/New_York";

    for (const startDate of currentAndNextCycleStartDates(churchTimeZone)) {
      await tx
        .insert(cycles)
        .values(
          buildOnboardingCycleInsert({
            church_id: args.church_id,
            churchTimeZone,
            createdByUserId: args.user_id,
            startDate,
          }),
        )
        .onConflictDoNothing({
          target: [cycles.church_id, cycles.start_date],
          where: sql`${cycles.deleted_at} IS NULL`,
        });
    }

    const existingTeams = await tx
      .select({ identifier: teams.identifier })
      .from(teams)
      .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)));
    const takenIdentifiers = existingTeams.map((team) => team.identifier);

    if (existingTeams.length === 0) {
      for (const [index, name] of STARTER_TEAM_NAMES.entries()) {
        const identifier = generateTeamIdentifier(name, takenIdentifiers);
        takenIdentifiers.push(identifier);

        const now = new Date();
        const teamId = getTeamId();
        const workflowId = getWorkflowId();

        await tx.insert(teams).values({
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

        await tx.insert(team_memberships).values({
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

        await tx.insert(workflows).values({
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

        await tx.insert(workflow_statuses).values(
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
    }

    const existingLabels = await tx
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.church_id, args.church_id), isNull(labels.deleted_at)));

    if (existingLabels.length > 0) return;

    for (const name of STARTER_LABELS) {
      const now = new Date();

      await tx.insert(labels).values({
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
  });
};
