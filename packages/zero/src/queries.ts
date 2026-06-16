import { defineQueries, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import {
  hasActiveChurchAccess,
  isAppAdminSession,
  isServerContext,
  requireActiveChurchAccess,
  requireAppAdminSession,
} from "./session-context";
import { zql } from "./zero-schema.gen";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const DemoItemByIdArgs = Schema.standardSchemaV1(Schema.Struct({ id: Schema.String }));
const ChurchScopedArgs = Schema.standardSchemaV1(Schema.Struct({ church_id: Schema.String }));

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
});
