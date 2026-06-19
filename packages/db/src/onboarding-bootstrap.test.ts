import {
  DEFAULT_WORKFLOW_STATUSES,
  STARTER_KEY_DATES,
  STARTER_LABELS,
  STARTER_TEAM_NAMES,
  addLocalDateDays,
  cycleStartDateForLocalDate,
  localDateForInstant,
} from "@church-task/domain";
import { getIdType, getOrgId, getUserId } from "@church-task/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test } from "vitest";

import { createDb } from "./client";
import { bootstrapChurchOnboarding } from "./onboarding-bootstrap";
import {
  cycles,
  key_dates,
  labels,
  organization,
  team_memberships,
  teams,
  workflow_statuses,
  workflows,
} from "./schema";

const currentCycleStartDate = (timeZone: string) => {
  return cycleStartDateForLocalDate(localDateForInstant(new Date(), timeZone));
};

describe("onboarding product bootstrap", () => {
  test("creates starter Teams, memberships, Workflows, statuses, and Labels", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

      const churchId = getOrgId();
      const userId = getUserId();

      await db.insert(organization).values({
        _tag: "org",
        churchTimeZone: "America/New_York",
        completedOnboarding: false,
        id: churchId,
        name: "Onboarding Church",
        slug: churchId,
      });

      await bootstrapChurchOnboarding(db, { church_id: churchId, user_id: userId });

      const teamRows = await db.select().from(teams).where(eq(teams.church_id, churchId));
      const membershipRows = await db
        .select()
        .from(team_memberships)
        .where(eq(team_memberships.church_id, churchId));
      const workflowRows = await db
        .select()
        .from(workflows)
        .where(eq(workflows.church_id, churchId));
      const statusRows = await db
        .select()
        .from(workflow_statuses)
        .where(eq(workflow_statuses.church_id, churchId));
      const labelRows = await db.select().from(labels).where(eq(labels.church_id, churchId));
      const keyDateRows = await db
        .select()
        .from(key_dates)
        .where(eq(key_dates.church_id, churchId));
      const cycleRows = await db.select().from(cycles).where(eq(cycles.church_id, churchId));

      expect(teamRows.map((team) => team.name)).toEqual([...STARTER_TEAM_NAMES]);
      expect(teamRows.map((team) => team.identifier)).toEqual([
        "WOR",
        "PRO",
        "KID",
        "EXP",
        "FAC",
        "SOC",
      ]);
      expect(teamRows.every((team) => getIdType(team.id) === "team")).toBe(true);
      expect(membershipRows).toHaveLength(STARTER_TEAM_NAMES.length);
      expect(membershipRows.every((membership) => membership.user_id === userId)).toBe(true);
      expect(workflowRows).toHaveLength(STARTER_TEAM_NAMES.length);
      expect(statusRows).toHaveLength(STARTER_TEAM_NAMES.length * DEFAULT_WORKFLOW_STATUSES.length);
      expect(statusRows.map((status) => status.key).sort()).toEqual(
        STARTER_TEAM_NAMES.flatMap(() =>
          DEFAULT_WORKFLOW_STATUSES.map((status) => status.key),
        ).sort(),
      );
      expect(labelRows.map((label) => label.name).sort()).toEqual([...STARTER_LABELS].sort());
      expect(labelRows.every((label) => label.team_id === null)).toBe(true);
      expect(keyDateRows.map((keyDate) => keyDate.key).sort()).toEqual(
        STARTER_KEY_DATES.map((keyDate) => keyDate.key).sort(),
      );
      expect(keyDateRows.map((keyDate) => JSON.parse(keyDate.schedule).kind)).toContain(
        "computedYearly",
      );
      expect(cycleRows.map((cycle) => cycle.start_date).sort()).toHaveLength(2);

      await bootstrapChurchOnboarding(db, { church_id: churchId, user_id: userId });
      const secondCycleRows = await db.select().from(cycles).where(eq(cycles.church_id, churchId));
      const secondKeyDateRows = await db
        .select()
        .from(key_dates)
        .where(eq(key_dates.church_id, churchId));
      expect(secondCycleRows).toHaveLength(2);
      expect(secondKeyDateRows).toHaveLength(STARTER_KEY_DATES.length);
      expect(secondCycleRows.map((cycle) => cycle.start_date).sort()).toEqual([
        currentCycleStartDate("America/New_York"),
        addLocalDateDays(currentCycleStartDate("America/New_York"), 7),
      ]);
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
