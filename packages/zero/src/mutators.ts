import {
  DEFAULT_WORKFLOW_STATUSES,
  generateTeamIdentifier,
  getTeamColorForName,
  normalizeTeamIdentifier,
  TEAM_IDENTIFIER_MAX_LENGTH,
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
const RenameTeamArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, team_id: Schema.String }),
);
const SetTeamIdentifierArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, identifier: Schema.String, team_id: Schema.String }),
);
const DeleteTeamArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String }),
);
const ReorderTeamsArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, team_ids: Schema.Array(Schema.String) }),
);
const TeamMemberArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, team_id: Schema.String, user_id: Schema.String }),
);
const RenameWorkflowArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, workflow_id: Schema.String }),
);
const ReorderWorkflowsArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, workflow_ids: Schema.Array(Schema.String) }),
);
const ArchiveWorkflowArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, workflow_id: Schema.String }),
);
const AddWorkflowStatusArgs = Schema.standardSchemaV1(
  Schema.Struct({
    church_id: Schema.String,
    status: Schema.Struct({
      key: Schema.String,
      name: Schema.String,
      sort_order: Schema.Number,
      task_state: Schema.String,
    }),
    workflow_id: Schema.String,
  }),
);
const RenameWorkflowStatusArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, name: Schema.String, status_id: Schema.String }),
);
const ReorderWorkflowStatusesArgs = Schema.standardSchemaV1(
  Schema.Struct({
    church_id: Schema.String,
    status_ids: Schema.Array(Schema.String),
    workflow_id: Schema.String,
  }),
);
const ArchiveWorkflowStatusArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, status_id: Schema.String }),
);

const defineChurchTaskMutator = defineMutatorWithType<
  ZeroSchema,
  OptionalZeroSessionContext,
  unknown
>();

const requireTeamManager = (ctx: OptionalZeroSessionContext, church_id: string) => {
  const session = requireActiveChurchAccess(ctx, church_id);

  if (!session.is_app_admin && session.church_role !== "owner" && session.church_role !== "admin") {
    throw new Error("Only Church owners and admins can change Teams.");
  }

  return session;
};

const isValidTeamIdentifier = (identifier: string) =>
  identifier.length > 0 &&
  identifier.length <= TEAM_IDENTIFIER_MAX_LENGTH &&
  /^[A-Z0-9]+$/.test(identifier);

