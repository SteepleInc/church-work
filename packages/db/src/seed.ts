import { getDemoItemId, getUserId } from "@church-work/shared/get-ids";
import { sql } from "drizzle-orm";

import type { ChurchWorkDb } from "./client";
import { demo_items, user } from "./schema";

export type SeedProfile = "empty" | "app" | "admin";

export type SeededUserReference = {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly role: "admin" | null;
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
  "cycle_adjustments",
  "template_tasks",
  "focus_windows",
  "template_teams",
  "templates",
  "key_date_occurrences",
  "key_dates",
  "cycles",
  "workflow_statuses",
  "workflows",
  "team_memberships",
  "labels",
  "teams",
  "invitation",
  "member",
  "subscription",
  "organization",
  "verification",
  "account",
  "session",
  "demo_items",
  "user",
] as const;

export const resetSeededData = async (db: ChurchWorkDb) => {
  await db.execute(sql.raw(`truncate table ${tableNames.map((table) => `"${table}"`).join(", ")}`));
};

const appUserFixture = {
  email: "avery.member@church-work.test",
  name: "Avery Member",
  role: null,
  slug: "avery-member",
} as const;

const adminUserFixture = {
  email: "ada.admin@church-work.test",
  name: "Ada App Administrator",
  role: "admin",
  slug: "ada-app-administrator",
} as const;

const insertSeedUser = async (
  db: ChurchWorkDb,
  fixture: typeof appUserFixture | typeof adminUserFixture,
) => {
  const id = getUserId();

  await db.insert(user).values({
    email: fixture.email,
    emailVerified: true,
    id,
    name: fixture.name,
    role: fixture.role,
  });

  return { ...fixture, id } satisfies SeededUserReference;
};

const insertSeedDemoItem = async (
  db: ChurchWorkDb,
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

export const seedDatabase = async (db: ChurchWorkDb, profile: SeedProfile): Promise<SeedResult> => {
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

export const resetAndSeedDatabase = async (db: ChurchWorkDb, profile: SeedProfile) => {
  await resetSeededData(db);
  return seedDatabase(db, profile);
};
