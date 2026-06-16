import { getDemoItemId } from "@church-task/shared/get-ids";
import { defineMutatorWithType, defineMutators } from "@rocicorp/zero";
import { Schema } from "effect";

import { demo_items } from "@church-task/db/schema";

import { requireSignedInSession } from "./session-context";

import type { OptionalZeroSessionContext } from "./session-context";
import type { Schema as ZeroSchema } from "./zero-schema.gen";

const CreateDemoItemArgs = Schema.standardSchemaV1(Schema.Struct({ name: Schema.String }));

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
});
