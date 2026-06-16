import { getDemoItemId, getUserId } from "@church-task/shared/get-ids";
import { sql } from "drizzle-orm";

import type { ChurchTaskDb } from "./client";
import { demo_items, user } from "./schema";

export type SeedProfile = "empty" | "app" | "admin";

export type SeededUserReference = {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type SeededDemoItemReference = {
  readonly id: string;
  readonly name: string;
  readonly owner_user_id: string | null;
  readonly slug: string;
};

export type SeedResult = {
  readonly demo_items: readonly SeededDemoItemReference[];
  readonly profile: SeedProfile;
  readonly users: readonly SeededUserReference[];
};

const tableNames = [
  "tasks",
  "workflow_statuses",
  "workflows",
  "team_memberships",
  "labels",
  "teams",
  "invitation",
  "member",
  "organization",
  "verification",
  "account",
  "session",
  "demo_items",
  "user",
] as const;

export const resetSeededData = async (db: ChurchTaskDb) => {
  await db.execute(sql.raw(`truncate table ${tableNames.map((table) => `"${table}"`).join(", ")}`));
};

const appUserFixture = {
  email: "avery.member@church-task.test",
  name: "Avery Member",
  slug: "avery-member",
} as const;

const adminUserFixture = {
  email: "ada.admin@church-task.test",
  name: "Ada App Administrator",
  slug: "ada-app-administrator",
} as const;

const insertSeedUser = async (
  db: ChurchTaskDb,
  fixture: typeof appUserFixture | typeof adminUserFixture,
) => {
  const id = getUserId();

  await db.insert(user).values({
    email: fixture.email,
    emailVerified: true,
    id,
    name: fixture.name,
  });

  return { ...fixture, id } satisfies SeededUserReference;
};

const insertSeedDemoItem = async (
  db: ChurchTaskDb,
  args: {
    readonly name: string;
    readonly owner_user_id: string | null;
    readonly slug: string;
  },
) => {
  const id = getDemoItemId();

  await db.insert(demo_items).values({
    _tag: "demo_item",
    created_by: args.owner_user_id,
    id,
    name: args.name,
    owner_user_id: args.owner_user_id,
    updated_by: args.owner_user_id,
  });

  return { ...args, id } satisfies SeededDemoItemReference;
};

export const seedDatabase = async (db: ChurchTaskDb, profile: SeedProfile): Promise<SeedResult> => {
  if (profile === "empty") {
    return { demo_items: [], profile, users: [] };
  }

  const appUser = await insertSeedUser(db, appUserFixture);
  const appItem = await insertSeedDemoItem(db, {
    name: "App profile demo item",
    owner_user_id: appUser.id,
    slug: "app-profile-demo-item",
  });

  if (profile === "app") {
    return { demo_items: [appItem], profile, users: [appUser] };
  }

  const adminUser = await insertSeedUser(db, adminUserFixture);
  const adminItem = await insertSeedDemoItem(db, {
    name: "Admin profile demo item",
    owner_user_id: adminUser.id,
    slug: "admin-profile-demo-item",
  });

  return { demo_items: [appItem, adminItem], profile, users: [appUser, adminUser] };
};

export const resetAndSeedDatabase = async (db: ChurchTaskDb, profile: SeedProfile) => {
  await resetSeededData(db);
  return seedDatabase(db, profile);
};
