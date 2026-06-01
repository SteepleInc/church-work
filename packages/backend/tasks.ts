import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { buildCycleForLocalDate } from "./churchCycleCalendar";
import type { DataModel, Id } from "./convex/_generated/dataModel";
import { writeActivity } from "./activityRegistry";

type MutationCtx = GenericMutationCtx<DataModel>;

type TaskCreateInput = {
  readonly title: string;
  readonly teamId: string | null;
  readonly assignedUserId?: string | null;
  readonly workflowStatusId: string;
  readonly dueDate: string;
  readonly parentTaskId: string | null;
};

type TaskUpdateInput = {
  readonly taskId: string;
  readonly fields: {
    readonly title?: string;
    readonly assignedUserId?: string | null;
    readonly teamId?: string | null;
  };
};

type TeamWorkflowResolution = {
  readonly defaultWorkflowId: string;
  readonly teamWorkflowIds: Readonly<Record<string, string>>;
};

type TaskState = "todo" | "in_progress" | "done" | "canceled";
type RestorableTaskState = Exclude<TaskState, "canceled">;
type TransitionCode =
  | "taskNotFound"
  | "invalidTaskTransition"
  | "inconsistentTaskStatus"
  | "doneWorkflowStatusNotFound"
  | "restoreActivityNotFound"
  | "restoreWorkflowStatusNotFound";

export async function readTaskModel(
  ctx: { readonly db: GenericDatabaseReader<DataModel> },
  churchId: string,
  filters: {
    readonly surface?: "my_work" | "our_work";
    readonly cycleId?: string;
    readonly currentUserId?: string;
  } = {},
) {
  const cycles = await ctx.db
    .query("cycles")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const executionCycle = filters.cycleId
    ? cycles.find((cycle) => cycle._id === filters.cycleId)
    : null;
  const tasks = allTasks.filter((task) => {
    if (filters.surface === "my_work" && task.assignedUserId !== filters.currentUserId) {
      return false;
    }

    if (!executionCycle) return true;

    return (
      task.dueDate <= executionCycle.endDate &&
      (task.finishedAt === null || task.finishedAt >= executionCycle.startsAt)
    );
  });

  return { cycles, tasks };
}

async function ensureCycleForDueDate(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly dueDate: string; readonly churchTimeZone: string },
) {
  const cycle = buildCycleForLocalDate({
    localDate: args.dueDate,
    churchTimeZone: args.churchTimeZone,
  });
  const existing = await ctx.db
    .query("cycles")
    .withIndex("by_churchId_and_startDate", (q) =>
      q.eq("churchId", args.churchId).eq("startDate", cycle.startDate),
    )
    .unique();

  if (existing) return existing._id;

  return await ctx.db.insert("cycles", {
    churchId: args.churchId,
    ...cycle,
  });
}

export async function createTasks(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly churchTimeZone: string;
    readonly tasks: ReadonlyArray<TaskCreateInput>;
  },
) {
  const createdTaskIds: Array<Id<"tasks">> = [];
  const validatedTasks: Array<{
    readonly task: TaskCreateInput;
    readonly workflowId: string;
    readonly workflowStatusId: Id<"workflowStatuses">;
    readonly taskState: TaskState;
  }> = [];

  for (const task of args.tasks) {
    const workflowStatus = await ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">);
    if (
      !workflowStatus ||
      workflowStatus.churchId !== args.churchId ||
      workflowStatus.archivedAt !== null
    ) {
      return { ok: false as const, code: "workflowStatusNotFound" };
    }

    if (task.parentTaskId) {
      const parentTask = await ctx.db.get(task.parentTaskId as Id<"tasks">);
      if (!parentTask || parentTask.churchId !== args.churchId) {
        return { ok: false as const, code: "parentTaskNotFound" };
      }
    }

    try {
      buildCycleForLocalDate({ localDate: task.dueDate, churchTimeZone: args.churchTimeZone });
    } catch {
      return { ok: false as const, code: "invalidDueDate" };
    }

    validatedTasks.push({
      task,
      workflowId: workflowStatus.workflowId,
      workflowStatusId: workflowStatus._id,
      taskState: workflowStatus.taskState,
    });
  }

  for (const { task, workflowId, workflowStatusId, taskState } of validatedTasks) {
    const cycleId = await ensureCycleForDueDate(ctx, {
      churchId: args.churchId,
      dueDate: task.dueDate,
      churchTimeZone: args.churchTimeZone,
    });

    const taskId = await ctx.db.insert("tasks", {
      churchId: args.churchId,
      title: task.title,
      teamId: task.teamId,
      assignedUserId: task.assignedUserId ?? null,
      cycleId,
      dueDate: task.dueDate,
      parentTaskId: task.parentTaskId,
      workflowId,
      workflowStatusId,
      taskState,
      finishedAt: null,
      sourceTemplateId: null,
      sourceTemplateTaskId: null,
      sourceTemplateCycleId: null,
      sourceTemplateSyncEnabled: false,
    });
    createdTaskIds.push(taskId);
  }

  return { ok: true as const, createdTaskIds };
}

