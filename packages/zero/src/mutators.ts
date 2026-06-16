import {
  DEFAULT_WORKFLOW_STATUSES,
  formatTaskIdentifier,
  generateTeamIdentifier,
  getLabelColorForName,
  getTeamColorForName,
  normalizeTeamIdentifier,
  TEAM_IDENTIFIER_MAX_LENGTH,
} from "@church-task/domain";
import {
  getDemoItemId,
  getLabelId,
  getTaskId,
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
  labels,
  tasks,
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
const CreateLabelArgs = Schema.standardSchemaV1(
  Schema.Struct({
    church_id: Schema.String,
    color: Schema.optional(Schema.String),
    label_id: Schema.optional(Schema.String),
    name: Schema.String,
    team_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  }),
);
const UpdateLabelArgs = Schema.standardSchemaV1(
  Schema.Struct({
    church_id: Schema.String,
    color: Schema.optional(Schema.String),
    label_id: Schema.String,
    name: Schema.optional(Schema.String),
  }),
);
const DeleteLabelArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, label_id: Schema.String }),
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
const TaskEstimateArg = Schema.Union(
  Schema.Literal("xs"),
  Schema.Literal("s"),
  Schema.Literal("m"),
  Schema.Literal("l"),
  Schema.Literal("xl"),
  Schema.Null,
);
const TaskFieldsArg = Schema.Struct({
  assigned_user_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  board_order: Schema.optional(Schema.String),
  due_date: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  estimate: Schema.optional(TaskEstimateArg),
  label_ids: Schema.optional(Schema.Array(Schema.String)),
  parent_task_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  team_id: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  workflow_status_id: Schema.optional(Schema.String),
});
const CreateTaskArgs = Schema.standardSchemaV1(
  Schema.Struct({
    assigned_user_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
    church_id: Schema.String,
    description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
    due_date: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
    estimate: Schema.optional(TaskEstimateArg),
    label_ids: Schema.optional(Schema.Array(Schema.String)),
    parent_task_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
    team_id: Schema.String,
    title: Schema.String,
    workflow_status_id: Schema.String,
  }),
);
const UpdateTaskArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, fields: TaskFieldsArg, task_id: Schema.String }),
);
const UpdateTasksBatchArgs = Schema.standardSchemaV1(
  Schema.Struct({
    church_id: Schema.String,
    updates: Schema.Array(Schema.Struct({ fields: TaskFieldsArg, task_id: Schema.String })),
  }),
);
const TaskTransitionArgs = Schema.standardSchemaV1(
  Schema.Struct({ church_id: Schema.String, task_id: Schema.String }),
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

const serializeStringArray = (values: ReadonlyArray<string>) =>
  JSON.stringify([...new Set(values)]);

const appendBoardOrderKey = (lastKey: string | null): string => {
  if (lastKey === null) return "a1";
  const prefix = lastKey.match(/^[a-zA-Z]+/)?.[0] ?? "a";
  const parsed = Number.parseFloat(
    lastKey.startsWith(prefix) ? lastKey.slice(prefix.length) : lastKey,
  );
  return `${prefix}${Number.isFinite(parsed) ? parsed + 1 : 1}`;
};

const parseSerializedStringArray = (value: string): readonly string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

type LabelScopeRow = {
  readonly id: string;
  readonly name: string;
  readonly team_id: string | null;
};

type ServerTx = {
  readonly dbTransaction: {
    readonly wrappedTransaction: {
      readonly delete: (table: unknown) => any;
      readonly insert: (table: unknown) => any;
      readonly select: (fields?: unknown) => any;
      readonly update: (table: unknown) => any;
    };
  };
};

const serverDb = (tx: { readonly location: string }) => {
  if (tx.location !== "server") return null;
  return (tx as typeof tx & ServerTx).dbTransaction.wrappedTransaction;
};

const getChurchLabels = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  church_id: string,
) =>
  (await db
    .select({ id: labels.id, name: labels.name, team_id: labels.team_id })
    .from(labels)
    .where(and(eq(labels.church_id, church_id), isNull(labels.deleted_at)))) as LabelScopeRow[];

const normalizeLabelName = (name: string) => name.trim().toLowerCase();

