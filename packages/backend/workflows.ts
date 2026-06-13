import type { TaskStatus } from "@church-task/domain/Task";
import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { components } from "./convex/_generated/api";
import type { DataModel, Id } from "./convex/_generated/dataModel";

export type TaskState = TaskStatus;

type WorkflowStatusInput = {
  readonly key: string;
  readonly name: string;
  readonly taskState: TaskState;
  readonly sortOrder: number;
};

type MutationCtx = GenericMutationCtx<DataModel>;

const REQUIRED_VISIBLE_TASK_STATES = ["todo", "in_progress", "done"] as const;

export function validateWorkflowStatuses(statuses: ReadonlyArray<WorkflowStatusInput>) {
  const activeStatuses = statuses.filter((status) => status.taskState !== "canceled");
  const normalizedNames = new Set<string>();
  const sortOrders = new Set<number>();

  if (statuses.some((status) => status.taskState === "canceled")) {
    return "Canceled is a Task State, not a visible Workflow Status.";
  }

  for (const status of activeStatuses) {
    const normalizedName = status.name.trim().toLocaleLowerCase();

    if (!status.name.trim()) return "Workflow Status names are required.";
    if (normalizedNames.has(normalizedName)) {
      return "Active Workflow Status names must be unique within a Workflow.";
    }
    normalizedNames.add(normalizedName);

    if (sortOrders.has(status.sortOrder)) {
      return "Workflow Status sort orders must be explicit and unique within a Workflow.";
    }
    sortOrders.add(status.sortOrder);
  }

  for (const requiredState of REQUIRED_VISIBLE_TASK_STATES) {
    if (!activeStatuses.some((status) => status.taskState === requiredState)) {
      return "A Workflow requires active To Do, In Progress, and Done Workflow Statuses.";
    }
  }

  return null;
}

export async function readWorkflowModel(
  ctx: { readonly db: GenericDatabaseReader<DataModel> },
  churchId: string,
) {
  const workflows = await ctx.db
    .query("workflows")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const workflowStatuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();

  return { workflows, workflowStatuses, tasks };
}

/**
 * The Workflow owned by a Team (ADR 0013: every Team owns its Workflow).
 * Returns null only when the invariant is violated — there is no Church
 * default Workflow to fall back to.
 */
export async function getTeamWorkflow(
  ctx: { readonly db: GenericDatabaseReader<DataModel> },
  args: { readonly churchId: string; readonly teamId: string },
) {
  const workflow = await ctx.db
    .query("workflows")
    .withIndex("by_churchId_and_teamId", (q) =>
      q.eq("churchId", args.churchId).eq("teamId", args.teamId),
    )
    .first();

  return workflow && workflow.archivedAt === null ? workflow : null;
}

export async function renameWorkflow(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly workflowId: string; readonly name: string },
) {
  const workflow = await ctx.db.get(args.workflowId as Id<"workflows">);
  if (!workflow || workflow.churchId !== args.churchId) {
    return { ok: false as const, code: "notFound" };
  }

  await ctx.db.patch(workflow._id, { name: args.name });

  return { ok: true as const, workflow };
}

export async function reorderWorkflows(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly workflowIds: ReadonlyArray<string> },
) {
  const workflows = await ctx.db
    .query("workflows")
    .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
    .collect();
  const activeWorkflows = workflows.filter((workflow) => workflow.archivedAt === null);
  const workflowsById = new Map(
    activeWorkflows.map((workflow) => [String(workflow._id), workflow]),
  );
  const uniqueWorkflowIds = new Set(args.workflowIds);

  if (
    uniqueWorkflowIds.size !== args.workflowIds.length ||
    uniqueWorkflowIds.size !== activeWorkflows.length ||
    args.workflowIds.some((workflowId) => !workflowsById.has(workflowId))
  ) {
    return { ok: false as const, code: "invalidReorder" };
  }

  for (const [sortOrder, workflowId] of args.workflowIds.entries()) {
    await ctx.db.patch(workflowId as Id<"workflows">, { sortOrder });
  }

  return { ok: true as const, workflowsById };
}

export async function addWorkflowStatus(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly workflowId: string;
    readonly status: WorkflowStatusInput;
  },
) {
  const workflow = await ctx.db.get(args.workflowId as Id<"workflows">);
  if (!workflow || workflow.churchId !== args.churchId || workflow.archivedAt !== null) {
    return { ok: false as const, code: "workflowNotFound" };
  }

  const existingStatuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", workflow._id))
    .collect();
  const validationError = validateWorkflowStatuses(
    [...existingStatuses.filter((status) => status.archivedAt === null), args.status].map(
      (status) => ({
        key: status.key,
        name: status.name,
        taskState: status.taskState,
        sortOrder: status.sortOrder,
      }),
    ),
  );

  if (validationError)
    return { ok: false as const, code: "invalidWorkflow", message: validationError };

  const statusId = await ctx.db.insert("workflowStatuses", {
    churchId: args.churchId,
    workflowId: workflow._id,
    ...args.status,
    archivedAt: null,
  });

  return { ok: true as const, statusId };
}

