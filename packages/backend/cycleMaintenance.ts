import type { TaskStatus } from "@church-task/domain/Task";
import type { GenericMutationCtx } from "convex/server";

import { buildCycleForInstant, buildCycleForLocalDate } from "./churchCycleCalendar";
import type { DataModel, Id } from "./convex/_generated/dataModel";
import { writeActivity } from "./activityRegistry";
import { materializeProjectedTasks } from "./templates";

type MutationCtx = GenericMutationCtx<DataModel>;
type TaskState = TaskStatus;

const unfinishedTaskStates = new Set<TaskState>(["todo", "in_progress"]);

function addDays(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayOffsetWithinCycle(cycleStartDate: string, dueDate: string) {
  const start = Date.parse(`${cycleStartDate}T00:00:00.000Z`);
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(due)) return 6;

  return Math.min(6, Math.max(0, Math.round((due - start) / 86_400_000)));
}

async function ensureCycle(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly localDate: string; readonly churchTimeZone: string },
) {
  const cycle = buildCycleForLocalDate({
    localDate: args.localDate,
    churchTimeZone: args.churchTimeZone,
  });
  const existing = await ctx.db
    .query("cycles")
    .withIndex("by_churchId_and_startDate", (q) =>
      q.eq("churchId", args.churchId).eq("startDate", cycle.startDate),
    )
    .unique();

  if (existing) return { cycle: existing, created: false as const };

  const cycleId = await ctx.db.insert("cycles", { churchId: args.churchId, ...cycle });
  const createdCycle = (await ctx.db.get(cycleId))!;

  return { cycle: createdCycle, created: true as const };
}

async function recordCycleCreatedActivity(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly cycle: DataModel["cycles"]["document"] & { readonly _id: Id<"cycles"> };
    readonly occurredAt: string;
  },
) {
  await writeActivity(ctx, {
    churchId: args.churchId,
    entityType: "cycle",
    entityId: args.cycle._id,
    eventType: "cycle.created",
    actorType: "system",
    actorId: null,
    occurredAt: args.occurredAt,
    cycleId: args.cycle._id,
    metadata: {
      startDate: args.cycle.startDate,
      endDate: args.cycle.endDate,
      churchTimeZone: args.cycle.churchTimeZone,
    },
  });
}

export async function maintainCyclesForChurch(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly churchTimeZone: string; readonly now: string },
) {
  const now = new Date(args.now);
  if (Number.isNaN(now.getTime())) {
    return { ok: false as const, code: "invalidNow" as const };
  }

  const currentCycleFields = buildCycleForInstant({
    instant: now,
    churchTimeZone: args.churchTimeZone,
  });
  const cycleLocalDates = [
    currentCycleFields.startDate,
    addDays(currentCycleFields.startDate, 7),
    addDays(currentCycleFields.startDate, 14),
  ];
  const ensuredCycleIds: Array<Id<"cycles">> = [];
  const createdCycleIds: Array<Id<"cycles">> = [];

  for (const localDate of cycleLocalDates) {
    const ensured = await ensureCycle(ctx, {
      churchId: args.churchId,
      localDate,
      churchTimeZone: args.churchTimeZone,
    });
    ensuredCycleIds.push(ensured.cycle._id);
    if (ensured.created) {
      createdCycleIds.push(ensured.cycle._id);
      await recordCycleCreatedActivity(ctx, {
        churchId: args.churchId,
        cycle: ensured.cycle,
        occurredAt: args.now,
      });
    }
  }

  const existingCycles = await ctx.db
    .query("cycles")
    .withIndex("by_churchId", (q) => q.eq("churchId", args.churchId))
    .collect();
  const closedCycles = existingCycles.filter(
    (cycle) => new Date(cycle.endsAt).getTime() <= now.getTime(),
  );
  const rolledOverTaskIds: Array<Id<"tasks">> = [];

  for (const cycle of closedCycles) {
    const toCycle = await ensureCycle(ctx, {
      churchId: args.churchId,
      localDate: addDays(cycle.startDate, 7),
      churchTimeZone: cycle.churchTimeZone,
    });
    if (toCycle.created) {
      createdCycleIds.push(toCycle.cycle._id);
      await recordCycleCreatedActivity(ctx, {
        churchId: args.churchId,
        cycle: toCycle.cycle,
        occurredAt: args.now,
      });
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_churchId_and_cycleId", (q) =>
        q.eq("churchId", args.churchId).eq("cycleId", cycle._id),
      )
      .collect();

    for (const task of tasks) {
      if (!unfinishedTaskStates.has(task.taskState)) continue;

      const previousStatus = await ctx.db.get(task.workflowStatusId as Id<"workflowStatuses">);
      // Tasks without a Due Date roll over without gaining one.
      const nextDueDate =
        task.dueDate === null
          ? null
          : addDays(toCycle.cycle.startDate, dayOffsetWithinCycle(cycle.startDate, task.dueDate));

      await ctx.db.patch(task._id, {
        cycleId: toCycle.cycle._id,
        dueDate: nextDueDate,
        sourceTemplateSyncEnabled: false,
      });
      await writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "task",
        entityId: task._id,
        eventType: "task.rolled_over",
        actorType: "system",
        actorId: null,
        occurredAt: args.now,
        cycleId: toCycle.cycle._id,
        metadata: {
          fromCycleId: cycle._id,
          toCycleId: toCycle.cycle._id,
          previousTaskState: task.taskState as "todo" | "in_progress",
          previousWorkflowStatusId: task.workflowStatusId,
          previousWorkflowStatusName: previousStatus?.name ?? null,
        },
      });
      rolledOverTaskIds.push(task._id);
    }
  }

  const materialized = await materializeProjectedTasks(ctx, {
    churchId: args.churchId,
    churchTimeZone: args.churchTimeZone,
    occurrenceCycleIds: ensuredCycleIds,
  });
  if (!materialized.ok) return materialized;

  for (const taskId of materialized.createdTaskIds) {
    const task = await ctx.db.get(taskId);
    if (!task) continue;
    await writeActivity(ctx, {
      churchId: args.churchId,
      entityType: "task",
      entityId: task._id,
      eventType: "task.created",
      actorType: "system",
      actorId: null,
      occurredAt: args.now,
      cycleId: task.cycleId,
      metadata: { parentTaskId: task.parentTaskId },
    });
  }

  return {
    ok: true as const,
    ensuredCycleIds,
    createdCycleIds,
    rolledOverTaskIds,
    materializedTaskIds: materialized.createdTaskIds,
  };
}

export function currentMaintenanceInstant() {
  return new Date().toISOString();
}
