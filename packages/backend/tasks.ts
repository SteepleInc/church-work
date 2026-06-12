import {
  formatTaskIdentifier,
  type RestorableTaskStatus,
  type TaskStatus,
} from "@church-task/domain/Task";
import { deriveTeamIdentifierBase } from "@church-task/domain/Team";
import type { GenericDatabaseReader, GenericMutationCtx, GenericQueryCtx } from "convex/server";

import { buildCycleForLocalDate } from "./churchCycleCalendar";
import { components } from "./convex/_generated/api";
import type { DataModel, Id } from "./convex/_generated/dataModel";
import { writeActivity } from "./activityRegistry";

type MutationCtx = GenericMutationCtx<DataModel>;

type TaskReadCtx = {
  readonly db: GenericDatabaseReader<DataModel>;
  readonly runQuery: GenericQueryCtx<DataModel>["runQuery"];
};

type TeamIdentifierSourceTeam = {
  readonly _id: string;
  readonly name: string;
  readonly identifier?: string | null;
  readonly nextTaskNumber?: number | null;
};

// Teams created outside the app's create paths may lack a stored identifier;
// fall back to the same name-derived base the create path would have used
// (mirrors `currentTeamIdentifier` in confect/app.impl.ts).
const teamIdentifierOf = (team: TeamIdentifierSourceTeam) =>
  team.identifier ?? deriveTeamIdentifierBase(team.name);

/**
 * Current Team Identifier per team id for a Church, used to compute Task
 * Identifiers (`team identifier + task number`, ADR 0013) at read time.
 */
async function readTeamIdentifiers(ctx: TaskReadCtx, churchId: string) {
  const teams = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "team",
    where: [{ field: "organizationId", value: churchId }],
    paginationOpts: { cursor: null, numItems: 100 },
  })) as { readonly page: ReadonlyArray<TeamIdentifierSourceTeam> };

  return Object.fromEntries(teams.page.map((team) => [team._id, teamIdentifierOf(team)]));
}

/**
 * Draws per-Team Task numbers (ADR 0013) from the `nextTaskNumber` counter on
 * the team document. Caches the counter per team so batch creates only read
 * each team once; every draw persists the bumped counter, and Convex
 * serializable transactions keep concurrent draws safe.
 */
export function makeTaskNumberDrawer(ctx: MutationCtx) {
  const nextNumberByTeam = new Map<string, number>();

  return async (teamId: string): Promise<number> => {
    let nextNumber = nextNumberByTeam.get(teamId);
    if (nextNumber === undefined) {
      const team = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "team",
        where: [{ field: "_id", value: teamId }],
      })) as TeamIdentifierSourceTeam | null;
      nextNumber = team?.nextTaskNumber ?? 1;
    }

    nextNumberByTeam.set(teamId, nextNumber + 1);
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "team",
        where: [{ field: "_id", value: teamId }],
        update: { nextTaskNumber: nextNumber + 1 },
      },
    });

    return nextNumber;
  };
}

/**
 * Appends Board Order keys (ADR 0012) to the end of a Workflow Status column.
 * Caches the last key per column so batch creates only read each column once
 * and successive appends in the same batch stay ordered.
 */
export function makeBoardOrderAppender(ctx: MutationCtx) {
  const lastKeyByStatus = new Map<string, string | null>();

  return async (workflowStatusId: string): Promise<string> => {
    let lastKey = lastKeyByStatus.get(workflowStatusId);
    if (lastKey === undefined) {
      const columnTasks = await ctx.db
        .query("tasks")
        .withIndex("by_workflowStatusId", (q) => q.eq("workflowStatusId", workflowStatusId))
        .collect();
      lastKey = columnTasks.reduce<string | null>(
        (max, task) => (max === null || task.boardOrder > max ? task.boardOrder : max),
        null,
      );
    }

    const nextKey = generateAppendBoardOrderKey(lastKey);
    lastKeyByStatus.set(workflowStatusId, nextKey);
    return nextKey;
  };
}

function generateAppendBoardOrderKey(lastKey: string | null): string {
  if (lastKey === null) return "a1";
  const prefix = lastKey.match(/^[a-zA-Z]+/)?.[0] ?? "a";
  const parsed = Number.parseFloat(
    lastKey.startsWith(prefix) ? lastKey.slice(prefix.length) : lastKey,
  );
  return `${prefix}${Number.isFinite(parsed) ? parsed + 1 : 1}`;
}

