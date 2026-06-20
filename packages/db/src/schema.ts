import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
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

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    referenceId: text("reference_id").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: utcTimestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86_400_000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: utcTimestamp("last_request"),
    expiresAt: utcTimestamp("expires_at"),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
    updatedAt: utcTimestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_config_id_idx").on(table.configId),
    index("apikey_reference_id_idx").on(table.referenceId),
  ],
);

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
    rollingMaterializationWindowCycles: integer("rolling_materialization_window_cycles")
      .notNull()
      .default(3),
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
    next_task_number: integer("next_task_number").notNull().default(1),
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

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    team_id: text("team_id").notNull(),
    number: integer("number").notNull(),
    previous_identifiers: text("previous_identifiers").notNull().default("[]"),
    assigned_user_id: text("assigned_user_id"),
    created_by_user_id: text("created_by_user_id"),
    cycle_id: text("cycle_id"),
    due_date: text("due_date"),
    parent_task_id: text("parent_task_id"),
    label_ids: text("label_ids").notNull().default("[]"),
    workflow_id: text("workflow_id").notNull(),
    workflow_status_id: text("workflow_status_id").notNull(),
    task_state: text("task_state").notNull(),
    estimate: text("estimate"),
    priority: text("priority"),
    board_order: text("board_order").notNull(),
    finished_at: utcTimestamp("finished_at"),
    source_template_id: text("source_template_id"),
    source_template_task_id: text("source_template_task_id"),
    source_template_cycle_id: text("source_template_cycle_id"),
    source_template_schedule_id: text("source_template_schedule_id"),
    source_template_occurrence_key: text("source_template_occurrence_key"),
    source_template_sync_enabled: boolean("source_template_sync_enabled").notNull().default(false),
  },
  (table) => [
    index("tasks_church_id_idx").on(table.church_id),
    index("tasks_team_id_idx").on(table.team_id),
    index("tasks_workflow_status_id_idx").on(table.workflow_status_id),
    uniqueIndex("tasks_team_number_live_idx")
      .on(table.team_id, table.number)
      .where(sql`${table.deleted_at} IS NULL`),
    uniqueIndex("tasks_template_schedule_occurrence_task_live_idx")
      .on(
        table.source_template_schedule_id,
        table.source_template_task_id,
        table.source_template_occurrence_key,
      )
      .where(
        sql`${table.deleted_at} IS NULL AND ${table.source_template_schedule_id} IS NOT NULL AND ${table.source_template_task_id} IS NOT NULL AND ${table.source_template_occurrence_key} IS NOT NULL`,
      ),
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

export const cycles = pgTable(
  "cycles",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date").notNull(),
    name: text("name"),
    description: text("description"),
    starts_at: utcTimestamp("starts_at").notNull(),
    ends_at: utcTimestamp("ends_at").notNull(),
    church_time_zone: text("church_time_zone").notNull(),
  },
  (table) => [
    index("cycles_church_id_idx").on(table.church_id),
    uniqueIndex("cycles_church_start_date_live_idx")
      .on(table.church_id, table.start_date)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const key_dates = pgTable(
  "key_dates",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    schedule: text("schedule").notNull(),
  },
  (table) => [
    index("key_dates_church_id_idx").on(table.church_id),
    uniqueIndex("key_dates_church_key_live_idx")
      .on(table.church_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const key_date_occurrences = pgTable(
  "key_date_occurrences",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    key_date_id: text("key_date_id").notNull(),
    local_date: text("local_date").notNull(),
    label: text("label"),
  },
  (table) => [
    index("key_date_occurrences_church_id_idx").on(table.church_id),
    index("key_date_occurrences_key_date_id_idx").on(table.key_date_id),
    uniqueIndex("key_date_occurrences_key_date_local_date_live_idx")
      .on(table.key_date_id, table.local_date)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    recurrence: text("recurrence").notNull(),
    placement_shape: text("placement_shape"),
  },
  (table) => [
    index("templates_church_id_idx").on(table.church_id),
    uniqueIndex("templates_church_key_live_idx")
      .on(table.church_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const template_schedules = pgTable(
  "template_schedules",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    template_id: text("template_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    recurrence: text("recurrence").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date"),
    rule: text("rule").notNull().default("{}"),
  },
  (table) => [
    index("template_schedules_church_id_idx").on(table.church_id),
    index("template_schedules_template_id_idx").on(table.template_id),
    uniqueIndex("template_schedules_template_key_live_idx")
      .on(table.template_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const template_teams = pgTable(
  "template_teams",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    template_id: text("template_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    mapped_team_id: text("mapped_team_id").notNull(),
  },
  (table) => [
    index("template_teams_church_id_idx").on(table.church_id),
    index("template_teams_template_id_idx").on(table.template_id),
    index("template_teams_mapped_team_id_idx").on(table.mapped_team_id),
    uniqueIndex("template_teams_template_key_live_idx")
      .on(table.template_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const focus_windows = pgTable(
  "focus_windows",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    template_id: text("template_id").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    start_date: text("start_date").notNull(),
    end_date: text("end_date"),
    anchor_date: text("anchor_date"),
    key_date_id: text("key_date_id"),
  },
  (table) => [
    index("focus_windows_church_id_idx").on(table.church_id),
    index("focus_windows_template_id_idx").on(table.template_id),
    uniqueIndex("focus_windows_template_key_live_idx")
      .on(table.template_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const template_tasks = pgTable(
  "template_tasks",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    template_id: text("template_id").notNull(),
    template_team_id: text("template_team_id").notNull(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    assigned_user_id: text("assigned_user_id"),
    label_ids: text("label_ids").notNull().default("[]"),
    estimate: text("estimate"),
    priority: text("priority"),
    parent_template_task_id: text("parent_template_task_id"),
    scheduling_rule: text("scheduling_rule").notNull(),
    placement_cycle_offset: integer("placement_cycle_offset"),
    placement_weekday: integer("placement_weekday"),
  },
  (table) => [
    index("template_tasks_church_id_idx").on(table.church_id),
    index("template_tasks_template_id_idx").on(table.template_id),
    index("template_tasks_template_team_id_idx").on(table.template_team_id),
    uniqueIndex("template_tasks_template_key_live_idx")
      .on(table.template_id, table.key)
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const cycle_adjustments = pgTable(
  "cycle_adjustments",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    cycle_id: text("cycle_id").notNull(),
    source_template_schedule_id: text("source_template_schedule_id"),
    source_template_occurrence_key: text("source_template_occurrence_key"),
    template_task_id: text("template_task_id").notNull(),
    lifecycle: text("lifecycle").notNull(),
    overrides: text("overrides").notNull().default("[]"),
  },
  (table) => [
    index("cycle_adjustments_church_id_idx").on(table.church_id),
    index("cycle_adjustments_church_cycle_id_idx").on(table.church_id, table.cycle_id),
    uniqueIndex("cycle_adjustments_source_live_idx")
      .on(
        table.cycle_id,
        table.source_template_schedule_id,
        table.template_task_id,
        table.source_template_occurrence_key,
      )
      .where(sql`${table.deleted_at} IS NULL`),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    ...baseEntityFields,
    church_id: text("church_id").notNull(),
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").notNull(),
    event_type: text("event_type").notNull(),
    actor_type: text("actor_type").notNull(),
    actor_id: text("actor_id"),
    occurred_at: utcTimestamp("occurred_at").notNull(),
    cycle_id: text("cycle_id"),
    metadata: text("metadata").notNull().default("{}"),
  },
  (table) => [
    index("activities_church_id_idx").on(table.church_id),
    index("activities_entity_idx").on(table.church_id, table.entity_type, table.entity_id),
    index("activities_occurred_at_idx").on(table.occurred_at),
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
  activities,
  apikey,
  cycle_adjustments,
  cycles,
  demo_items,
  focus_windows,
  invitation,
  key_date_occurrences,
  key_dates,
  labels,
  member,
  organization,
  session,
  team_memberships,
  teams,
  template_tasks,
  template_schedules,
  template_teams,
  templates,
  tasks,
  user,
  verification,
  workflow_statuses,
  workflows,
};

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type DemoItem = typeof demo_items.$inferSelect;
export type NewDemoItem = typeof demo_items.$inferInsert;
