import { DEFAULT_WORKFLOW_STATUSES, STARTER_LABELS, STARTER_TEAM_NAMES } from "@church-task/domain";
import { getIdType, getOrgId, getUserId } from "@church-task/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test } from "vitest";

import { createDb } from "./client";
import { bootstrapChurchOnboarding } from "./onboarding-bootstrap";
import { labels, team_memberships, teams, workflow_statuses, workflows } from "./schema";

describe("onboarding product bootstrap", () => {
  test("creates starter Teams, memberships, Workflows, statuses, and Labels", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

      const churchId = getOrgId();
      const userId = getUserId();

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

      expect(teamRows.map((team) => team.name)).toEqual([...STARTER_TEAM_NAMES]);
      expect(teamRows.map((team) => team.identifier)).toEqual(["LEA", "WOR", "KID"]);
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
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