const parsePreviousIdentifiers = (value: string): readonly string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

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

      const session = requireTeamManager(ctx, args.church_id);
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
    rename: defineChurchTaskMutator(RenameTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.rename must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Team name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(teams)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        );
    }),
    set_identifier: defineChurchTaskMutator(SetTeamIdentifierArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.set_identifier must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const identifier = normalizeTeamIdentifier(args.identifier);
      if (!isValidTeamIdentifier(identifier)) {
        throw new Error(
          `Team Identifier must be 1-${TEAM_IDENTIFIER_MAX_LENGTH} letters or numbers.`,
        );
      }

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existingTeams = (await db
        .select({
          id: teams.id,
          identifier: teams.identifier,
          previous_identifiers: teams.previous_identifiers,
        })
        .from(teams)
        .where(and(eq(teams.church_id, args.church_id), isNull(teams.deleted_at)))) as Array<{
        readonly id: string;
        readonly identifier: string;
        readonly previous_identifiers: string;
      }>;
      const team = existingTeams.find((candidate) => candidate.id === args.team_id);

      if (!team) throw new Error("Team was not found in the active Church.");
      if (
        existingTeams.some(
          (candidate) =>
            candidate.id !== args.team_id &&
            normalizeTeamIdentifier(candidate.identifier) === identifier,
        )
      ) {
        throw new Error("Another Team in this Church already uses that identifier.");
      }

      const previousIdentifier = normalizeTeamIdentifier(team.identifier);
      if (identifier === previousIdentifier) return;

      const previousIdentifiers = [
        ...parsePreviousIdentifiers(team.previous_identifiers).filter(
          (value) => value !== identifier,
        ),
        previousIdentifier,
      ];

      await db
        .update(teams)
        .set({
          identifier,
          previous_identifiers: JSON.stringify(previousIdentifiers),
          updated_at: new Date(),
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        );
    }),
    delete: defineChurchTaskMutator(DeleteTeamArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.delete must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
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
    reorder: defineChurchTaskMutator(ReorderTeamsArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.reorder must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };
      const now = new Date();

      await Promise.all(
        args.team_ids.map((team_id, sort_order) =>
          serverTx.dbTransaction.wrappedTransaction
            .update(teams)
            .set({ sort_order, updated_at: now, updated_by: session.user_id })
            .where(
              and(
                eq(teams.id, team_id),
                eq(teams.church_id, args.church_id),
                isNull(teams.deleted_at),
              ),
            ),
        ),
      );
    }),
    add_member: defineChurchTaskMutator(TeamMemberArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.add_member must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly insert: (table: unknown) => any;
            readonly select: (fields: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const existing = await db
        .select({ id: team_memberships.id })
        .from(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
            eq(team_memberships.user_id, args.user_id),
          ),
        );

      if (existing.length > 0) return;

      const now = new Date();
      await db.insert(team_memberships).values({
        _tag: "teammembership",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: getTeamMembershipId(),
        team_id: args.team_id,
        updated_at: now,
        updated_by: session.user_id,
        user_id: args.user_id,
      });
    }),
    remove_member: defineChurchTaskMutator(TeamMemberArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("teams.remove_member must run on the server");
      }

      requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly delete: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .delete(team_memberships)
        .where(
          and(
            eq(team_memberships.church_id, args.church_id),
            eq(team_memberships.team_id, args.team_id),
            eq(team_memberships.user_id, args.user_id),
          ),
        );
    }),
  },
  workflows: {
    rename: defineChurchTaskMutator(RenameWorkflowArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("workflows.rename must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Workflow name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(workflows)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );
    }),
    reorder: defineChurchTaskMutator(ReorderWorkflowsArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("workflows.reorder must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: {
            readonly select: (fields: unknown) => any;
            readonly update: (table: unknown) => any;
          };
        };
      };
      const db = serverTx.dbTransaction.wrappedTransaction;
      const rows = (await db
        .select({ id: workflows.id, team_id: workflows.team_id })
        .from(workflows)
        .where(
          and(
            eq(workflows.church_id, args.church_id),
            inArray(workflows.id, args.workflow_ids),
            isNull(workflows.deleted_at),
          ),
        )) as Array<{ readonly id: string; readonly team_id: string }>;
      const teamIdByWorkflowId = new Map(rows.map((workflow) => [workflow.id, workflow.team_id]));
      if (teamIdByWorkflowId.size !== args.workflow_ids.length) {
        throw new Error("All Workflows must belong to the active Church.");
      }

      const now = new Date();
      await Promise.all(
        args.workflow_ids.map((workflow_id, sort_order) => {
          const team_id = teamIdByWorkflowId.get(workflow_id);
          if (!team_id) throw new Error("All Workflows must belong to the active Church.");

          return db
            .update(teams)
            .set({ sort_order, updated_at: now, updated_by: session.user_id })
            .where(
              and(
                eq(teams.id, team_id),
                eq(teams.church_id, args.church_id),
                isNull(teams.deleted_at),
              ),
            );
        }),
      );
    }),
    archive: defineChurchTaskMutator(ArchiveWorkflowArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("workflows.archive must run on the server");
      }

      requireTeamManager(ctx, args.church_id);
      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly select: (fields: unknown) => any };
        };
      };
      const rows = await serverTx.dbTransaction.wrappedTransaction
        .select({ team_id: workflows.team_id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );

      if (rows.length === 0) throw new Error("Workflow was not found in the active Church.");
      throw new Error("A Workflow owned by an active Team cannot be archived.");
    }),
    add_status: defineChurchTaskMutator(AddWorkflowStatusArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("workflows.add_status must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.status.name.trim();
      const key = args.status.key.trim();
      if (!name) throw new Error("Workflow Status name is required.");
      if (!key) throw new Error("Workflow Status key is required.");

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
      const existingWorkflow = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, args.workflow_id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        );

      if (existingWorkflow.length === 0) {
        throw new Error("Workflow was not found in the active Church.");
      }

      await db.insert(workflow_statuses).values({
        _tag: "workflowstatus",
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        id: getWorkflowStatusId(),
        key,
        name,
        sort_order: args.status.sort_order,
        task_state: args.status.task_state,
        updated_at: now,
        updated_by: session.user_id,
        workflow_id: args.workflow_id,
      });
    }),
    rename_status: defineChurchTaskMutator(RenameWorkflowStatusArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        throw new Error("workflows.rename_status must run on the server");
      }

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Workflow Status name is required.");

      const serverTx = tx as typeof tx & {
        readonly dbTransaction: {
          readonly wrappedTransaction: { readonly update: (table: unknown) => any };
        };
      };

      await serverTx.dbTransaction.wrappedTransaction
        .update(workflow_statuses)
        .set({ name, updated_at: new Date(), updated_by: session.user_id })
        .where(
          and(
            eq(workflow_statuses.id, args.status_id),
            eq(workflow_statuses.church_id, args.church_id),
            isNull(workflow_statuses.deleted_at),
          ),
        );
    }),
    reorder_statuses: defineChurchTaskMutator(
      ReorderWorkflowStatusesArgs,
      async ({ args, ctx, tx }) => {
        if (tx.location !== "server") {
          throw new Error("workflows.reorder_statuses must run on the server");
        }

        const session = requireTeamManager(ctx, args.church_id);
        const serverTx = tx as typeof tx & {
          readonly dbTransaction: {
            readonly wrappedTransaction: { readonly update: (table: unknown) => any };
          };
        };
        const now = new Date();

        await Promise.all(
          args.status_ids.map((status_id, sort_order) =>
            serverTx.dbTransaction.wrappedTransaction
              .update(workflow_statuses)
              .set({ sort_order, updated_at: now, updated_by: session.user_id })
              .where(
                and(
                  eq(workflow_statuses.id, status_id),
                  eq(workflow_statuses.workflow_id, args.workflow_id),
                  eq(workflow_statuses.church_id, args.church_id),
                  isNull(workflow_statuses.deleted_at),
                ),
              ),
          ),
        );
      },
    ),
    archive_status: defineChurchTaskMutator(
      ArchiveWorkflowStatusArgs,
      async ({ args, ctx, tx }) => {
        if (tx.location !== "server") {
          throw new Error("workflows.archive_status must run on the server");
        }

        const session = requireTeamManager(ctx, args.church_id);
        const now = new Date();
        const serverTx = tx as typeof tx & {
          readonly dbTransaction: {
            readonly wrappedTransaction: { readonly update: (table: unknown) => any };
          };
        };

        await serverTx.dbTransaction.wrappedTransaction
          .update(workflow_statuses)
          .set({
            deleted_at: now,
            deleted_by: session.user_id,
            updated_at: now,
            updated_by: session.user_id,
          })
          .where(
            and(
              eq(workflow_statuses.id, args.status_id),
              eq(workflow_statuses.church_id, args.church_id),
              isNull(workflow_statuses.deleted_at),
            ),
          );
      },
    ),
  },
});
