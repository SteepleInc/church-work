import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const utcTimestamp = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

export const baseEntityFields = {
  _tag: text("_tag").notNull(),
  created_at: utcTimestamp("created_at").notNull().defaultNow(),
  created_by: text("created_by"),
  updated_at: utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updated_by: text("updated_by"),
  deleted_at: utcTimestamp("deleted_at"),
  deleted_by: text("deleted_by"),
};

export type BaseEntityFields = typeof baseEntityFields;

export const demo_items = pgTable(
  "demo_items",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    name: text("name").notNull(),
    owner_user_id: text("owner_user_id"),
  },
  (table) => [
    uniqueIndex("demo_items_name_live_idx")
      .on(table.name)
      .where(sql`${table.deleted_at} IS NULL`),
    index("demo_items_owner_user_id_idx").on(table.owner_user_id),
  ],
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: utcTimestamp("ban_expires"),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  updatedAt: utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: utcTimestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  updatedAt: utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull(),
  activeOrganizationId: text("active_organization_id"),
  orgCompletedOnboarding: boolean("org_completed_onboarding"),
  orgRole: text("org_role"),
  orgType: text("org_type"),
  skipOrgFallback: boolean("skip_org_fallback").notNull().default(false),
  userRole: text("user_role"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: utcTimestamp("access_token_expires_at"),
  refreshTokenExpiresAt: utcTimestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  updatedAt: utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: utcTimestamp("expires_at").notNull(),
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  updatedAt: utcTimestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    _tag: text("_tag").notNull().default("org"),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    logo: text("logo"),
    metadata: text("metadata"),
    churchTimeZone: text("church_time_zone").notNull().default("America/New_York"),
    completedOnboarding: boolean("completed_onboarding").notNull().default(false),
    url: text("url"),
    street: text("street"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    countryCode: text("country_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    size: text("size"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("organization_slug_idx").on(table.slug)],
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    name: text("name").notNull(),
    identifier: text("identifier").notNull(),
    previous_identifiers: text("previous_identifiers").notNull().default("[]"),
    color: text("color").notNull(),
    sort_order: doublePrecision("sort_order").notNull(),
  },
  (table) => [
    index("teams_church_id_idx").on(table.church_id),
    uniqueIndex("teams_church_identifier_live_idx")
      .on(table.church_id, table.identifier)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const team_memberships = pgTable(
  "team_memberships",
  {
    id: text("id").primaryKey(),
    _tag: text("_tag").notNull().default("teammembership"),
    church_id: text("church_id").notNull(),
    team_id: text("team_id").notNull(),
    user_id: text("user_id").notNull(),
    created_at: utcTimestamp("created_at").notNull().defaultNow(),
    created_by: text("created_by"),
    updated_at: utcTimestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updated_by: text("updated_by"),
  },
  (table) => [
    index("team_memberships_church_id_idx").on(table.church_id),
    index("team_memberships_team_id_idx").on(table.team_id),
    index("team_memberships_user_id_idx").on(table.user_id),
    uniqueIndex("team_memberships_team_user_idx").on(table.team_id, table.user_id),
  ],
);

export const workflows = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    team_id: text("team_id").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    index("workflows_church_id_idx").on(table.church_id),
    index("workflows_team_id_idx").on(table.team_id),
    uniqueIndex("workflows_team_live_idx")
      .on(table.team_id)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const workflow_statuses = pgTable(
  "workflow_statuses",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    workflow_id: text("workflow_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    task_state: text("task_state").notNull(),
    sort_order: doublePrecision("sort_order").notNull(),
  },
  (table) => [
    index("workflow_statuses_church_id_idx").on(table.church_id),
    index("workflow_statuses_workflow_id_idx").on(table.workflow_id),
    uniqueIndex("workflow_statuses_workflow_key_live_idx")
      .on(table.workflow_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const labels = pgTable(
  "labels",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    team_id: text("team_id"),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (table) => [
    index("labels_church_id_idx").on(table.church_id),
    index("labels_team_id_idx").on(table.team_id),
    uniqueIndex("labels_church_scope_name_live_idx")
      .on(table.church_id, sql`lower(${table.name})`)
      .where(sql`${table.team_id} IS NULL AND ${table.deleted_at} IS NULL`),
    uniqueIndex("labels_team_scope_name_live_idx")
      .on(table.team_id, sql`lower(${table.name})`)
      .where(sql`${table.team_id} IS NOT NULL AND ${table.deleted_at} IS NULL`),
  ],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    _tag: text("_tag").notNull().default("orguser"),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("member_organization_id_idx").on(table.organizationId),
    index("member_user_id_idx").on(table.userId),
    uniqueIndex("member_user_organization_idx").on(table.userId, table.organizationId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    _tag: text("_tag").notNull().default("churchinvitation"),
    organizationId: text("organization_id").notNull(),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    inviterId: text("inviter_id").notNull(),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invitation_organization_id_idx").on(table.organizationId),
    index("invitation_inviter_id_idx").on(table.inviterId),
  ],
);

export const schema = {
  account,
  demo_items,
  invitation,
  labels,
  member,
  organization,
  session,
  team_memberships,
  teams,
  user,
  verification,
  workflow_statuses,
  workflows,
};

export type DemoItem = typeof demo_items.$inferSelect;
export type NewDemoItem = typeof demo_items.$inferInsert;
