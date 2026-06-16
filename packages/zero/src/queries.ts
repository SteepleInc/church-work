import { defineQueries, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { isAppAdminSession, requireAppAdminSession } from "./session-context";
import { zql } from "./zero-schema.gen";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const DemoItemByIdArgs = Schema.standardSchemaV1(Schema.Struct({ id: Schema.String }));

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
        : ctx
          ? zql.demo_items.where("owner_user_id", ctx.user_id)
          : zql.demo_items.where("owner_user_id", "IS", null);

      return scoped.where("deleted_at", "IS", null).orderBy("created_at", "desc");
    }),
    by_id: defineChurchTaskQuery(DemoItemByIdArgs, ({ args, ctx }) =>
      (isAppAdminSession(ctx)
        ? zql.demo_items
        : ctx
          ? zql.demo_items.where("owner_user_id", ctx.user_id)
          : zql.demo_items.where("owner_user_id", "IS", null)
      )
        .where("id", args.id)
        .where("deleted_at", "IS", null)
        .one(),
    ),
  },
});
