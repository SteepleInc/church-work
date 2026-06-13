import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { writeActivity } from "./activityRegistry";
import { buildCycleForLocalDate, cycleStartDateForLocalDate } from "./churchCycleCalendar";
import { components } from "./convex/_generated/api";
import type { DataModel, Id } from "./convex/_generated/dataModel";
import { resolveKeyDateOccurrences } from "./keyDateScheduling";
import { makeBoardOrderAppender, makeTaskNumberDrawer } from "./tasks";
import { getTeamWorkflow } from "./workflows";
import {
  type CycleAdjustmentOverride,
  mergeTemplateTaskProjection,
  validateCycleAdjustmentOverrides,
} from "./templateProjection";

type MutationCtx = GenericMutationCtx<DataModel>;
type ReaderCtx = { readonly db: GenericDatabaseReader<DataModel> };

type TemplateRecurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

type SchedulingRule =
  | { readonly kind: "fixedDate"; readonly localDate: string }
  | {
      readonly kind: "relativeToFocusWindow";
      readonly focusWindowId: string;
      readonly edge: "start" | "end";
      readonly offsetDays: number;
    }
  | {
      readonly kind: "relativeToAnchorDate";
      readonly focusWindowId: string;
      readonly offsetDays: number;
    }
  | {
      readonly kind: "relativeToKeyDate";
      readonly keyDateId: string;
      readonly year: number;
      readonly offsetDays: number;
    }
  | {
      readonly kind: "cycleOffset";
      readonly baseLocalDate: string;
      readonly offsetCycles: number;
      readonly dayOffset: number;
    };

type FocusWindowInput = {
  readonly key: string;
  readonly name: string;
  readonly type: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly anchorDate: string | null;
  readonly keyDateId: string | null;
};

type TemplateTaskInput = {
  readonly key: string;
  readonly title: string;
  readonly templateTeamKey: string | null;
  readonly parentTemplateTaskKey: string | null;
  readonly schedulingRule: SchedulingRule;
};

type TemplateTeamInput = {
  readonly key: string;
  readonly name: string;
  readonly mappedTeamId: string;
};

type TemplateTeamRemovalRepair =
  | {
      readonly templateTeamId: string;
      readonly action: "remap";
      readonly mappedTeamId: string;
    }
  | { readonly templateTeamId: string; readonly action: "abandon" };

type TemplateInput = {
  readonly key: string;
  readonly name: string;
  readonly recurrence: TemplateRecurrence;
  readonly templateTeams: ReadonlyArray<TemplateTeamInput>;
  readonly focusWindows: ReadonlyArray<FocusWindowInput>;
  readonly templateTasks: ReadonlyArray<TemplateTaskInput>;
};

type CycleAdjustmentInput = {
  readonly cycleId: string;
  readonly templateTaskId: string;
  readonly lifecycle: "active" | "skipped";
  readonly overrides: ReadonlyArray<CycleAdjustmentOverride>;
};