const ensureUniqueLabelName = (
  existingLabels: readonly LabelScopeRow[],
  args: {
    readonly exclude_id?: string;
    readonly name: string;
    readonly team_id: string | null;
  },
) => {
  const normalized = normalizeLabelName(args.name);
  const duplicate = existingLabels.some(
    (label) =>
      label.id !== args.exclude_id &&
      label.team_id === args.team_id &&
      normalizeLabelName(label.name) === normalized,
  );

  if (duplicate) throw new Error("A Label with that name already exists in this scope.");
};

const validateTaskLabelIds = (
  existingLabels: readonly LabelScopeRow[],
  args: { readonly label_ids: readonly string[]; readonly team_id: string },
) => {
  const labelsById = new Map(existingLabels.map((label) => [label.id, label]));

  for (const label_id of args.label_ids) {
    const label = labelsById.get(label_id);
    if (!label) throw new Error("Label not found.");
    if (label.team_id !== null && label.team_id !== args.team_id) {
      throw new Error("Label is not in this Task's Team scope.");
    }
  }
};

const stripForeignTeamLabelIds = (
  existingLabels: readonly LabelScopeRow[],
  args: { readonly label_ids: readonly string[]; readonly team_id: string },
) => {
  const labelsById = new Map(existingLabels.map((label) => [label.id, label]));

  return args.label_ids.filter((label_id) => {
    const label = labelsById.get(label_id);

    return label !== undefined && (label.team_id === null || label.team_id === args.team_id);
  });
};

const getTaskWithTeamIdentifier = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  task_id: string,
  church_id: string,
) => {
  const rows = (await db
    .select({
      board_order: tasks.board_order,
      church_id: tasks.church_id,
      deleted_at: tasks.deleted_at,
      finished_at: tasks.finished_at,
      id: tasks.id,
      label_ids: tasks.label_ids,
      number: tasks.number,
      previous_identifiers: tasks.previous_identifiers,
      task_state: tasks.task_state,
      team_id: tasks.team_id,
      team_identifier: teams.identifier,
      workflow_id: tasks.workflow_id,
      workflow_status_id: tasks.workflow_status_id,
    })
    .from(tasks)
    .leftJoin(teams, eq(tasks.team_id, teams.id))
    .where(
      and(eq(tasks.id, task_id), eq(tasks.church_id, church_id), isNull(tasks.deleted_at)),
    )) as Array<{
    readonly board_order: string;
    readonly church_id: string;
    readonly deleted_at: Date | null;
    readonly finished_at: Date | null;
    readonly id: string;
    readonly label_ids: string;
    readonly number: number;
    readonly previous_identifiers: string;
    readonly task_state: string;
    readonly team_id: string;
    readonly team_identifier: string | null;
    readonly workflow_id: string;
    readonly workflow_status_id: string;
  }>;

  return rows[0] ?? null;
};

