import { defineQueries, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { toZeroSchema } from "./effect-schema";
import { parseTaskIdentifier } from "@church-work/domain";

import {
  hasActiveChurchAccess,
  isAppAdminSession,
  isServerContext,
  requireActiveChurchAccess,
  requireAppAdminSession,
  requireSignedInSession,
} from "./session-context";
import { applyZeroListQuery, ListArgsEffectSchema } from "./list-query";
import { zql } from "./zero-schema.gen";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const DemoItemByIdArgs = toZeroSchema(Schema.Struct({ id: Schema.String }));
const ChurchScopedArgs = toZeroSchema(Schema.Struct({ church_id: Schema.String }));
const ChurchWorkAssigneeArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, assigned_user_id: Schema.String }),
);
const ChurchWorkTeamArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String }),
);
const ChurchWorkCycleArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, cycle_id: Schema.String }),
);
const AdminListArgs = toZeroSchema(Schema.Struct({ list_args: ListArgsEffectSchema }));
const ChurchWorkListArgs = toZeroSchema(
  Schema.Struct({
    assigned_user_id: Schema.optional(Schema.String),
    church_id: Schema.String,
    list_args: ListArgsEffectSchema,
    team_id: Schema.optional(Schema.String),
  }),
);
const ActivityForEntityArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, entity_id: Schema.String, entity_type: Schema.String }),
);
const TaskCommentsArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, task_id: Schema.String }),
);
const TaskCommentSubscriptionsArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, task_id: Schema.String, user_id: Schema.String }),
);
const TaskByIdentifierArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, identifier: Schema.String }),
);
const TaskMentionsByTaskArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, task_id: Schema.String }),
);
const ChurchScopedByIdArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, id: Schema.String }),
);
const DraftByIdArgs = toZeroSchema(Schema.Struct({ id: Schema.String }));
const TaskDraftByDraftIdArgs = toZeroSchema(Schema.Struct({ draft_id: Schema.String }));

const defineChurchWorkQuery = defineQueryWithType<ZeroSchema, OptionalZeroSessionContext>();

