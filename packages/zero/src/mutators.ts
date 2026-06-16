import { generateTeamIdentifier, getTeamColorForName } from "@church-task/domain";
import { getDemoItemId, getTeamId } from "@church-task/shared/get-ids";
import { defineMutatorWithType, defineMutators } from "@rocicorp/zero";
import { and, eq, isNull } from "drizzle-orm";
import { Schema } from "effect";

import { demo_items, teams } from "@church-task/db/schema";

import { requireActiveChurchAccess, requireSignedInSession } from "./session-context";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const CreateDemoItemArgs = Schema.standardSchemaV1(Schema.Struct({ name: Schema.String }));
const CreateTeamArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, name: Schema.String }),
);
const DeleteTeamArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String }),
);

const defineChurchTaskMutator = defineMutatorWithType<
  ZeroSchema,
  OptionalZeroSessionContext,
  unknown
>();

export const mutators = defineMutators({
  demo_items: {
    create: defineChurchTaskMutator(CreateDemoItemArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("demo_items.create must run on the server");
      }

      const session = requireSignedInSession(ctx);
      const now = new Date();

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { insert: (table: typeof demo_items) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction.insert(demo_items).values({
        _tag: "demo_item",
        created_at: now,
        created_by: session.user_id,
        id: getDemoItemId(),
        name: args.name,
        owner_user_id: session.user_id,
        updated_at: now,
        updated_by: session.user_id,
      });
    }),
  },
  teams: {
    create: defineChurchTaskMutator(CreateTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.create must run on the server");
      }

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const now = new Date();
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly insert: (table: typeof teams) => any;
            readonly select: (fields: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingTeams = await db
        .select({ identifier: teams.identifier, sort_order: teams.sort_order })
        .from(teams)
        .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)));
      const identifier = generateTeamIdentifier(
        args.name,
        existingTeams.map((team: { readonly identifier: string }) => team.identifier),
      );

      await db.insert(teams).values({
        _tag: "team",
        church_id: args.church_id,
        color: getTeamColorForName(args.name),
        created_at: now,
        created_by: session.user_id,
        id: getTeamId(),
        identifier,
        name: args.name,
        previous_identifiers: "[]",
        sort_order:
          existingTeams.reduce(
            (max: number, team: { readonly sort_order: number }) => Math.max(max, team.sort_order),
            -1,
          ) + 1,
        updated_at: now,
        updated_by: session.user_id,
      });
    }),
    delete: defineChurchTaskMutator(DeleteTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.delete must run on the server");
      }

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const now = new Date();
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly update: (table: typeof teams) => any;
          };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(teams)
        .set({
          deleted_at: now,
          deleted_by: session.user_id,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(and(eq(teams.id, args.team_id), eq(teams.church_id, args.church_id)));
    }),
  },
});
