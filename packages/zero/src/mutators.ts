import {
  DEFAULT_WORKFLOW_STATUSES,
  generateTeamIdentifier,
  getTeamColorForName,
} from "@church-task/domain";
import {
  getDemoItemId,
  getTeamId,
  getTeamMembershipId,
  getWorkflowId,
  getWorkflowStatusId,
} from "@church-task/shared/get-ids";
import { defineMutatorWithType, defineMutators } from "@rocicorp/zero";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Schema } from "effect";

import {
  demo_items,
  team_memberships,
  teams,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";

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
            readonly insert: (table: unknown) => any;
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
      const teamId = getTeamId();
      const workflowId = getWorkflowId();

      await db.insert(teams).values({
        _tag: "team",
        church_id: args.church_id,
        color: getTeamColorForName(args.name),
        created_at: now,
        created_by: session.user_id,
        id: teamId,
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

      await db.insert(team_memberships).values({
        _tag: "teammembership",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: getTeamMembershipId(),
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
        user_id: session.user_id,
      });

      await db.insert(workflows).values({
        _tag: "workflow",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: workflowId,
        name: `${args.name} Workflow`,
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
      });

      await db.insert(workflow_statuses).values(
        DEFAULT_WORKFLOW_STATUSES.map((status) => ({
          _tag: "workflowstatus",
          church_id: args.church_id,
          created_at: now,
          created_by: session.user_id,
          id: getWorkflowStatusId(),
          key: status.key,
          name: status.name,
          sort_order: status.sort_order,
          task_state: status.task_state,
          updated_at: now,
          updated_by: session.user_id,
          workflow_id: workflowId,
        })),
      );
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
            readonly delete: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingWorkflows = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.church_id, args.church_id),
            eq(workflows.team_id, args.team_id),
            isNull(workflows.deleted_at),
          ),
        );
      const workflowIds = existingWorkflows.map((workflow: { readonly id: string }) => workflow.id);

      await db
        .update(teams)
        .set({
          deleted_at: now,
          deleted_by: session.user_id,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(and(eq(teams.id, args.team_id), eq(teams.church_id, args.church_id)));

      await db
        .update(workflows)
        .set({
          deleted_at: now,
          deleted_by: session.user_id,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(and(eq(workflows.team_id, args.team_id), eq(workflows.church_id, args.church_id)));

      if (workflowIds.length > 0) {
        await db
          .update(workflow_statuses)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(workflow_statuses.church_id, args.church_id),
              inArray(workflow_statuses.workflow_id, workflowIds),
            ),
          );
      }

      await db
        .delete(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
          ),
        );
    }),
  },
});