export async function updateTasks(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly updates: ReadonlyArray<TaskUpdateInput>;
    readonly actorId: string | null;
    readonly occurredAt: string;
    readonly teamWorkflowResolution?: TeamWorkflowResolution;
  },
) {
  const updates: Array<() => Promise<void>> = [];

  for (const update of args.updates) {
    const task = await ctx.db.get(update.taskId as Id<"tasks">);
    if (!task || task.churchId !== args.churchId) {
      return { ok: false as const, code: "taskNotFound" as const };
    }

    const patch: Partial<DataModel["tasks"]["document"]> = {};
    const updatedFields: Array<string> = [];

    if ("title" in update.fields && update.fields.title !== task.title) {
      patch.title = update.fields.title;
      updatedFields.push("title");
    }

    if (
      "assignedUserId" in update.fields &&
      (update.fields.assignedUserId ?? null) !== task.assignedUserId
    ) {
      patch.assignedUserId = update.fields.assignedUserId ?? null;
      updatedFields.push("assignedUserId");
    }

    let remappedTeam: {
      readonly previousTeamId: string | null;
      readonly teamId: string | null;
      readonly previousWorkflowId: string;
      readonly workflowId: string;
      readonly previousWorkflowStatusId: string;
      readonly workflowStatusId: Id<"workflowStatuses">;
    } | null = null;

    if ("teamId" in update.fields && (update.fields.teamId ?? null) !== task.teamId) {
      const teamId = update.fields.teamId ?? null;
      const workflowId = teamId
        ? args.teamWorkflowResolution?.teamWorkflowIds[teamId]
        : args.teamWorkflowResolution?.defaultWorkflowId;

      if (!workflowId) return { ok: false as const, code: "teamWorkflowNotConfigured" as const };

      const currentStatus = await ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">);
      if (!currentStatus) return { ok: false as const, code: "workflowStatusRemapFailed" as const };

      const destinationStatuses = await ctx.db
        .query("workflowStatuses")
        .withIndex("by_workflowId", (q) => q.eq("workflowId", workflowId))
        .collect();
      const activeStatuses = destinationStatuses.filter((status) => status.archivedAt === null);
      const sameNameAndState = activeStatuses.find(
        (status) => status.taskState === task.taskState && status.name === currentStatus.name,
      );
      const sameStateFallback = [...activeStatuses]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .find((status) => status.taskState === task.taskState);
      const destinationStatus = sameNameAndState ?? sameStateFallback;

      if (!destinationStatus) {
        return { ok: false as const, code: "workflowStatusRemapFailed" as const };
      }

      patch.teamId = teamId;
      patch.workflowId = workflowId;
      patch.workflowStatusId = destinationStatus._id;
      patch.taskState = destinationStatus.taskState;
      updatedFields.push("teamId");
      remappedTeam = {
        previousTeamId: task.teamId,
        teamId,
        previousWorkflowId: task.workflowId,
        workflowId,
        previousWorkflowStatusId: task.workflowStatusId,
        workflowStatusId: destinationStatus._id,
      };
    }

    if (updatedFields.length === 0) continue;

    updates.push(async () => {
      await ctx.db.patch(task._id, patch);

      if ("assignedUserId" in patch) {
        if (patch.assignedUserId === null) {
          if (task.assignedUserId !== null) {
            await writeActivity(ctx, {
              churchId: args.churchId,
              entityType: "task",
              entityId: task._id,
              eventType: "task.user_unassigned",
              actorType: "user",
              actorId: args.actorId,
              occurredAt: args.occurredAt,
              cycleId: task.cycleId,
              metadata: { previousAssignedUserId: task.assignedUserId },
            });
          }
        } else {
          await writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.user_assigned",
            actorType: "user",
            actorId: args.actorId,
            occurredAt: args.occurredAt,
            cycleId: task.cycleId,
            metadata: {
              previousAssignedUserId: task.assignedUserId,
              assignedUserId: patch.assignedUserId,
            },
          });
        }
      }

      if (remappedTeam) {
        if (remappedTeam.previousTeamId === null && remappedTeam.teamId !== null) {
          await writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.team_assigned",
            actorType: "user",
            actorId: args.actorId,
            occurredAt: args.occurredAt,
            cycleId: task.cycleId,
            metadata: {
              previousTeamId: null,
              teamId: remappedTeam.teamId,
              previousWorkflowId: remappedTeam.previousWorkflowId,
              workflowId: remappedTeam.workflowId,
              previousWorkflowStatusId: remappedTeam.previousWorkflowStatusId,
              workflowStatusId: remappedTeam.workflowStatusId,
            },
          });
        } else if (remappedTeam.previousTeamId !== null && remappedTeam.teamId === null) {
          await writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.team_unassigned",
            actorType: "user",
            actorId: args.actorId,
            occurredAt: args.occurredAt,
            cycleId: task.cycleId,
            metadata: {
              previousTeamId: remappedTeam.previousTeamId,
              previousWorkflowId: remappedTeam.previousWorkflowId,
              workflowId: remappedTeam.workflowId,
              previousWorkflowStatusId: remappedTeam.previousWorkflowStatusId,
              workflowStatusId: remappedTeam.workflowStatusId,
            },
          });
        } else if (remappedTeam.previousTeamId !== null && remappedTeam.teamId !== null) {
          await writeActivity(ctx, {
            churchId: args.churchId,
            entityType: "task",
            entityId: task._id,
            eventType: "task.team_changed",
            actorType: "user",
            actorId: args.actorId,
            occurredAt: args.occurredAt,
            cycleId: task.cycleId,
            metadata: {
              previousTeamId: remappedTeam.previousTeamId,
              teamId: remappedTeam.teamId,
              previousWorkflowId: remappedTeam.previousWorkflowId,
              workflowId: remappedTeam.workflowId,
              previousWorkflowStatusId: remappedTeam.previousWorkflowStatusId,
              workflowStatusId: remappedTeam.workflowStatusId,
            },
          });
        }
      }

      const nonAssignmentFields = updatedFields.filter(
        (field) => field !== "assignedUserId" && field !== "teamId",
      );
      if (nonAssignmentFields.length > 0) {
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.updated",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata: { updatedFields: nonAssignmentFields },
        });
      }
    });
  }

  for (const update of updates) await update();

  return { ok: true as const };
}

