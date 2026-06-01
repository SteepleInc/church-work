import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";

import { buildCycleForLocalDate, cycleStartDateForLocalDate } from "./churchCycleCalendar";
import type { DataModel, Id } from "./convex/_generated/dataModel";
import { resolveKeyDateOccurrences } from "./keyDateScheduling";
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
  readonly parentTemplateTaskKey: string | null;
  readonly schedulingRule: SchedulingRule;
};

type TemplateInput = {
  readonly key: string;
  readonly name: string;
  readonly recurrence: TemplateRecurrence;
  readonly focusWindows: ReadonlyArray<FocusWindowInput>;
  readonly templateTasks: ReadonlyArray<TemplateTaskInput>;
};

type CycleAdjustmentInput = {
  readonly cycleId: string;
  readonly templateTaskId: string;
  readonly lifecycle: "active" | "skipped";
  readonly overrides: ReadonlyArray<CycleAdjustmentOverride>;
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
  assertUniqueKeys(template.focusWindows);
  assertUniqueKeys(template.templateTasks);

  const focusWindowKeys = new Set(template.focusWindows.map((focusWindow) => focusWindow.key));
  const templateTaskKeys = new Set(template.templateTasks.map((templateTask) => templateTask.key));

  for (const focusWindow of template.focusWindows) {
    parseLocalDate(focusWindow.startDate);
    if (focusWindow.endDate) parseLocalDate(focusWindow.endDate);
    if (focusWindow.anchorDate) parseLocalDate(focusWindow.anchorDate);
  }

  for (const templateTask of template.templateTasks) {
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
  const templateTasks = await ctx.db
    .query("templateTasks")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();
  const cycleAdjustments = await ctx.db
    .query("cycleAdjustments")
    .withIndex("by_churchId", (q) => q.eq("churchId", churchId))
    .collect();

  return { templates, focusWindows, templateTasks, cycleAdjustments };
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

export async function createTemplates(
  ctx: MutationCtx,
  args: { readonly churchId: string; readonly templates: ReadonlyArray<TemplateInput> },
) {
  for (const template of args.templates) {
    validateTemplateInput(template);
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
    const templateTaskIdsByKey = new Map<string, Id<"templateTasks">>();

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