export async function renameWorkflowStatus(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly statusId: string; readonly name: string },
) {
  const status = await ctx.db.get(args.statusId as Id<"workflowStatuses">);
  if (!status || status.churchId !== args.churchId || status.archivedAt !== null) {
    return { ok: false as const, code: "notFound" };
  }

  const statuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", status.workflowId))
    .collect();
  const validationError = validateWorkflowStatuses(
    statuses
      .filter((candidate) => candidate.archivedAt === null)
      .map((candidate) => ({
        key: candidate.key,
        name: candidate._id === status._id ? args.name : candidate.name,
        taskState: candidate.taskState,
        sortOrder: candidate.sortOrder,
      })),
  );

  if (validationError)
    return { ok: false as const, code: "invalidWorkflow", message: validationError };

  await ctx.db.patch(status._id, { name: args.name });

  return { ok: true as const, status };
}

export async function reorderWorkflowStatuses(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly workflowId: string;
    readonly statusIds: ReadonlyArray<string>;
  },
) {
  const workflow = await ctx.db.get(args.workflowId as Id<"workflows">);
  if (!workflow || workflow.churchId !== args.churchId || workflow.archivedAt !== null) {
    return { ok: false as const, code: "workflowNotFound" };
  }

  const statuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", workflow._id))
    .collect();
  const activeStatuses = statuses.filter((status) => status.archivedAt === null);
  const statusesById = new Map(activeStatuses.map((status) => [String(status._id), status]));
  const uniqueStatusIds = new Set(args.statusIds);

  if (
    uniqueStatusIds.size !== args.statusIds.length ||
    uniqueStatusIds.size !== activeStatuses.length ||
    args.statusIds.some((statusId) => !statusesById.has(statusId))
  ) {
    return { ok: false as const, code: "invalidReorder" };
  }

  for (const [sortOrder, statusId] of args.statusIds.entries()) {
    await ctx.db.patch(statusId as Id<"workflowStatuses">, { sortOrder });
  }

  return { ok: true as const, statusesById };
}

export async function archiveWorkflow(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly workflowId: string; readonly archivedAt: string },
) {
  const workflow = await ctx.db.get(args.workflowId as Id<"workflows">);
  if (!workflow || workflow.churchId !== args.churchId) {
    return { ok: false as const, code: "notFound" };
  }

  // Every Team owns its Workflow (ADR 0013): a Workflow stays in use while
  // its owning Team is active.
  const owningTeam = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "team",
    where: [
      { field: "_id", value: workflow.teamId },
      { field: "organizationId", value: args.churchId },
    ],
  })) as { readonly archivedAt?: string | null } | null;
  if (owningTeam && (owningTeam.archivedAt ?? null) === null) {
    return { ok: false as const, code: "inUse", workflow };
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
    .collect();
  if (tasks.some((task) => task.workflowId === args.workflowId)) {
    return { ok: false as const, code: "inUse", workflow };
  }

  await ctx.db.patch(workflow._id, { archivedAt: args.archivedAt });

  return { ok: true as const, workflow };
}

export async function archiveWorkflowStatus(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly statusId: string; readonly archivedAt: string },
) {
  const status = await ctx.db.get(args.statusId as Id<"workflowStatuses">);
  if (!status || status.churchId !== args.churchId) return { ok: false as const, code: "notFound" };

  const taskUsingStatus = await ctx.db
    .query("tasks")
    .withIndex("by_workflowStatusId", (q) => q.eq("workflowStatusId", status._id))
    .collect();
  const activeTask = taskUsingStatus.find((task) => task.taskState !== "canceled");

  if (activeTask) return { ok: false as const, code: "inUse", status };

  const remainingStatuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", status.workflowId))
    .collect();
  const validationError = validateWorkflowStatuses(
    remainingStatuses
      .filter((candidate) => candidate._id !== status._id && candidate.archivedAt === null)
      .map((candidate) => ({
        key: candidate.key,
        name: candidate.name,
        taskState: candidate.taskState,
        sortOrder: candidate.sortOrder,
      })),
  );

  if (validationError)
    return { ok: false as const, code: "invalidWorkflow", message: validationError };

  await ctx.db.patch(status._id, { archivedAt: args.archivedAt });

  return { ok: true as const, status };
}

export async function remapWorkflowStatusForTaskTeam(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly taskId: string;
    readonly destinationTeamId: string;
    readonly destinationWorkflowId: string;
  },
) {
  const task = await ctx.db.get(args.taskId as Id<"tasks">);
  if (!task || task.churchId !== args.churchId) return { ok: false as const, code: "taskNotFound" };

  const currentStatus = await ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">);
  const destinationWorkflow = await ctx.db.get(args.destinationWorkflowId as Id<"workflows">);

  if (!currentStatus || !destinationWorkflow || destinationWorkflow.churchId !== args.churchId) {
    return { ok: false as const, code: "workflowNotFound" };
  }

  const destinationStatuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", args.destinationWorkflowId))
    .collect();
  const activeStatuses = destinationStatuses.filter((status) => status.archivedAt === null);
  const sameNameAndState = activeStatuses.find(
    (status) => status.taskState === task.taskState && status.name === currentStatus.name,
  );
  const sameStateFallback = [...activeStatuses]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .find((status) => status.taskState === task.taskState);
  const destinationStatus = sameNameAndState ?? sameStateFallback;

  if (!destinationStatus) return { ok: false as const, code: "remapFailed" };

  await ctx.db.patch(task._id, {
    teamId: args.destinationTeamId,
    workflowId: args.destinationWorkflowId,
    workflowStatusId: destinationStatus._id,
    taskState: destinationStatus.taskState,
  });

  return {
    ok: true as const,
    task,
    currentStatus,
    destinationStatus,
  };
}