const taskPatchForFields = async (
  db: ServerTx["dbTransaction"]["wrappedTransaction"],
  args: {
    readonly church_id: string;
    readonly fields: typeof TaskFieldsArg.Type;
    readonly session_user_id: string;
    readonly task_id: string;
  },
) => {
  const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
  if (!task) throw new Error("Task not found.");

  const now = new Date();
  const patch: Record<string, unknown> = { updated_at: now, updated_by: args.session_user_id };

  if (args.fields.title !== undefined) patch.title = args.fields.title.trim();
  if (args.fields.assigned_user_id !== undefined)
    patch.assigned_user_id = args.fields.assigned_user_id;
  if (args.fields.due_date !== undefined) patch.due_date = args.fields.due_date;
  if (args.fields.parent_task_id !== undefined) patch.parent_task_id = args.fields.parent_task_id;
  if (args.fields.board_order !== undefined) patch.board_order = args.fields.board_order;
  if (args.fields.estimate !== undefined) patch.estimate = args.fields.estimate;

  if (args.fields.workflow_status_id !== undefined) {
    const statusRows = (await db
      .select({
        id: workflow_statuses.id,
        task_state: workflow_statuses.task_state,
        workflow_id: workflow_statuses.workflow_id,
      })
      .from(workflow_statuses)
      .where(
        and(
          eq(workflow_statuses.id, args.fields.workflow_status_id),
          eq(workflow_statuses.church_id, args.church_id),
          isNull(workflow_statuses.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly task_state: string;
      readonly workflow_id: string;
    }>;
    const status = statusRows[0];
    if (!status) throw new Error("Workflow Status not found.");
    if (status.workflow_id !== task.workflow_id)
      throw new Error("Workflow Status is not in this Task's Workflow.");
    patch.workflow_status_id = status.id;
    patch.task_state = status.task_state;
    patch.finished_at =
      status.task_state === "done" ? now : task.task_state === "done" ? null : task.finished_at;
  }

  if (args.fields.team_id !== undefined && args.fields.team_id !== task.team_id) {
    const teamRows = (await db
      .select({
        id: teams.id,
        identifier: teams.identifier,
        next_task_number: teams.next_task_number,
      })
      .from(teams)
      .where(
        and(
          eq(teams.id, args.fields.team_id),
          eq(teams.church_id, args.church_id),
          isNull(teams.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly identifier: string;
      readonly next_task_number: number;
    }>;
    const team = teamRows[0];
    if (!team) throw new Error("Team not found.");
    const workflowRows = (await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.team_id, team.id),
          eq(workflows.church_id, args.church_id),
          isNull(workflows.deleted_at),
        ),
      )) as Array<{ readonly id: string }>;
    const workflow = workflowRows[0];
    if (!workflow) throw new Error("Team Workflow not found.");
    const statusRows = (await db
      .select({ id: workflow_statuses.id, task_state: workflow_statuses.task_state })
      .from(workflow_statuses)
      .where(
        and(
          eq(workflow_statuses.workflow_id, workflow.id),
          eq(workflow_statuses.task_state, task.task_state),
          isNull(workflow_statuses.deleted_at),
        ),
      )) as Array<{
      readonly id: string;
      readonly task_state: string;
    }>;
    const status = statusRows[0];
    if (!status) throw new Error("Workflow Status remap failed.");

    const previousIdentifier = formatTaskIdentifier(task.team_identifier ?? "TEAM", task.number);
    patch.team_id = team.id;
    patch.workflow_id = workflow.id;
    patch.workflow_status_id = status.id;
    patch.number = team.next_task_number;
    patch.previous_identifiers = serializeStringArray([
      ...parsePreviousIdentifiers(task.previous_identifiers),
      previousIdentifier,
    ]);
    await db
      .update(teams)
      .set({
        next_task_number: team.next_task_number + 1,
        updated_at: now,
        updated_by: args.session_user_id,
      })
      .where(eq(teams.id, team.id));
  }

  const effectiveTeamId = (patch.team_id as string | undefined) ?? task.team_id;
  if (args.fields.label_ids !== undefined) {
    const churchLabels = await getChurchLabels(db, args.church_id);
    validateTaskLabelIds(churchLabels, {
      label_ids: args.fields.label_ids,
      team_id: effectiveTeamId,
    });
    patch.label_ids = serializeStringArray(args.fields.label_ids);
  } else if (patch.team_id !== undefined) {
    const churchLabels = await getChurchLabels(db, args.church_id);
    patch.label_ids = serializeStringArray(
      stripForeignTeamLabelIds(churchLabels, {
        label_ids: parseSerializedStringArray(task.label_ids),
        team_id: effectiveTeamId,
      }),
    );
  }

  return patch;
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
        return;
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
        return;
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
        return;
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
        return;
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
        return;
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
        return;
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
        return;
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
  labels: {
    create: defineChurchTaskMutator(CreateLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTeamManager(ctx, args.church_id);
      const name = args.name.trim();
      if (!name) throw new Error("Label name is required.");

      const teamId = args.team_id ?? null;
      if (teamId !== null) {
        const teamRows = (await db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.id, teamId),
              eq(teams.church_id, args.church_id),
              isNull(teams.deleted_at),
            ),
          )) as Array<{ readonly id: string }>;
        if (teamRows.length === 0) throw new Error("Team was not found in the active Church.");
      }

      const existingLabels = await getChurchLabels(db, args.church_id);
      ensureUniqueLabelName(existingLabels, { name, team_id: teamId });
      const now = new Date();
      const labelId = args.label_id ?? getLabelId();

      await db.insert(labels).values({
        _tag: "label",
        church_id: args.church_id,
        color: args.color ?? getLabelColorForName(name),
        created_at: now,
        created_by: session.user_id,
        id: labelId,
        name,
        team_id: teamId,
        updated_at: now,
        updated_by: session.user_id,
      });
    }),
    update: defineChurchTaskMutator(UpdateLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireTeamManager(ctx, args.church_id);
      const existingLabels = await getChurchLabels(db, args.church_id);
      const label = existingLabels.find((candidate) => candidate.id === args.label_id);
      if (!label) throw new Error("Label not found.");

      const patch: Record<string, unknown> = {
        updated_at: new Date(),
        updated_by: session.user_id,
      };

      if (args.name !== undefined) {
        const name = args.name.trim();
        if (!name) throw new Error("Label name is required.");
        ensureUniqueLabelName(existingLabels, {
          exclude_id: args.label_id,
          name,
          team_id: label.team_id,
        });
        patch.name = name;
      }

      if (args.color !== undefined) patch.color = args.color;

      await db
        .update(labels)
        .set(patch)
        .where(and(eq(labels.id, args.label_id), eq(labels.church_id, args.church_id)));
    }),
    delete: defineChurchTaskMutator(DeleteLabelArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      requireTeamManager(ctx, args.church_id);
      const existingLabels = await getChurchLabels(db, args.church_id);
      if (!existingLabels.some((label) => label.id === args.label_id)) {
        throw new Error("Label not found.");
      }

      const taskRows = (await db
        .select({ id: tasks.id, label_ids: tasks.label_ids })
        .from(tasks)
        .where(and(eq(tasks.church_id, args.church_id), isNull(tasks.deleted_at)))) as Array<{
        readonly id: string;
        readonly label_ids: string;
      }>;

      for (const task of taskRows) {
        const currentLabelIds = parseSerializedStringArray(task.label_ids);
        const nextLabelIds = currentLabelIds.filter((label_id) => label_id !== args.label_id);
        if (nextLabelIds.length === currentLabelIds.length) continue;

        await db
          .update(tasks)
          .set({ label_ids: serializeStringArray(nextLabelIds) })
          .where(eq(tasks.id, task.id));
      }

      await db
        .delete(labels)
        .where(and(eq(labels.id, args.label_id), eq(labels.church_id, args.church_id)));
    }),
  },
  tasks: {
    create: defineChurchTaskMutator(CreateTaskArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const title = args.title.trim();
      if (!title) throw new Error("Task title is required.");

      const statusRows = (await db
        .select({
          id: workflow_statuses.id,
          task_state: workflow_statuses.task_state,
          workflow_id: workflow_statuses.workflow_id,
        })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.id, args.workflow_status_id),
            eq(workflow_statuses.church_id, args.church_id),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{
        readonly id: string;
        readonly task_state: string;
        readonly workflow_id: string;
      }>;
      const status = statusRows[0];
      if (!status) throw new Error("Workflow Status not found.");

      const teamRows = (await db
        .select({
          id: teams.id,
          identifier: teams.identifier,
          next_task_number: teams.next_task_number,
        })
        .from(teams)
        .where(
          and(
            eq(teams.id, args.team_id),
            eq(teams.church_id, args.church_id),
            isNull(teams.deleted_at),
          ),
        )) as Array<{
        readonly id: string;
        readonly identifier: string;
        readonly next_task_number: number;
      }>;
      const team = teamRows[0];
      if (!team) throw new Error("Team not found.");

      const workflowRows = (await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, status.workflow_id),
            eq(workflows.team_id, team.id),
            eq(workflows.church_id, args.church_id),
            isNull(workflows.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      if (workflowRows.length === 0)
        throw new Error("Workflow Status is not in the Team Workflow.");

      const labelIds = args.label_ids ?? [];
      validateTaskLabelIds(await getChurchLabels(db, args.church_id), {
        label_ids: labelIds,
        team_id: team.id,
      });

      const boardRows = (await db
        .select({ board_order: tasks.board_order })
        .from(tasks)
        .where(and(eq(tasks.workflow_status_id, status.id), isNull(tasks.deleted_at)))) as Array<{
        readonly board_order: string;
      }>;
      const boardOrder = appendBoardOrderKey(
        boardRows.reduce<string | null>(
          (max, task) => (max === null || task.board_order > max ? task.board_order : max),
          null,
        ),
      );
      const now = new Date();
      const taskId = getTaskId();

      await db.insert(tasks).values({
        _tag: "task",
        assigned_user_id: args.assigned_user_id ?? null,
        board_order: boardOrder,
        church_id: args.church_id,
        created_at: now,
        created_by: session.user_id,
        created_by_user_id: session.user_id,
        cycle_id: null,
        description: args.description ?? null,
        due_date: args.due_date ?? null,
        estimate: args.estimate ?? null,
        finished_at: status.task_state === "done" ? now : null,
        id: taskId,
        label_ids: serializeStringArray(labelIds),
        number: team.next_task_number,
        parent_task_id: args.parent_task_id ?? null,
        previous_identifiers: "[]",
        source_template_cycle_id: null,
        source_template_id: null,
        source_template_sync_enabled: false,
        source_template_task_id: null,
        task_state: status.task_state,
        team_id: team.id,
        title,
        updated_at: now,
        updated_by: session.user_id,
        workflow_id: status.workflow_id,
        workflow_status_id: status.id,
      });

      await db
        .update(teams)
        .set({
          next_task_number: team.next_task_number + 1,
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(eq(teams.id, team.id));
    }),
    update: defineChurchTaskMutator(UpdateTaskArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const patch = await taskPatchForFields(db, {
        church_id: args.church_id,
        fields: args.fields,
        session_user_id: session.user_id,
        task_id: args.task_id,
      });

      await db
        .update(tasks)
        .set(patch)
        .where(
          and(
            eq(tasks.id, args.task_id),
            eq(tasks.church_id, args.church_id),
            isNull(tasks.deleted_at),
          ),
        );
    }),
    update_batch: defineChurchTaskMutator(UpdateTasksBatchArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      for (const update of args.updates) {
        const patch = await taskPatchForFields(db, {
          church_id: args.church_id,
          fields: update.fields,
          session_user_id: session.user_id,
          task_id: update.task_id,
        });
        await db
          .update(tasks)
          .set(patch)
          .where(
            and(
              eq(tasks.id, update.task_id),
              eq(tasks.church_id, args.church_id),
              isNull(tasks.deleted_at),
            ),
          );
      }
    }),
    complete: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
      if (!task) throw new Error("Task not found.");
      const rows = (await db
        .select({ id: workflow_statuses.id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.workflow_id, task.workflow_id),
            eq(workflow_statuses.task_state, "done"),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      const status = rows[0];
      if (!status) throw new Error("Done Workflow Status not found.");
      const now = new Date();
      await db
        .update(tasks)
        .set({
          finished_at: now,
          task_state: "done",
          updated_at: now,
          updated_by: session.user_id,
          workflow_status_id: status.id,
        })
        .where(eq(tasks.id, args.task_id));
    }),
    cancel: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const now = new Date();
      await db
        .update(tasks)
        .set({
          finished_at: now,
          task_state: "canceled",
          updated_at: now,
          updated_by: session.user_id,
        })
        .where(
          and(
            eq(tasks.id, args.task_id),
            eq(tasks.church_id, args.church_id),
            isNull(tasks.deleted_at),
          ),
        );
    }),
    reopen: defineChurchTaskMutator(TaskTransitionArgs, async ({ args, ctx, tx }) => {
      const db = serverDb(tx);
      if (!db) return;

      const session = requireActiveChurchAccess(ctx, args.church_id);
      const task = await getTaskWithTeamIdentifier(db, args.task_id, args.church_id);
      if (!task) throw new Error("Task not found.");
      const rows = (await db
        .select({ id: workflow_statuses.id })
        .from(workflow_statuses)
        .where(
          and(
            eq(workflow_statuses.workflow_id, task.workflow_id),
            eq(workflow_statuses.task_state, "todo"),
            isNull(workflow_statuses.deleted_at),
          ),
        )) as Array<{ readonly id: string }>;
      const status = rows[0];
      if (!status) throw new Error("To Do Workflow Status not found.");
      const now = new Date();
      await db
        .update(tasks)
        .set({
          finished_at: null,
          task_state: "todo",
          updated_at: now,
          updated_by: session.user_id,
          workflow_status_id: status.id,
        })
        .where(eq(tasks.id, args.task_id));
    }),
  },
  workflows: {
    rename: defineChurchTaskMutator(RenameWorkflowArgs, async ({ args, ctx, tx }) => {
      if (tx.location !== "server") {
        return;
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
        return;
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
        return;
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
        return;
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
        return;
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
          return;
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
          return;
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
