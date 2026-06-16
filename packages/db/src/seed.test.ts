import { getIdType } from "@church-task/shared/get-ids";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, test } from "vitest";

import { createDb } from "./client";
import { resetAndSeedDatabase, resetSeededData, seedDatabase } from "./seed";
import { demo_items, user } from "./schema";

describe("seed and reset harness", () => {
  test("supports empty, app, and admin profiles after migrations", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

      const empty = await resetAndSeedDatabase(db, "empty");
      const emptyUsers = await db.select().from(user);
      const emptyItems = await db.select().from(demo_items);

      expect(empty).toEqual({ demo_items: [], profile: "empty", users: [] });
      expect(emptyUsers).toEqual([]);
      expect(emptyItems).toEqual([]);

      const app = await resetAndSeedDatabase(db, "app");
      const appUser = app.users[0];
      const appItem = app.demo_items[0];

      expect(appUser).toMatchObject({
        email: "avery.member@church-task.test",
        name: "Avery Member",
        slug: "avery-member",
      });
      expect(appItem).toMatchObject({
        name: "App profile demo item",
        owner_user_id: appUser?.id,
        slug: "app-profile-demo-item",
      });
      expect(getIdType(appUser?.id ?? "")).toBe("user");
      expect(getIdType(appItem?.id ?? "")).toBe("demoitem");

      const admin = await resetAndSeedDatabase(db, "admin");
      const users = await db.select().from(user);
      const items = await db.select().from(demo_items);

      expect(admin.users.map((seedUser) => seedUser.email)).toEqual([
        "avery.member@church-task.test",
        "ada.admin@church-task.test",
      ]);
      expect(admin.demo_items.map((item) => item.slug)).toEqual([
        "app-profile-demo-item",
        "admin-profile-demo-item",
      ]);
      expect(users).toHaveLength(2);
      expect(items).toHaveLength(2);
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);

  test("resets and reseeds without replacing the database connection Zero will use", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const { db, pool } = createDb(container.getConnectionUri());

    try {
      await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });

      const first = await seedDatabase(db, "app");
      await resetSeededData(db);
      const second = await seedDatabase(db, "app");
      const firstItem = first.demo_items[0];
      const secondItem = second.demo_items[0];
      const secondUser = second.users[0];

      if (!firstItem || !secondItem || !secondUser) {
        throw new Error("Expected app seed profile to create a user and demo item");
      }

      const [oldItem] = await db.select().from(demo_items).where(eq(demo_items.id, firstItem.id));
      const [newItem] = await db.select().from(demo_items).where(eq(demo_items.id, secondItem.id));

      expect(firstItem.id).not.toBe(secondItem.id);
      expect(oldItem).toBeUndefined();
      expect(newItem).toMatchObject({
        name: "App profile demo item",
        owner_user_id: secondUser.id,
      });
    } finally {
      await pool.end();
      await container.stop();
    }
  }, 60_000);
});
