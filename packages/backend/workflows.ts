import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import type { DataModel, Id } from "./convex/_generated/dataModel";

export type TaskState = "todo" | "in_progress" | "done" | "canceled";

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

export async function createWorkflow(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly key: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly statuses: ReadonlyArray<WorkflowStatusInput>;
  },
) {
  const validationError = validateWorkflowStatuses(args.statuses);
  if (validationError) return { ok: false as const, error: validationError };

  const existingWorkflow = await ctx.db
    .query("workflows")
    .withIndex("by_churchId_and_key", (q) => q.eq("churchId", args.churchId).eq("key", args.key))
    .unique();

  if (existingWorkflow) return { ok: false as const, error: "Workflow keys must be unique." };

  const workflowId = await ctx.db.insert("workflows", {
    churchId: args.churchId,
    key: args.key,
    name: args.name,
    isDefault: args.isDefault,
    sortOrder: args.sortOrder,
    archivedAt: null,
  });

  for (const status of args.statuses) {
    await ctx.db.insert("workflowStatuses", {
      churchId: args.churchId,
      workflowId,
      ...status,
      archivedAt: null,
    });
  }

  return { ok: true as const, workflowId };
}

export async function archiveWorkflowStatus(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly statusId: string; readonly archivedAt: string },
) {
  const status = await ctx.db.get(args.statusId as Id<"workflowStatuses">);
  if (!status || status.churchId !== args.churchId) return { ok: false as const, code: "notFound" };

  const activeTask = await ctx.db
    .query("tasks")
    .withIndex("by_workflowStatusId", (q) => q.eq("workflowStatusId", status._id))
    .first();

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
