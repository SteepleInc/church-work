import { getDemoItemId, getUserId } from "@church-work/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test } from "vitest";

import { createDb } from "./client";
import { baseEntityFields, demo_items, drafts, task_drafts } from "./schema";

describe("schema foundation", () => {
  test("applies migrations and enforces foundation conventions", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

      const foreignKeys = await pool.query<{ constraint_name: string }>(
        "select constraint_name from information_schema.table_constraints where table_schema = 'public' and constraint_type = 'FOREIGN KEY'",
      );
      const genericLifecycleColumns = await pool.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name not in ('invitation') and column_name in ('status', 'inactivated_at', 'inactivated_by')",
      );

      const userId = getUserId();
      const churchId = "org_schema_foundation";
      const draftId = "draft_schema_foundation";
      const liveId = getDemoItemId();
      const deletedId = getDemoItemId();

      await db.insert(demo_items).values({
        _tag: "demo_item",
        created_by: userId,
        id: liveId,
        name: "Unique live item",
        owner_user_id: userId,
        updated_by: userId,
      });

      await db.insert(drafts).values({
        _tag: "draft",
        church_id: churchId,
        created_by: userId,
        id: draftId,
        kind: "task",
        owner_user_id: userId,
        updated_by: userId,
      });

      await db.insert(task_drafts).values({
        _tag: "task_draft",
        church_id: churchId,
        created_by: userId,
        draft_id: draftId,
        id: "task_draft_schema_foundation",
        owner_user_id: userId,
        updated_by: userId,
      });

      await expect(
        pool.query(
          "insert into drafts (id, _tag, church_id, owner_user_id, kind) values ('draft_invalid_kind', 'draft', $1, $2, 'template')",
          [churchId, userId],
        ),
      ).rejects.toThrow(/drafts_kind_check/u);

      await expect(
        db.insert(demo_items).values({
          _tag: "demo_item",
          created_by: userId,
          id: getDemoItemId(),
          name: "Unique live item",
          owner_user_id: userId,
          updated_by: userId,
        }),
      ).rejects.toThrow(/Failed query/u);

      await db.insert(demo_items).values({
        _tag: "demo_item",
        created_by: userId,
        deleted_at: new Date(),
        deleted_by: userId,
        id: deletedId,
        name: "Unique live item",
        owner_user_id: userId,
        updated_by: userId,
      });

      const [row] = await db.select().from(demo_items).where(eq(demo_items.id, liveId));
      const [taskDraftRow] = await db
        .select()
        .from(task_drafts)
        .where(eq(task_drafts.draft_id, draftId));

      expect(foreignKeys.rows).toEqual([{ constraint_name: "task_drafts_draft_id_drafts_id_fk" }]);
      expect(genericLifecycleColumns.rows).toEqual([]);
      expect(Object.keys(baseEntityFields).sort()).toEqual([
        "_tag",
        "created_at",
        "created_by",
        "deleted_at",
        "deleted_by",
        "updated_at",
        "updated_by",
      ]);
      expect(row).toMatchObject({
        _tag: "demo_item",
        created_by: userId,
        deleted_at: null,
        deleted_by: null,
        id: liveId,
        name: "Unique live item",
        owner_user_id: userId,
        updated_by: userId,
      });
      expect(row?.created_at).toBeInstanceOf(Date);
      expect(row?.updated_at).toBeInstanceOf(Date);
      expect(taskDraftRow).toMatchObject({
        assigned_user_id: null,
        description: null,
        draft_id: draftId,
        label_ids: "[]",
        owner_user_id: userId,
        parent_task_id: null,
        priority: null,
        team_id: null,
        title: null,
        workflow_status_id: null,
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
