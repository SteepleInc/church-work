import { defineQueries, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { toZeroSchema } from "./effect-schema";
import { parseTaskIdentifier } from "@church-task/domain";

import {
  hasActiveChurchAccess,
  isAppAdminSession,
  isServerContext,
  requireActiveChurchAccess,
  requireAppAdminSession,
} from "./session-context";
import { applyZeroListQuery, ListArgsEffectSchema } from "./list-query";
import { zql } from "./zero-schema.gen";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const DemoItemByIdArgs = toZeroSchema(Schema.Struct({ id: Schema.String }));
const ChurchScopedArgs = toZeroSchema(Schema.Struct({ church_id: Schema.String }));
const ChurchTaskAssigneeArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, assigned_user_id: Schema.String }),
);
const ChurchTaskTeamArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String }),
);
const AdminListArgs = toZeroSchema(Schema.Struct({ list_args: ListArgsEffectSchema }));
const ChurchTaskListArgs = toZeroSchema(
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
const TaskByIdentifierArgs = toZeroSchema(
  Schema.Struct({ church_id: Schema.String, identifier: Schema.String }),
);

const defineChurchTaskQuery = defineQueryWithType<ZeroSchema, OptionalZeroSessionContext>();

export const queries = defineQueries({
  demo_items: {
    admin_all: defineChurchTaskQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.demo_items.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    all: defineChurchTaskQuery(({ ctx }) => {
      const scoped = isAppAdminSession(ctx)
        ? zql.demo_items
        : ctx?.authenticated === true
          ? zql.demo_items.where("owner_user_id", ctx.user_id)
          : zql.demo_items.where("owner_user_id", "IS", null);

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    by_id: defineChurchTaskQuery(DemoItemByIdArgs, ({ args, ctx }) =>
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
  organization: {
    admin_list: defineChurchTaskQuery(AdminListArgs, ({ args, ctx }) => {
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
    admin_list: defineChurchTaskQuery(AdminListArgs, ({ args, ctx }) => {
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
    admin_all: defineChurchTaskQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.member.orderBy("createdAt", "desc");
    }),
  },
  invitations: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.invitation.where("id", "__unauthorized__");
      }

      return zql.invitation.where("organizationId", args.church_id).orderBy("createdAt", "desc");
    }),
  },
  activities: {
    by_entity: defineChurchTaskQuery(ActivityForEntityArgs, ({ args, ctx }) => {
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
    by_task: defineChurchTaskQuery(TaskCommentsArgs, ({ args, ctx }) => {
      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.task_comments.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return zql.task_comments
        .where("church_id", args.church_id)
        .where("task_id", args.task_id)
        .where("deleted_at", "IS", null)
        .orderBy("created_at", "asc");
    }),
  },
  teams_admin: {
    admin_all: defineChurchTaskQuery(({ ctx }) => {
      requireAppAdminSession(ctx);

      return zql.teams.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
  },
  teams: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.teams.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.teams.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("sort_order", "asc");
    }),
  },
  team_memberships: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.team_memberships.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.team_memberships.where("id", "__unauthorized__");
      }

      return scoped.orderBy("created_at", "asc");
    }),
  },
  labels: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.labels.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.labels.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("name", "asc");
    }),
  },
  cycles: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.cycles.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.cycles.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("start_date", "desc");
    }),
  },
  key_dates: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
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
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.workflows.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.workflows.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "asc");
    }),
  },
  workflow_statuses: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.workflow_statuses.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.workflow_statuses
          .where("id", "__unauthorized__")
          .where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("sort_order", "asc");
    }),
  },
  tasks: {
    by_church: defineChurchTaskQuery(ChurchScopedArgs, ({ args, ctx }) => {
      const scoped = zql.tasks.where("church_id", args.church_id);

      if (!hasActiveChurchAccess(ctx, args.church_id)) {
        if (isServerContext(ctx)) requireActiveChurchAccess(ctx, args.church_id);

        return zql.tasks.where("id", "__unauthorized__").where("deleted_at", "IS", null);
      }

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    by_assignee: defineChurchTaskQuery(ChurchTaskAssigneeArgs, ({ args, ctx }) => {
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
    by_team: defineChurchTaskQuery(ChurchTaskTeamArgs, ({ args, ctx }) => {
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
    filtered: defineChurchTaskQuery(ChurchTaskListArgs, ({ args, ctx }) => {
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
          "task_state",
          "team_id",
          "workflow_status_id",
        ],
        default_order_by: "created_at",
        default_order_direction: "desc",
      });
    }),
    by_identifier: defineChurchTaskQuery(TaskByIdentifierArgs, ({ args, ctx }) => {
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