type TaskCreateInput = {
  readonly title: string;
  // Every Task belongs to exactly one Team (ADR 0013).
  readonly teamId: string;
  readonly assignedUserId?: string | null;
  readonly createdByUserId?: string | null;
  readonly workflowStatusId: string;
  readonly dueDate: string;
  readonly parentTaskId: string | null;
};

type TaskUpdateInput = {
  readonly taskId: string;
  readonly fields: {
    readonly title?: string;
    readonly assignedUserId?: string | null;
    readonly teamId?: string;
    readonly workflowStatusId?: string;
    readonly dueDate?: string;
    readonly cycleId?: string;
    readonly parentTaskId?: string | null;
    readonly boardOrder?: string;
  };
};

type TeamWorkflowResolution = {
  readonly teamWorkflowIds: Readonly<Record<string, string>>;
};

type TaskState = TaskStatus;
type RestorableTaskState = RestorableTaskStatus;
type TransitionCode =
  | "taskNotFound"
  | "invalidTaskTransition"
  | "inconsistentTaskStatus"
  | "doneWorkflowStatusNotFound"
  | "restoreActivityNotFound"
  | "restoreWorkflowStatusNotFound";

function addDays(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number) as [number, number, number];
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / 86_400_000);
}

export async function readTaskModel(
  ctx: TaskReadCtx,
  churchId: string,
  filters: {
    readonly surface?: "my_work" | "our_work";
    readonly cycleId?: string;
    readonly currentUserId?: string;
    readonly taskId?: string;
    readonly teamId?: string;
    readonly assignedUserId?: string | null;
    readonly createdByUserId?: string;
    readonly workflowStatusId?: string;
    readonly taskState?: TaskState;
    readonly taskStates?: ReadonlyArray<TaskState>;
    readonly excludeSubtasks?: boolean;
    readonly orderBy?: "created" | "due_date";
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
    if (filters.taskId && task._id !== filters.taskId) return false;

    if (filters.surface === "my_work" && task.assignedUserId !== filters.currentUserId) {
      return false;
    }

    if (filters.teamId !== undefined && task.teamId !== filters.teamId) return false;
    if ("assignedUserId" in filters && (task.assignedUserId ?? null) !== filters.assignedUserId) {
      return false;
    }
    if (filters.createdByUserId && (task.createdByUserId ?? null) !== filters.createdByUserId) {
      return false;
    }
    if (filters.workflowStatusId && task.workflowStatusId !== filters.workflowStatusId)
      return false;
    if (filters.taskState && task.taskState !== filters.taskState) return false;
    if (filters.taskStates && !filters.taskStates.includes(task.taskState)) return false;
    if (filters.excludeSubtasks && task.parentTaskId !== null) return false;

    if (!executionCycle) return true;

    return (
      task.dueDate <= executionCycle.endDate &&
      (task.finishedAt === null || task.finishedAt >= executionCycle.startsAt)
    );
  });
  const orderedTasks =
    filters.orderBy === "due_date"
      ? [...tasks].sort(
          (left, right) =>
            left.dueDate.localeCompare(right.dueDate) || left._creationTime - right._creationTime,
        )
      : tasks;
  const teamIdentifierById = await readTeamIdentifiers(ctx, churchId);

  return { cycles, tasks: orderedTasks, teamIdentifierById };
}

