export type TemplateRecurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export type KeyDateSchedule =
  | { readonly kind: "fixedYearly"; readonly month: number; readonly day: number }
  | {
      readonly kind: "computedYearly";
      readonly rule:
        | "easter"
        | "palm_sunday"
        | "pentecost"
        | "ash_wednesday"
        | "good_friday"
        | "mothers_day"
        | "fathers_day"
        | "thanksgiving";
    }
  | { readonly kind: "oneTime"; readonly localDate: string };

export type SchedulingRule =
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

export type CycleAdjustmentOverride =
  | { readonly field: "title"; readonly value: string }
  | { readonly field: "dueDate"; readonly value: string }
  | { readonly field: "parentTemplateTaskId"; readonly value: string | null };

export type CycleAdjustmentForMerge = {
  readonly lifecycle: "active" | "skipped";
  readonly overrides: readonly CycleAdjustmentOverride[];
};

export type TemplateTaskProjectionBase = {
  readonly templateTaskId: string;
  readonly templateTaskKey: string;
  readonly title: string;
  readonly dueDate: string;
  readonly parentTemplateTaskId: string | null;
};

export type MergedTemplateTaskProjection = {
  readonly skipped: boolean;
  readonly effectiveTask: TemplateTaskProjectionBase | null;
  readonly appliedOverrides: readonly CycleAdjustmentOverride[];
};

export type FocusWindowForScheduling = {
  readonly id: string;
  readonly start_date: string;
  readonly end_date: string | null;
  readonly anchor_date: string | null;
};

export type KeyDateOccurrenceForScheduling = {
  readonly key_date_id: string;
  readonly local_date: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const parseLocalDate = (localDate: string) => {
  if (!isoDatePattern.test(localDate)) throw new Error("Local date must use YYYY-MM-DD format.");

  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const asUtcDate = new Date(Date.UTC(year, month - 1, day));
  if (asUtcDate.toISOString().slice(0, 10) !== localDate) {
    throw new Error("Local date must be a real calendar date.");
  }

  return { day, month, year };
};

export const addLocalDateDays = (localDate: string, days: number) => {
  const { day, month, year } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const daysBetween = (startLocalDate: string, endLocalDate: string) => {
  const start = parseLocalDate(startLocalDate);
  const end = parseLocalDate(endLocalDate);
  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endMs - startMs) / 86_400_000);
};

export const resolveSchedulingRule = (
  rule: SchedulingRule,
  args: {
    readonly cycle_start_date: string;
    readonly focus_windows: readonly FocusWindowForScheduling[];
    readonly key_date_occurrences: readonly KeyDateOccurrenceForScheduling[];
  },
) => {
  if (rule.kind === "fixedDate") return rule.localDate;
  if (rule.kind === "cycleOffset") {
    const offsetDays = daysBetween(rule.baseLocalDate, args.cycle_start_date);
    return addLocalDateDays(
      rule.baseLocalDate,
      offsetDays + rule.offsetCycles * 7 + rule.dayOffset,
    );
  }
  if (rule.kind === "relativeToKeyDate") {
    const occurrence = args.key_date_occurrences.find(
      (candidate) =>
        candidate.key_date_id === rule.keyDateId &&
        parseLocalDate(candidate.local_date).year === rule.year,
    );
    if (!occurrence) throw new Error("Key Date occurrence was not found for Scheduling Rule.");
    return addLocalDateDays(occurrence.local_date, rule.offsetDays);
  }

  const focusWindow = args.focus_windows.find((candidate) => candidate.id === rule.focusWindowId);
  if (!focusWindow) throw new Error("Focus Window was not found for Scheduling Rule.");
  if (rule.kind === "relativeToAnchorDate") {
    if (!focusWindow.anchor_date) throw new Error("Focus Window does not have an anchor date.");
    return addLocalDateDays(focusWindow.anchor_date, rule.offsetDays);
  }

  const edgeDate = rule.edge === "start" ? focusWindow.start_date : focusWindow.end_date;
  if (!edgeDate) throw new Error("Focus Window does not have the requested edge date.");
  return addLocalDateDays(edgeDate, rule.offsetDays);
};

export const mergeTemplateTaskProjection = (
  base: TemplateTaskProjectionBase,
  adjustment: CycleAdjustmentForMerge | null,
): MergedTemplateTaskProjection => {
  if (adjustment?.lifecycle === "skipped") {
    return { appliedOverrides: adjustment.overrides, effectiveTask: null, skipped: true };
  }

  const effectiveTask: {
    parentTemplateTaskId: string | null;
    dueDate: string;
    templateTaskId: string;
    templateTaskKey: string;
    title: string;
  } = { ...base };
  for (const override of adjustment?.overrides ?? []) {
    if (override.field === "title") effectiveTask.title = override.value;
    if (override.field === "dueDate") effectiveTask.dueDate = override.value;
    if (override.field === "parentTemplateTaskId")
      effectiveTask.parentTemplateTaskId = override.value;
  }

  return { appliedOverrides: adjustment?.overrides ?? [], effectiveTask, skipped: false };
};