async function readTransitionTask(ctx: MutationCtx, churchId: string, taskId: string) {
  const task = await ctx.db.get(taskId as Id<"tasks">);
  if (!task || task.churchId !== churchId) return null;

  return task;
}

async function validateTaskStatus(ctx: MutationCtx, task: DataModel["tasks"]["document"]) {
  const status = await ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">);

  if (
    !status ||
    status.churchId !== task.churchId ||
    status.workflowId !== task.workflowId ||
    status.archivedAt !== null
  ) {
    return { ok: false as const, code: "workflowStatusNotFound" as const };
  }

  if (task.taskState === "done" || task.taskState === "canceled") {
    if (status.taskState !== "done") {
      return { ok: false as const, code: "inconsistentTaskStatus" as const };
    }
  } else if (status.taskState !== task.taskState) {
    return { ok: false as const, code: "inconsistentTaskStatus" as const };
  }

  return { ok: true as const, status };
}

async function findDoneWorkflowStatus(ctx: MutationCtx, task: DataModel["tasks"]["document"]) {
  const statuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", task.workflowId))
    .collect();

  return [...statuses]
    .filter((status) => status.archivedAt === null && status.taskState === "done")
    .sort((left, right) => left.sortOrder - right.sortOrder)[0];
}

async function transitionTasks(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly taskIds: ReadonlyArray<string>;
    readonly transition: "complete" | "cancel" | "reopen";
    readonly actorId: string | null;
    readonly occurredAt: string;
  },
) {
  const updates: Array<() => Promise<void>> = [];

  for (const taskId of args.taskIds) {
    const task = await readTransitionTask(ctx, args.churchId, taskId);
    if (!task) return { ok: false as const, code: "taskNotFound" as TransitionCode };

    const validated = await validateTaskStatus(ctx, task);
    if (!validated.ok) return { ok: false as const, code: validated.code };

    if (args.transition === "complete") {
      if (task.taskState === "canceled") {
        return { ok: false as const, code: "invalidTaskTransition" as TransitionCode };
      }

      const doneStatus = await findDoneWorkflowStatus(ctx, task);
      if (!doneStatus) {
        return { ok: false as const, code: "doneWorkflowStatusNotFound" as TransitionCode };
      }

      updates.push(async () => {
        await ctx.db.patch(task._id, {
          workflowStatusId: doneStatus._id,
          taskState: "done",
          finishedAt: args.occurredAt,
        });
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.completed",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata: {
            previousTaskState: task.taskState as RestorableTaskState,
            previousWorkflowStatusId: validated.status._id,
            previousWorkflowStatusName: validated.status.name,
            workflowStatusId: doneStatus._id,
            workflowStatusName: doneStatus.name,
          },
        });
      });
    }

    if (args.transition === "cancel") {
      if (task.taskState === "canceled") {
        return { ok: false as const, code: "invalidTaskTransition" as TransitionCode };
      }

      const doneStatus = await findDoneWorkflowStatus(ctx, task);
      if (!doneStatus) {
        return { ok: false as const, code: "doneWorkflowStatusNotFound" as TransitionCode };
      }

      updates.push(async () => {
        await ctx.db.patch(task._id, {
          workflowStatusId: doneStatus._id,
          taskState: "canceled",
          finishedAt: args.occurredAt,
        });
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.canceled",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata: {
            previousTaskState: task.taskState as RestorableTaskState,
            previousWorkflowStatusId: validated.status._id,
            previousWorkflowStatusName: validated.status.name,
          },
        });
      });
    }

    if (args.transition === "reopen") {
      if (task.taskState !== "canceled") {
        return { ok: false as const, code: "invalidTaskTransition" as TransitionCode };
      }

      const activities = await ctx.db
        .query("activities")
        .withIndex("by_churchId_and_entity", (q) =>
          q.eq("churchId", args.churchId).eq("entityType", "task").eq("entityId", task._id),
        )
        .collect();
      const cancelActivity = [...activities]
        .reverse()
        .find((activity) => activity.eventType === "task.canceled");

      if (!cancelActivity) {
        return { ok: false as const, code: "restoreActivityNotFound" as TransitionCode };
      }

      const metadata = cancelActivity.metadata as {
        readonly previousTaskState?: RestorableTaskState;
        readonly previousWorkflowStatusId?: string;
      };
      const restoredStatus = metadata.previousWorkflowStatusId
        ? await ctx.db.get(metadata.previousWorkflowStatusId as Id<"workflowStatuses">)
        : null;

      if (
        !restoredStatus ||
        restoredStatus.churchId !== args.churchId ||
        restoredStatus.workflowId !== task.workflowId ||
        restoredStatus.archivedAt !== null ||
        !metadata.previousTaskState ||
        restoredStatus.taskState !== metadata.previousTaskState
      ) {
        return { ok: false as const, code: "restoreWorkflowStatusNotFound" as TransitionCode };
      }

      updates.push(async () => {
        await ctx.db.patch(task._id, {
          workflowStatusId: restoredStatus._id,
          taskState: metadata.previousTaskState!,
          finishedAt: null,
        });
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.reopened",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata: {
            restoredTaskState: metadata.previousTaskState!,
            restoredWorkflowStatusId: restoredStatus._id,
            cancelActivityId: cancelActivity._id,
          },
        });
      });
    }
  }

  for (const update of updates) await update();

  return { ok: true as const };
}

export const completeTasks = (
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly taskIds: ReadonlyArray<string>;
    readonly actorId?: string | null;
  },
) =>
  transitionTasks(ctx, {
    ...args,
    transition: "complete",
    actorId: args.actorId ?? null,
    occurredAt: new Date().toISOString(),
  });

export const cancelTasks = (
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly taskIds: ReadonlyArray<string>;
    readonly actorId: string | null;
  },
) =>
  transitionTasks(ctx, {
    ...args,
    transition: "cancel",
    occurredAt: new Date().toISOString(),
  });

export const reopenTasks = (
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly taskIds: ReadonlyArray<string>;
    readonly actorId: string | null;
  },
) =>
  transitionTasks(ctx, {
    ...args,
    transition: "reopen",
    occurredAt: new Date().toISOString(),
  });