export const serializeTaskModel = (data: Awaited<ReturnType<typeof readTaskModel>>) => ({
  cycles: data.cycles.map((cycle) => ({
    id: cycle._id,
    churchId: cycle.churchId,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    startsAt: cycle.startsAt,
    endsAt: cycle.endsAt,
    churchTimeZone: cycle.churchTimeZone,
  })),
  tasks: data.tasks.map((task) => ({
    id: task._id,
    churchId: task.churchId,
    title: task.title,
    teamId: task.teamId,
    number: task.number,
    // Computed at read time so a Team Identifier change re-renders every
    // Task Identifier in that Team (ADR 0013).
    identifier: formatTaskIdentifier(data.teamIdentifierById[task.teamId] ?? "TEAM", task.number),
    assignedUserId: task.assignedUserId ?? null,
    cycleId: task.cycleId,
    dueDate: task.dueDate,
    createdAt: task._creationTime,
    createdByUserId: task.createdByUserId ?? null,
    parentTaskId: task.parentTaskId,
    workflowId: task.workflowId,
    workflowStatusId: task.workflowStatusId,
    taskState: task.taskState,
    boardOrder: task.boardOrder,
    finishedAt: task.finishedAt ?? null,
    sourceTemplateId: task.sourceTemplateId ?? null,
    sourceTemplateTaskId: task.sourceTemplateTaskId ?? null,
    sourceTemplateCycleId: task.sourceTemplateCycleId ?? null,
    sourceTemplateSyncEnabled: task.sourceTemplateSyncEnabled ?? false,
  })),
});

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

  const appendBoardOrder = makeBoardOrderAppender(ctx);
  const drawTaskNumber = makeTaskNumberDrawer(ctx);

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
      number: await drawTaskNumber(task.teamId),
      assignedUserId: task.assignedUserId ?? null,
      createdByUserId: task.createdByUserId ?? null,
      cycleId,
      dueDate: task.dueDate,
      parentTaskId: task.parentTaskId,
      workflowId,
      workflowStatusId,
      taskState,
      boardOrder: await appendBoardOrder(workflowStatusId),
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
    readonly churchTimeZone: string;
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
      "parentTaskId" in update.fields &&
      (update.fields.parentTaskId ?? null) !== task.parentTaskId
    ) {
      const parentTaskId = update.fields.parentTaskId ?? null;
      if (parentTaskId !== null) {
        const parentTask = await ctx.db.get(parentTaskId as Id<"tasks">);
        if (!parentTask || parentTask.churchId !== args.churchId) {
          return { ok: false as const, code: "parentTaskNotFound" as const };
        }
      }

      patch.parentTaskId = parentTaskId;
      updatedFields.push("parentTaskId");
    }

    let movedDueDate: {
      readonly previousDueDate: string;
      readonly dueDate: string;
      readonly previousCycleId: string;
      readonly cycleId: Id<"cycles">;
    } | null = null;
    let movedCycle: {
      readonly previousCycleId: string;
      readonly cycleId: Id<"cycles">;
      readonly previousDueDate: string;
      readonly dueDate: string;
    } | null = null;

    const requestedDueDate = update.fields.dueDate;
    if (requestedDueDate !== undefined && requestedDueDate !== task.dueDate) {
      try {
        buildCycleForLocalDate({
          localDate: requestedDueDate,
          churchTimeZone: args.churchTimeZone,
        });
      } catch {
        return { ok: false as const, code: "invalidDueDate" as const };
      }

      const cycleId = await ensureCycleForDueDate(ctx, {
        churchId: args.churchId,
        dueDate: requestedDueDate,
        churchTimeZone: args.churchTimeZone,
      });

      patch.dueDate = requestedDueDate;
      patch.cycleId = cycleId;
      updatedFields.push("dueDate");
      movedDueDate = {
        previousDueDate: task.dueDate,
        dueDate: requestedDueDate,
        previousCycleId: task.cycleId,
        cycleId,
      };
    }

    if (!movedDueDate && "cycleId" in update.fields && update.fields.cycleId !== task.cycleId) {
      const [previousCycle, targetCycle] = await Promise.all([
        ctx.db.get(task.cycleId as Id<"cycles">),
        ctx.db.get(update.fields.cycleId as Id<"cycles">),
      ]);

      if (
        !previousCycle ||
        previousCycle.churchId !== args.churchId ||
        !targetCycle ||
        targetCycle.churchId !== args.churchId
      ) {
        return { ok: false as const, code: "cycleNotFound" as const };
      }

      const weekdayOffset = daysBetween(previousCycle.startDate, task.dueDate);
      const dueDate = addDays(targetCycle.startDate, weekdayOffset);
      patch.dueDate = dueDate;
      patch.cycleId = targetCycle._id;
      updatedFields.push("cycleId");
      movedCycle = {
        previousCycleId: task.cycleId,
        cycleId: targetCycle._id,
        previousDueDate: task.dueDate,
        dueDate,
      };
    }

    if (
      "assignedUserId" in update.fields &&
      (update.fields.assignedUserId ?? null) !== task.assignedUserId
    ) {
      patch.assignedUserId = update.fields.assignedUserId ?? null;
      updatedFields.push("assignedUserId");
    }

    let remappedTeam: {
      readonly previousTeamId: string;
      readonly teamId: string;
      readonly previousWorkflowId: string;
      readonly workflowId: string;
      readonly previousWorkflowStatusId: string;
      readonly workflowStatusId: Id<"workflowStatuses">;
    } | null = null;

    if (update.fields.teamId !== undefined && update.fields.teamId !== task.teamId) {
      const teamId = update.fields.teamId;
      const workflowId = args.teamWorkflowResolution?.teamWorkflowIds[teamId];

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

    let movedStatus: {
      readonly previousTaskState: TaskState;
      readonly taskState: TaskState;
      readonly previousWorkflowStatusId: string;
      readonly previousWorkflowStatusName: string | null;
      readonly workflowStatusId: Id<"workflowStatuses">;
      readonly workflowStatusName: string | null;
    } | null = null;

    if (
      "workflowStatusId" in update.fields &&
      update.fields.workflowStatusId !== task.workflowStatusId
    ) {
      if (task.taskState === "canceled") {
        return { ok: false as const, code: "invalidTaskTransition" as const };
      }

      const [currentStatus, destinationStatus] = await Promise.all([
        ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">),
        ctx.db.get(update.fields.workflowStatusId as Id<"workflowStatuses">),
      ]);
      const effectiveWorkflowId = patch.workflowId ?? task.workflowId;

      if (
        !currentStatus ||
        currentStatus.churchId !== args.churchId ||
        currentStatus.workflowId !== task.workflowId ||
        currentStatus.archivedAt !== null ||
        !destinationStatus ||
        destinationStatus.churchId !== args.churchId ||
        destinationStatus.archivedAt !== null
      ) {
        return { ok: false as const, code: "workflowStatusNotFound" as const };
      }

      if (destinationStatus.workflowId !== effectiveWorkflowId) {
        return { ok: false as const, code: "workflowStatusNotInEffectiveWorkflow" as const };
      }

      patch.workflowStatusId = destinationStatus._id;
      patch.taskState = destinationStatus.taskState;
      if (destinationStatus.taskState === "done" && task.taskState !== "done") {
        patch.finishedAt = args.occurredAt;
      }
      if (destinationStatus.taskState !== "done" && task.taskState === "done") {
        patch.finishedAt = null;
      }
      updatedFields.push("workflowStatusId");
      movedStatus = {
        previousTaskState: task.taskState,
        taskState: destinationStatus.taskState,
        previousWorkflowStatusId: currentStatus._id,
        previousWorkflowStatusName: currentStatus.name,
        workflowStatusId: destinationStatus._id,
        workflowStatusName: destinationStatus.name,
      };
    }

    // Board Order changes are silent presentation updates: persisted, but
    // never written to the activity feed (see `nonAssignmentFields` below).
    if (
      "boardOrder" in update.fields &&
      update.fields.boardOrder !== undefined &&
      update.fields.boardOrder !== task.boardOrder
    ) {
      patch.boardOrder = update.fields.boardOrder;
      updatedFields.push("boardOrder");
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

      if (movedStatus) {
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.status_moved",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata: movedStatus,
        });
      }

      if (movedDueDate) {
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.due_date_changed",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: movedDueDate.cycleId,
          metadata: movedDueDate,
        });
      }

      if (movedCycle) {
        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.cycle_changed",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: movedCycle.cycleId,
          metadata: movedCycle,
        });
      }

      const nonAssignmentFields = updatedFields.filter(
        (field) =>
          field !== "assignedUserId" &&
          field !== "teamId" &&
          field !== "workflowStatusId" &&
          field !== "dueDate" &&
          field !== "cycleId" &&
          field !== "boardOrder",
      );
      if (nonAssignmentFields.length > 0) {
        const metadata: {
          updatedFields: Array<string>;
          previousTitle?: string;
          title?: string;
          previousParentTaskId?: string | null;
          parentTaskId?: string | null;
        } = { updatedFields: nonAssignmentFields };
        if ("title" in patch && patch.title !== undefined) {
          metadata.previousTitle = task.title;
          metadata.title = patch.title;
        }
        if ("parentTaskId" in patch) {
          metadata.previousParentTaskId = task.parentTaskId;
          metadata.parentTaskId = patch.parentTaskId ?? null;
        }

        await writeActivity(ctx, {
          churchId: args.churchId,
          entityType: "task",
          entityId: task._id,
          eventType: "task.updated",
          actorType: "user",
          actorId: args.actorId,
          occurredAt: args.occurredAt,
          cycleId: task.cycleId,
          metadata,
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