type TemplateTaskUpdateInput = {
  readonly templateTaskId: string;
  readonly title: string;
  readonly schedulingRule: SchedulingRule;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(localDate: string) {
  if (!isoDatePattern.test(localDate)) {
    throw new Error("Local date must use YYYY-MM-DD format.");
  }

  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const asUtcDate = new Date(Date.UTC(year, month - 1, day));
  if (asUtcDate.toISOString().slice(0, 10) !== localDate) {
    throw new Error("Local date must be a real calendar date.");
  }

  return { year, month, day };
}

function addDays(localDate: string, days: number) {
  const { year, month, day } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function assertWholeNumber(value: number, field: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be a whole number.`);
  }
}

function validateSchedulingRule(rule: SchedulingRule) {
  if (rule.kind === "fixedDate") {
    parseLocalDate(rule.localDate);
    return;
  }

  if (rule.kind === "cycleOffset") {
    parseLocalDate(rule.baseLocalDate);
    assertWholeNumber(rule.offsetCycles, "offsetCycles");
    assertWholeNumber(rule.dayOffset, "dayOffset");
    if (rule.dayOffset < 0 || rule.dayOffset > 6) {
      throw new Error("dayOffset must stay within one Monday-to-Sunday Cycle.");
    }
    return;
  }

  assertWholeNumber(rule.offsetDays, "offsetDays");
}

function assertUniqueKeys(items: ReadonlyArray<{ readonly key: string }>) {
  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) throw new Error("Keys must be unique.");
    keys.add(item.key);
  }
}

function validateTemplateInput(template: TemplateInput) {
  assertUniqueKeys(template.templateTeams);
  assertUniqueKeys(template.focusWindows);
  assertUniqueKeys(template.templateTasks);

  if (template.templateTeams.length === 0) {
    throw new Error("Template must define at least one Template Team.");
  }

  const templateTeamKeys = new Set(template.templateTeams.map((templateTeam) => templateTeam.key));
  const focusWindowKeys = new Set(template.focusWindows.map((focusWindow) => focusWindow.key));
  const templateTaskKeys = new Set(template.templateTasks.map((templateTask) => templateTask.key));

  for (const focusWindow of template.focusWindows) {
    parseLocalDate(focusWindow.startDate);
    if (focusWindow.endDate) parseLocalDate(focusWindow.endDate);
    if (focusWindow.anchorDate) parseLocalDate(focusWindow.anchorDate);
  }

  for (const templateTask of template.templateTasks) {
    if (templateTask.templateTeamKey && !templateTeamKeys.has(templateTask.templateTeamKey)) {
      throw new Error("Template Team key must exist in the same Template.");
    }
    if (!templateTask.templateTeamKey && template.templateTeams.length !== 1) {
      throw new Error("Template Task must reference a Template Team when multiple slots exist.");
    }
    if (
      templateTask.parentTemplateTaskKey &&
      !templateTaskKeys.has(templateTask.parentTemplateTaskKey)
    ) {
      throw new Error("Parent Template Task key must exist in the same Template.");
    }
    if (
      (templateTask.schedulingRule.kind === "relativeToFocusWindow" ||
        templateTask.schedulingRule.kind === "relativeToAnchorDate") &&
      !focusWindowKeys.has(templateTask.schedulingRule.focusWindowId)
    ) {
      throw new Error("Focus Window key must exist in the same Template.");
    }
    validateSchedulingRule(templateTask.schedulingRule);
  }
}

export async function readTemplateModel(ctx: ReaderCtx, churchId: string) {
  const templates = await ctx.db
    .query("templates")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const focusWindows = await ctx.db
    .query("focusWindows")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const templateTeams = await ctx.db
    .query("templateTeams")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const templateTasks = await ctx.db
    .query("templateTasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const cycleAdjustments = await ctx.db
    .query("cycleAdjustments")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();

  return { templates, templateTeams, focusWindows, templateTasks, cycleAdjustments };
}

export async function setCycleAdjustments(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly adjustments: ReadonlyArray<CycleAdjustmentInput> },
) {
  for (const adjustment of args.adjustments) {
    const cycle = await ctx.db.get(adjustment.cycleId as Id<"cycles">);
    if (!cycle || cycle.churchId !== args.churchId) {
      return { ok: false as const, code: "cycleNotFound" as const };
    }

    const templateTask = await ctx.db.get(adjustment.templateTaskId as Id<"templateTasks">);
    if (!templateTask || templateTask.churchId !== args.churchId) {
      return { ok: false as const, code: "templateTaskNotFound" as const };
    }

    try {
      validateCycleAdjustmentOverrides(adjustment.overrides);
    } catch {
      return { ok: false as const, code: "invalidAdjustment" as const };
    }
  }

  for (const adjustment of args.adjustments) {
    const existing = await ctx.db
      .query("cycleAdjustments")
      .withIndex("by_churchId_and_cycleId_and_templateTaskId", (q) =>
        q
          .eq("churchId", args.churchId)
          .eq("cycleId", adjustment.cycleId)
          .eq("templateTaskId", adjustment.templateTaskId),
      )
      .unique();

    const document = {
      churchId: args.churchId,
      cycleId: adjustment.cycleId,
      templateTaskId: adjustment.templateTaskId,
      lifecycle: adjustment.lifecycle,
      overrides: [...validateCycleAdjustmentOverrides(adjustment.overrides)],
    };

    if (existing) {
      await ctx.db.patch(existing._id, document);
    } else {
      await ctx.db.insert("cycleAdjustments", document);
    }
  }

  return { ok: true as const };
}

export async function previewCycleAdjustmentMerge(
  ctx: ReaderCtx,
  args: {
    readonly churchId: string;
    readonly projections: ReadonlyArray<{
      readonly cycleId: string;
      readonly templateTaskId: string;
      readonly dueDate: string;
    }>;
  },
) {
  const mergedProjectedTasks = [];

  for (const projection of args.projections) {
    const cycle = await ctx.db.get(projection.cycleId as Id<"cycles">);
    const templateTask = await ctx.db.get(projection.templateTaskId as Id<"templateTasks">);

    if (!cycle || cycle.churchId !== args.churchId) {
      return { ok: false as const, code: "cycleNotFound" as const };
    }
    if (!templateTask || templateTask.churchId !== args.churchId) {
      return { ok: false as const, code: "templateTaskNotFound" as const };
    }

    const adjustment = await ctx.db
      .query("cycleAdjustments")
      .withIndex("by_churchId_and_cycleId_and_templateTaskId", (q) =>
        q
          .eq("churchId", args.churchId)
          .eq("cycleId", projection.cycleId)
          .eq("templateTaskId", projection.templateTaskId),
      )
      .unique();
    const merged = mergeTemplateTaskProjection(
      {
        templateTaskId: templateTask._id,
        templateTaskKey: templateTask.key,
        title: templateTask.title,
        dueDate: projection.dueDate,
        parentTemplateTaskId: templateTask.parentTemplateTaskId,
      },
      adjustment ? { lifecycle: adjustment.lifecycle, overrides: adjustment.overrides } : null,
    );

    mergedProjectedTasks.push({
      cycleId: projection.cycleId,
      templateTaskId: projection.templateTaskId,
      ...merged,
    });
  }

  return { ok: true as const, mergedProjectedTasks };
}

async function ensureCycleForProjection(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly dueDate: string;
    readonly churchTimeZone: string;
  },
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

async function findTodoWorkflowStatus(ctx: MutationCtx, workflowId: string) {
  const statuses = await ctx.db
    .query("workflowStatuses")
    .withIndex("by_workflowId", (q) => q.eq("workflowId", workflowId))
    .collect();

  return (
    [...statuses]
      .filter((status) => status.archivedAt === null && status.taskState === "todo")
      .sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null
  );
}

type BetterAuthTemplateTeam = {
  readonly _id: string;
  readonly organizationId?: string | null;
  readonly archivedAt?: string | null;
};

async function findMappedTeam(ctx: MutationCtx, teamId: string) {
  return (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "team",
    where: [{ field: "_id", value: teamId }],
  })) as BetterAuthTemplateTeam | null;
}

async function ensureMappedTeam(ctx: MutationCtx, churchId: string, teamId: string) {
  const team = await findMappedTeam(ctx, teamId);
  return team?.organizationId === churchId && (team.archivedAt ?? null) === null ? team : null;
}

export async function materializeProjectedTasks(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly churchTimeZone: string;
    readonly occurrenceCycleIds: ReadonlyArray<string>;
  },
) {
  const schedules = await resolveTemplateTaskSchedules(ctx, args);
  const requestedCycleIds = new Set(args.occurrenceCycleIds);
  const materializedByTemplateTaskId = new Map<string, Id<"tasks">>();
  const pendingParentLinks: Array<{
    readonly taskId: Id<"tasks">;
    readonly parentTemplateTaskId: string;
  }> = [];
  const taskIds: Array<Id<"tasks">> = [];
  const createdTaskIds: Array<Id<"tasks">> = [];
  const appendBoardOrder = makeBoardOrderAppender(ctx);
  // Projected Tasks draw numbers from the owning Team's sequence at
  // projection time (ADR 0013).
  const drawTaskNumber = makeTaskNumberDrawer(ctx);
  const projectionDestinations = new Map<
    string,
    {
      readonly teamId: string;
      readonly todoStatus: DataModel["workflowStatuses"]["document"];
    }
  >();

  for (const schedule of schedules) {
    const templateTask = await ctx.db.get(schedule.templateTaskId as Id<"templateTasks">);
    if (
      !templateTask ||
      templateTask.churchId !== args.churchId ||
      templateTask.archivedAt !== null
    ) {
      return { ok: false as const, code: "templateTaskNotFound" as const };
    }
    const templateTeam = await ctx.db.get(templateTask.templateTeamId as Id<"templateTeams">);
    if (
      !templateTeam ||
      templateTeam.churchId !== args.churchId ||
      templateTeam.archivedAt !== null
    ) {
      return { ok: false as const, code: "teamNotFound" as const };
    }

    let destination = projectionDestinations.get(templateTeam._id);
    if (!destination) {
      const mappedTeam = await ensureMappedTeam(ctx, args.churchId, templateTeam.mappedTeamId);
      if (!mappedTeam) return { ok: false as const, code: "teamNotFound" as const };
      const workflow = await getTeamWorkflow(ctx, {
        churchId: args.churchId,
        teamId: mappedTeam._id,
      });
      const todoStatus = workflow ? await findTodoWorkflowStatus(ctx, workflow._id) : null;
      if (!todoStatus) return { ok: false as const, code: "workflowStatusNotFound" as const };
      destination = { teamId: mappedTeam._id, todoStatus };
      projectionDestinations.set(templateTeam._id, destination);
    }

    const occurrenceCycleId = await ensureCycleForProjection(ctx, {
      churchId: args.churchId,
      dueDate: schedule.dueDate,
      churchTimeZone: args.churchTimeZone,
    });
    if (requestedCycleIds.size > 0 && !requestedCycleIds.has(occurrenceCycleId)) continue;

    const adjustment = await ctx.db
      .query("cycleAdjustments")
      .withIndex("by_churchId_and_cycleId_and_templateTaskId", (q) =>
        q
          .eq("churchId", args.churchId)
          .eq("cycleId", occurrenceCycleId)
          .eq("templateTaskId", templateTask._id),
      )
      .unique();
    const merged = mergeTemplateTaskProjection(
      {
        templateTaskId: templateTask._id,
        templateTaskKey: templateTask.key,
        title: templateTask.title,
        dueDate: schedule.dueDate,
        parentTemplateTaskId: templateTask.parentTemplateTaskId,
      },
      adjustment ? { lifecycle: adjustment.lifecycle, overrides: adjustment.overrides } : null,
    );

    if (merged.skipped || !merged.effectiveTask) continue;

    const taskCycleId = await ensureCycleForProjection(ctx, {
      churchId: args.churchId,
      dueDate: merged.effectiveTask.dueDate,
      churchTimeZone: args.churchTimeZone,
    });
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_churchId_and_sourceTemplateTaskId_and_sourceTemplateCycleId", (q) =>
        q
          .eq("churchId", args.churchId)
          .eq("sourceTemplateTaskId", templateTask._id)
          .eq("sourceTemplateCycleId", occurrenceCycleId),
      )
      .unique();

    const taskId = existing?._id;
    const materializedTaskId =
      taskId ??
      (await ctx.db.insert("tasks", {
        churchId: args.churchId,
        title: merged.effectiveTask.title,
        teamId: destination.teamId,
        number: await drawTaskNumber(destination.teamId),
        previousIdentifiers: [],
        assignedUserId: null,
        // Template projection is system-created work, not user-created.
        createdByUserId: null,
        cycleId: taskCycleId,
        dueDate: merged.effectiveTask.dueDate,
        parentTaskId: null,
        workflowId: destination.todoStatus.workflowId,
        workflowStatusId: destination.todoStatus._id,
        taskState: "todo",
        boardOrder: await appendBoardOrder(destination.todoStatus._id),
        finishedAt: null,
        sourceTemplateId: templateTask.templateId,
        sourceTemplateTaskId: templateTask._id,
        sourceTemplateCycleId: occurrenceCycleId,
        sourceTemplateSyncEnabled: true,
      }));
    if (!taskId) createdTaskIds.push(materializedTaskId);

    materializedByTemplateTaskId.set(templateTask._id, materializedTaskId);
    taskIds.push(materializedTaskId);
    if (merged.effectiveTask.parentTemplateTaskId) {
      pendingParentLinks.push({
        taskId: materializedTaskId,
        parentTemplateTaskId: merged.effectiveTask.parentTemplateTaskId,
      });
    }
  }

  for (const link of pendingParentLinks) {
    await ctx.db.patch(link.taskId, {
      parentTaskId: materializedByTemplateTaskId.get(link.parentTemplateTaskId) ?? null,
    });
  }

  return { ok: true as const, taskIds, createdTaskIds };
}

export async function repairTemplateTeamsForTeamRemoval(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly teamId: string;
    readonly repairs: ReadonlyArray<TemplateTeamRemovalRepair>;
    readonly now: string;
  },
) {
  const affectedTemplateTeams = await ctx.db
    .query("templateTeams")
    .withIndex("by_churchId_and_mappedTeamId", (q) =>
      q.eq("churchId", args.churchId).eq("mappedTeamId", args.teamId),
    )
    .filter((q) => q.eq(q.field("archivedAt"), null))
    .collect();

  if (affectedTemplateTeams.length === 0) {
    return { ok: true as const, repairedTemplateTeamIds: [] as Array<Id<"templateTeams">> };
  }

  const affectedIds = new Set(affectedTemplateTeams.map((templateTeam) => templateTeam._id));
  const repairIds = new Set(args.repairs.map((repair) => repair.templateTeamId));
  if (repairIds.size !== args.repairs.length || repairIds.size !== affectedIds.size) {
    return { ok: false as const, code: "templateTeamRepairRequired" as const };
  }

  for (const repair of args.repairs) {
    if (!affectedIds.has(repair.templateTeamId as Id<"templateTeams">)) {
      return { ok: false as const, code: "templateTeamRepairRequired" as const };
    }
    if (repair.action === "remap") {
      if (repair.mappedTeamId === args.teamId) {
        return { ok: false as const, code: "teamNotFound" as const };
      }
      const mappedTeam = await ensureMappedTeam(ctx, args.churchId, repair.mappedTeamId);
      if (!mappedTeam) return { ok: false as const, code: "teamNotFound" as const };
    }
  }

  const repairedTemplateTeamIds: Array<Id<"templateTeams">> = [];
  for (const repair of args.repairs) {
    const templateTeamId = repair.templateTeamId as Id<"templateTeams">;
    if (repair.action === "remap") {
      await ctx.db.patch(templateTeamId, { mappedTeamId: repair.mappedTeamId });
    } else {
      await ctx.db.patch(templateTeamId, { archivedAt: args.now });
      const templateTasks = await ctx.db
        .query("templateTasks")
        .withIndex("by_templateTeamId", (q) => q.eq("templateTeamId", templateTeamId))
        .collect();
      for (const templateTask of templateTasks) {
        if (templateTask.archivedAt === null) {
          await ctx.db.patch(templateTask._id, { archivedAt: args.now });
        }
      }
    }
    repairedTemplateTeamIds.push(templateTeamId);
  }

  return { ok: true as const, repairedTemplateTeamIds };
}

function overrideFields(overrides: ReadonlyArray<CycleAdjustmentOverride>) {
  return new Set(overrides.map((override) => override.field));
}

function changedFields(
  task: DataModel["tasks"]["document"],
  next: { readonly title: string; readonly dueDate: string; readonly parentTaskId: string | null },
) {
  const fields = [];
  if (task.title !== next.title) fields.push("title");
  if (task.dueDate !== next.dueDate) fields.push("dueDate");
  if (task.parentTaskId !== next.parentTaskId) fields.push("parentTaskId");
  return fields;
}

export async function updateTemplateTasksAndSyncFutureProjectedTasks(
  ctx: MutationCtx,
  args: {
    readonly churchId: string;
    readonly churchTimeZone: string;
    readonly templateTasks: ReadonlyArray<TemplateTaskUpdateInput>;
    readonly now: string;
    readonly actorId: string | null;
  },
) {
  const templateTaskIds = args.templateTasks.map((templateTask) => templateTask.templateTaskId);
  const templateIds = new Set<string>();

  for (const update of args.templateTasks) {
    validateSchedulingRule(update.schedulingRule);
    const templateTask = await ctx.db.get(update.templateTaskId as Id<"templateTasks">);
    if (!templateTask || templateTask.churchId !== args.churchId) {
      return { ok: false as const, code: "templateTaskNotFound" as const };
    }
    const template = await ctx.db.get(templateTask.templateId as Id<"templates">);
    if (!template || template.churchId !== args.churchId || template.archivedAt !== null) {
      return { ok: false as const, code: "templateNotFound" as const };
    }
    templateIds.add(template._id);
  }

  for (const update of args.templateTasks) {
    await ctx.db.patch(update.templateTaskId as Id<"templateTasks">, {
      title: update.title,
      schedulingRule: update.schedulingRule,
    });
  }

  const schedules = await resolveTemplateTaskSchedules(ctx, {
    churchId: args.churchId,
    churchTimeZone: args.churchTimeZone,
  });
  const schedulesByTemplateTaskId = new Map<string, (typeof schedules)[number]>(
    schedules.map((schedule) => [String(schedule.templateTaskId), schedule]),
  );
  const syncedTaskIds: Array<Id<"tasks">> = [];

  for (const update of args.templateTasks) {
    const templateTask = await ctx.db.get(update.templateTaskId as Id<"templateTasks">);
    const schedule = schedulesByTemplateTaskId.get(update.templateTaskId);
    if (!templateTask || !schedule) continue;

    const projectedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_churchId_and_sourceTemplateTaskId", (q) =>
        q.eq("churchId", args.churchId).eq("sourceTemplateTaskId", update.templateTaskId),
      )
      .collect();

    for (const task of projectedTasks) {
      if (!task.sourceTemplateSyncEnabled || !task.sourceTemplateCycleId) continue;
      const currentCycle = await ctx.db.get(task.cycleId as Id<"cycles">);
      if (!currentCycle || currentCycle.startsAt <= args.now) continue;

      const adjustment = await ctx.db
        .query("cycleAdjustments")
        .withIndex("by_churchId_and_cycleId_and_templateTaskId", (q) =>
          q
            .eq("churchId", args.churchId)
            .eq("cycleId", task.sourceTemplateCycleId!)
            .eq("templateTaskId", templateTask._id),
        )
        .unique();
      const merged = mergeTemplateTaskProjection(
        {
          templateTaskId: templateTask._id,
          templateTaskKey: templateTask.key,
          title: templateTask.title,
          dueDate: schedule.dueDate,
          parentTemplateTaskId: templateTask.parentTemplateTaskId,
        },
        adjustment ? { lifecycle: adjustment.lifecycle, overrides: adjustment.overrides } : null,
      );
      if (merged.skipped || !merged.effectiveTask) continue;

      const adjustedFields = overrideFields(merged.appliedOverrides);
      // Template-projected Tasks always carry a Due Date; fall back to the
      // effective Template Task date if the Task's was somehow cleared.
      const nextDueDate = adjustedFields.has("dueDate")
        ? (task.dueDate ?? merged.effectiveTask.dueDate)
        : merged.effectiveTask.dueDate;
      const nextCycleId = await ensureCycleForProjection(ctx, {
        churchId: args.churchId,
        dueDate: nextDueDate,
        churchTimeZone: args.churchTimeZone,
      });
      const nextValues = {
        title: adjustedFields.has("title") ? task.title : merged.effectiveTask.title,
        dueDate: nextDueDate,
        parentTaskId: task.parentTaskId,
      };
      const fields = changedFields(task, nextValues);
      if (task.cycleId !== nextCycleId) fields.push("cycleId");
      if (fields.length === 0) continue;

      await ctx.db.patch(task._id, {
        title: nextValues.title,
        dueDate: nextValues.dueDate,
        cycleId: nextCycleId,
      });
      await writeActivity(ctx, {
        churchId: args.churchId,
        entityType: "task",
        entityId: task._id,
        eventType: "task.template_synced",
        actorType: args.actorId ? "user" : "system",
        actorId: args.actorId,
        occurredAt: args.now,
        cycleId: nextCycleId,
        metadata: {
          templateId: templateTask.templateId,
          templateTaskId: templateTask._id,
          sourceTemplateCycleId: task.sourceTemplateCycleId,
          updatedFields: fields,
        },
      });
      syncedTaskIds.push(task._id);
    }
  }

  for (const templateId of templateIds) {
    await writeActivity(ctx, {
      churchId: args.churchId,
      entityType: "template",
      entityId: templateId,
      eventType: "template.updated",
      actorType: args.actorId ? "user" : "system",
      actorId: args.actorId,
      occurredAt: args.now,
      cycleId: null,
      metadata: { templateTaskIds, syncedTaskIds },
    });
  }

  return { ok: true as const, syncedTaskIds };
}

export async function createTemplates(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly templates: ReadonlyArray<TemplateInput> },
) {
  for (const template of args.templates) {
    validateTemplateInput(template);
    for (const templateTeam of template.templateTeams) {
      const mappedTeam = await ensureMappedTeam(ctx, args.churchId, templateTeam.mappedTeamId);
      if (!mappedTeam) return { ok: false as const, code: "teamNotFound" as const };
    }
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_churchId_and_key", (q) =>
        q.eq("churchId", args.churchId).eq("key", template.key),
      )
      .unique();
    if (existing) return { ok: false as const, code: "invalidTemplate" as const };
  }

  for (const template of args.templates) {
    const templateId = await ctx.db.insert("templates", {
      churchId: args.churchId,
      key: template.key,
      name: template.name,
      recurrence: template.recurrence,
      archivedAt: null,
    });

    const focusWindowIdsByKey = new Map<string, Id<"focusWindows">>();
    const templateTeamIdsByKey = new Map<string, Id<"templateTeams">>();
    const templateTaskIdsByKey = new Map<string, Id<"templateTasks">>();

    for (const templateTeam of template.templateTeams) {
      const mappedTeam = await ensureMappedTeam(ctx, args.churchId, templateTeam.mappedTeamId);
      if (!mappedTeam) return { ok: false as const, code: "teamNotFound" as const };
      const templateTeamId = await ctx.db.insert("templateTeams", {
        churchId: args.churchId,
        templateId,
        key: templateTeam.key,
        name: templateTeam.name,
        mappedTeamId: mappedTeam._id,
        archivedAt: null,
      });
      templateTeamIdsByKey.set(templateTeam.key, templateTeamId);
    }

    for (const focusWindow of template.focusWindows) {
      const focusWindowId = await ctx.db.insert("focusWindows", {
        churchId: args.churchId,
        templateId,
        key: focusWindow.key,
        name: focusWindow.name,
        type: focusWindow.type,
        startDate: focusWindow.startDate,
        endDate: focusWindow.endDate,
        anchorDate: focusWindow.anchorDate,
        keyDateId: focusWindow.keyDateId,
        archivedAt: null,
      });
      focusWindowIdsByKey.set(focusWindow.key, focusWindowId);
    }

    const pendingParentLinks: Array<{
      readonly templateTaskId: Id<"templateTasks">;
      readonly parentTemplateTaskKey: string;
    }> = [];

    for (const templateTask of template.templateTasks) {
      const rule =
        templateTask.schedulingRule.kind === "relativeToFocusWindow" ||
        templateTask.schedulingRule.kind === "relativeToAnchorDate"
          ? {
              ...templateTask.schedulingRule,
              focusWindowId: focusWindowIdsByKey.get(templateTask.schedulingRule.focusWindowId)!,
            }
          : templateTask.schedulingRule;
      const templateTaskId = await ctx.db.insert("templateTasks", {
        churchId: args.churchId,
        templateId,
        templateTeamId: templateTeamIdsByKey.get(
          templateTask.templateTeamKey ?? template.templateTeams[0]!.key,
        )!,
        key: templateTask.key,
        title: templateTask.title,
        parentTemplateTaskId: null,
        schedulingRule: rule,
        archivedAt: null,
      });
      templateTaskIdsByKey.set(templateTask.key, templateTaskId);
      if (templateTask.parentTemplateTaskKey) {
        pendingParentLinks.push({
          templateTaskId,
          parentTemplateTaskKey: templateTask.parentTemplateTaskKey,
        });
      }
    }

    for (const link of pendingParentLinks) {
      await ctx.db.patch(link.templateTaskId, {
        parentTemplateTaskId: templateTaskIdsByKey.get(link.parentTemplateTaskKey)!,
      });
    }
  }

  return { ok: true as const };
}

export async function resolveTemplateTaskSchedules(
  ctx: ReaderCtx,
  args: { readonly churchId: string; readonly churchTimeZone: string },
) {
  const model = await readTemplateModel(ctx, args.churchId);
  const resolvedSchedules = [];

  for (const templateTask of model.templateTasks) {
    if (templateTask.archivedAt !== null) continue;
    const dueDate = await resolveSchedulingRule(
      ctx,
      args.churchId,
      model,
      templateTask.schedulingRule,
    );
    const cycle = buildCycleForLocalDate({
      localDate: dueDate,
      churchTimeZone: args.churchTimeZone,
    });
    resolvedSchedules.push({
      templateTaskId: templateTask._id,
      templateTaskKey: templateTask.key,
      dueDate,
      cycle,
    });
  }

  return resolvedSchedules;
}

async function resolveSchedulingRule(
  ctx: ReaderCtx,
  churchId: string,
  model: Awaited<ReturnType<typeof readTemplateModel>>,
  rule: SchedulingRule,
) {
  if (rule.kind === "fixedDate") return rule.localDate;

  if (rule.kind === "cycleOffset") {
    const startDate = cycleStartDateForLocalDate(rule.baseLocalDate);
    return addDays(startDate, rule.offsetCycles * 7 + rule.dayOffset);
  }

  if (rule.kind === "relativeToFocusWindow") {
    const focusWindow = model.focusWindows.find(
      (candidate) => candidate._id === rule.focusWindowId,
    );
    if (!focusWindow || focusWindow.archivedAt !== null) {
      throw new Error("Focus Window was not found.");
    }
    const baseDate = rule.edge === "start" ? focusWindow.startDate : focusWindow.endDate;
    if (!baseDate) throw new Error("Focus Window end date is required for this rule.");
    return addDays(baseDate, rule.offsetDays);
  }

  if (rule.kind === "relativeToAnchorDate") {
    const focusWindow = model.focusWindows.find(
      (candidate) => candidate._id === rule.focusWindowId,
    );
    if (!focusWindow?.anchorDate || focusWindow.archivedAt !== null) {
      throw new Error("Focus Window anchor date is required for this rule.");
    }
    return addDays(focusWindow.anchorDate, rule.offsetDays);
  }

  const occurrences = await resolveKeyDateOccurrences(ctx, {
    churchId,
    fromYear: rule.year,
    toYear: rule.year,
  });
  const occurrence = occurrences.find((candidate) => candidate.keyDateId === rule.keyDateId);
  if (!occurrence) throw new Error("Key Date occurrence was not found for this rule.");
  return addDays(occurrence.localDate, rule.offsetDays);
}