export const queries = defineQueries({
  demo_items: {
    admin_all: defineChurchWorkQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.demo_items.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    all: defineChurchWorkQuery(({ ctx }) => {
      const scoped = isAppAdminSession(ctx)
        ? zql.demo_items
        : ctx?.authenticated === true
          ? zql.demo_items.where("owner_user_id", ctx.user_id)
          : zql.demo_items.where("owner_user_id", "IS", null);

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    by_id: defineChurchWorkQuery(DemoItemByIdArgs, ({ args, ctx }) =>
      (isAppAdminSession(ctx)
        ? zql.demo_items
        : ctx?.authenticated === true
          ? zql.demo_items.where("owner_user_id", ctx.user_id)
          : zql.demo_items.where("owner_user_id", "IS", null)
      )
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one(),
    ),
  },
  drafts: {
    my_active: defineChurchWorkQuery(({ ctx }) => {
      const session = requireSignedInSession(ctx);
      const activeChurchId = session.active_church_id;

      if (activeChurchId === null) {
        return zql.drafts.where("id", "__missing_active_church__").where("deleted_at", "IS", null);
      }

      return zql.drafts
        .where("church_id", activeChurchId)
        .where("owner_user_id", session.user_id)
        .where("deleted_at", "IS", null)
        .orderBy("updated_at", "desc");
    }),
    by_id: defineChurchWorkQuery(DraftByIdArgs, ({ args, ctx }) => {
      const session = requireSignedInSession(ctx);
      const activeChurchId = session.active_church_id;

      if (activeChurchId === null) {
        return zql.drafts
          .where("id", "__missing_active_church__")
          .where("deleted_at", "IS", null)
          .one();
      }

      return zql.drafts
        .where("id", args.id)
        .where("church_id", activeChurchId)
        .where("owner_user_id", session.user_id)
        .where("deleted_at", "IS", null)
        .one();
    }),
  },
  task_drafts: {
    my_active: defineChurchWorkQuery(({ ctx }) => {
      const session = requireSignedInSession(ctx);
      const activeChurchId = session.active_church_id;

      if (activeChurchId === null) {
        return zql.task_drafts
          .where("id", "__missing_active_church__")
          .where("deleted_at", "IS", null);
      }

      return zql.task_drafts
        .where("church_id", activeChurchId)
        .where("owner_user_id", session.user_id)
        .where("deleted_at", "IS", null)
        .orderBy("updated_at", "desc");
    }),
    by_draft_id: defineChurchWorkQuery(TaskDraftByDraftIdArgs, ({ args, ctx }) => {
      const session = requireSignedInSession(ctx);
      const activeChurchId = session.active_church_id;

      if (activeChurchId === null) {
        return zql.task_drafts
          .where("id", "__missing_active_church__")
          .where("deleted_at", "IS", null)
          .one();
      }

      return zql.task_drafts
        .where("draft_id", args.draft_id)
        .where("church_id", activeChurchId)
        .where("owner_user_id", session.user_id)
        .where("deleted_at", "IS", null)
        .one();
    }),
  },
  organization: {
    admin_list: defineChurchWorkQuery(AdminListArgs, ({ args, ctx }) => {
      requireAppAdminSession(ctx);

      return applyZeroListQuery(zql.organization, args.list_args, {
        allowed_columns: [
          "id",
          "name",
          "slug",
          "church_time_zone",
          "completed_onboarding",
          "state",
          "size",
          "created_at",
        ],
        column_map: {
          church_time_zone: "churchTimeZone",
          completed_onboarding: "completedOnboarding",
          created_at: "createdAt",
        },
        default_order_by: "created_at",
        default_order_direction: "desc",
      });
    }),
  },
  user: {
    admin_list: defineChurchWorkQuery(AdminListArgs, ({ args, ctx }) => {
      requireAppAdminSession(ctx);

      return applyZeroListQuery(zql.user, args.list_args, {
        allowed_columns: ["id", "name", "email", "role", "created_at"],
        column_map: { created_at: "createdAt" },
        default_order_by: "created_at",
        default_order_direction: "desc",
      });
    }),
  },
  member: {
    admin_all: defineChurchWorkQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.member.orderBy("createdAt", "desc");
    }),
  },
  invitations: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.invitation.where("id", "__unauthorized__");
      }

      return zql.invitation.where("organizationId", args.church_id).orderBy("createdAt", "desc");
    }),
  },
  activities: {
    by_entity: defineChurchWorkQuery(ActivityForEntityArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.activities.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.activities
        .where("church_id", args.church_id)
        .where("entity_type", args.entity_type)
        .where("entity_id", args.entity_id)
        .where("deleted_at", "IS", null)
        .orderBy("occurred_at", "desc");
    }),
  },
  task_comments: {
    by_task: defineChurchWorkQuery(TaskCommentsArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.task_comments.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.task_comments
        .where("church_id", args.church_id)
        .where("task_id", args.task_id)
        .orderBy("created_at", "asc");
    }),
  },
  notifications: {
    by_recipient: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id) || ctx?.authenticated !== true) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.notifications.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.notifications
        .where("church_id", args.church_id)
        .where("recipient_user_id", ctx.user_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "desc");
    }),
  },
  task_comment_subscriptions: {
    by_task_for_user: defineChurchWorkQuery(TaskCommentSubscriptionsArgs, ({ args, ctx }) => {
      if (
        !hasActiveChurchAccess(ctx, args.church_id) ||
        ctx?.authenticated !== true ||
        ctx.user_id !== args.user_id
      ) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.task_comment_subscriptions
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return zql.task_comment_subscriptions
        .where("church_id", args.church_id)
        .where("task_id", args.task_id)
        .where("user_id", args.user_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
  },
  task_mentions: {
    // Outgoing edges: who/what this Task mentions in its description.
    by_source_task: defineChurchWorkQuery(TaskMentionsByTaskArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.task_mentions.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.task_mentions
        .where("church_id", args.church_id)
        .where("source_task_id", args.task_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
    // Incoming edges: other Tasks that mention this Task ("mentioned in").
    by_target_task: defineChurchWorkQuery(TaskMentionsByTaskArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.task_mentions.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.task_mentions
        .where("church_id", args.church_id)
        .where("target_task_id", args.task_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
  },
  teams_admin: {
    admin_all: defineChurchWorkQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.teams.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
  },
  teams: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.teams.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.teams.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("sort_order", "asc");
    }),
    // Resolves a single Team by id, for per-row lookups (e.g. resolving the
    // owning Team of a Task to format its "TEAM-123" identifier).
    by_id: defineChurchWorkQuery(ChurchScopedByIdArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.teams.where("id", "__unauthorized__").where("deleted_at", "IS", null).one();
      }

      return zql.teams
        .where("church_id", args.church_id)
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one();
    }),
  },
  team_memberships: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.team_memberships.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.team_memberships.where("id", "__unauthorized__");
      }

      return scoped.orderBy("created_at", "asc");
    }),
  },
  labels: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.labels.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.labels.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("name", "asc");
    }),
    // Resolves a single Label by id, for per-row lookups (e.g. naming a Label
    // referenced in an Activity Feed line).
    by_id: defineChurchWorkQuery(ChurchScopedByIdArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.labels.where("id", "__unauthorized__").where("deleted_at", "IS", null).one();
      }

      return zql.labels
        .where("church_id", args.church_id)
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one();
    }),
  },
  cycles: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.cycles.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.cycles.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("start_date", "desc");
    }),
  },
  key_dates: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.key_dates.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.key_dates
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("name", "asc");
    }),
  },
  key_date_occurrences: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.key_date_occurrences
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return zql.key_date_occurrences
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("local_date", "asc");
    }),
  },
  templates: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.templates.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.templates
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("name", "asc");
    }),
  },
  template_schedules: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.template_schedules
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return zql.template_schedules
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("name", "asc");
    }),
  },
  template_teams: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.template_teams.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.template_teams
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
  },
  focus_windows: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.focus_windows.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.focus_windows
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("start_date", "asc");
    }),
  },
  template_tasks: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.template_tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.template_tasks
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
  },
  cycle_adjustments: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.cycle_adjustments
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return zql.cycle_adjustments
        .where("church_id", args.church_id)
        .where("deleted_at", "IS", null)
        .orderBy("updated_at", "desc");
    }),
  },
  workflows: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.workflows.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.workflows.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "asc");
    }),
  },
  workflow_statuses: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.workflow_statuses.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.workflow_statuses
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("sort_order", "asc");
    }),
    // Resolves a single Workflow Status by id, for per-row lookups (e.g. naming
    // the from/to status of an Activity Feed status-change line).
    by_id: defineChurchWorkQuery(ChurchScopedByIdArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.workflow_statuses
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null)
          .one();
      }

      return zql.workflow_statuses
        .where("church_id", args.church_id)
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one();
    }),
  },
  tasks: {
    by_church: defineChurchWorkQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.tasks.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    by_assignee: defineChurchWorkQuery(ChurchWorkAssigneeArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.tasks
        .where("church_id", args.church_id)
        .where("assigned_user_id", args.assigned_user_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "desc");
    }),
    by_team: defineChurchWorkQuery(ChurchWorkTeamArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.tasks
        .where("church_id", args.church_id)
        .where("team_id", args.team_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "desc");
    }),
    by_cycle: defineChurchWorkQuery(ChurchWorkCycleArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.tasks
        .where("church_id", args.church_id)
        .where("cycle_id", args.cycle_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "desc");
    }),
    filtered: defineChurchWorkQuery(ChurchWorkListArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      let query = zql.tasks.where("church_id", args.church_id).where("deleted_at", "IS", null);

      if (args.team_id) query = query.where("team_id", args.team_id);
      if (args.assigned_user_id) query = query.where("assigned_user_id", args.assigned_user_id);

      return applyZeroListQuery(query, args.list_args, {
        allowed_columns: [
          "assigned_user_id",
          "created_at",
          "created_by_user_id",
          "cycle_id",
          "due_date",
          "id",
          "parent_task_id",
          "priority",
          "source_template_id",
          "task_state",
          "team_id",
          "workflow_status_id",
        ],
        default_order_by: "created_at",
        default_order_direction: "desc",
      });
    }),
    // Resolves a single Task by id, for per-row lookups (e.g. a "mentioned in"
    // backlink row fetching its own source Task). Zero dedupes identical
    // subscriptions client-side, so many rows asking for the same Task share one.
    by_id: defineChurchWorkQuery(ChurchScopedByIdArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null).one();
      }

      return zql.tasks
        .where("church_id", args.church_id)
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one();
    }),
    by_identifier: defineChurchWorkQuery(TaskByIdentifierArgs, ({ args, ctx }) => {
      const parsed = parseTaskIdentifier(args.identifier);
      if (!parsed)
        return zql.tasks.where("id", "__invalid_identifier__").where("deleted_at", "IS", null);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.tasks
        .where("church_id", args.church_id)
        .where("number", parsed.taskNumber)
        .where("deleted_at", "IS", null);
    }),
  },
});
