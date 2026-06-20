export type TemplateRecurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export type TemplateScheduleKind = "weekly" | "keyDate" | "monthly" | "quarterly" | "yearly";

export type TemplateScheduleRecurrence = "oneOff" | "repeating";

export type TemplateScheduleRule =
  | { readonly kind: "weekly"; readonly weekdays: readonly number[] }
  | { readonly kind: "keyDate"; readonly keyDateId: string; readonly repeat: "none" | "yearly" }
  | { readonly kind: "monthly"; readonly repeat: "none" | "monthly" }
  | { readonly kind: "quarterly"; readonly repeat: "none" | "quarterly" }
  | { readonly kind: "yearly"; readonly repeat: "none" | "yearly" };

export type TemplateScheduleContract = {
  readonly kind: TemplateScheduleKind;
  readonly recurrence: TemplateScheduleRecurrence;
  readonly rule: TemplateScheduleRule;
};

export const assertTemplateScheduleContract = (schedule: TemplateScheduleContract) => {
  if (schedule.kind !== schedule.rule.kind) {
    throw new Error("Template Schedule kind must match its rule kind.");
  }

  if (
    schedule.recurrence === "oneOff" &&
    "repeat" in schedule.rule &&
    schedule.rule.repeat !== "none"
  ) {
    throw new Error("One-off Template Schedule rules must not repeat.");
  }

  if (
    schedule.recurrence === "repeating" &&
    "repeat" in schedule.rule &&
    schedule.rule.repeat === "none"
  ) {
    throw new Error("Repeating Template Schedule rules must repeat.");
  }
};

export type TemplateTaskPlacement = {
  readonly cycleOffsetFromEnd: number;
  /** 0 = Monday, 6 = Sunday. */
  readonly weekday: number;
};

export type PeriodTemplatePlacementShape = "monthly" | "quarterly" | "yearly";

export type PeriodPlacementFrameDay = {
  readonly isPeriodBoundary: boolean;
  readonly localDate: string;
  readonly periodKey: string;
};

export type PeriodPlacementFrameCycle = {
  readonly days: readonly PeriodPlacementFrameDay[];
  readonly isInFocusPeriod: boolean;
  readonly ownedPeriodKey: string;
  readonly startLocalDate: string;
};

export type PeriodPlacementFrame = {
  readonly cycles: readonly PeriodPlacementFrameCycle[];
  readonly endCycleStartLocalDate: string;
  readonly periodKey: string;
  readonly shape: PeriodTemplatePlacementShape;
};

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
  | { readonly field: "description"; readonly value: string | null }
  | { readonly field: "assignedUserId"; readonly value: string | null }
  | { readonly field: "teamId"; readonly value: string }
  | { readonly field: "dueDate"; readonly value: string }
  | { readonly field: "labelIds"; readonly value: readonly string[] }
  | { readonly field: "estimate"; readonly value: string | null }
  | { readonly field: "priority"; readonly value: string | null }
  | { readonly field: "parentTemplateTaskId"; readonly value: string | null };

export type CycleAdjustmentForMerge = {
  readonly lifecycle: "active" | "skipped";
  readonly overrides: readonly CycleAdjustmentOverride[];
};

export type TemplateTaskProjectionBase = {
  readonly templateTaskId: string;
  readonly templateTaskKey: string;
  readonly title: string;
  readonly description: string | null;
  readonly assignedUserId: string | null;
  readonly dueDate: string;
  readonly estimate: string | null;
  readonly priority: string | null;
  readonly labelIds: readonly string[];
  readonly parentTemplateTaskId: string | null;
  readonly teamId: string;
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

const jsWeekdayToMondayFirst = (jsWeekday: number) => (jsWeekday + 6) % 7;

const startOfCycle = (localDate: string) => {
  const { day, month, year } = parseLocalDate(localDate);
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addLocalDateDays(localDate, -jsWeekdayToMondayFirst(jsWeekday));
};

const periodKeyForDate = (shape: PeriodTemplatePlacementShape, localDate: string) => {
  const { month, year } = parseLocalDate(localDate);
  switch (shape) {
    case "monthly":
      return `${year}-${String(month).padStart(2, "0")}`;
    case "quarterly":
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    case "yearly":
      return `${year}`;
  }
};

const nextPeriodStart = (shape: PeriodTemplatePlacementShape, localDate: string) => {
  const { month, year } = parseLocalDate(localDate);
  switch (shape) {
    case "monthly":
      return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    case "quarterly": {
      const nextQuarterMonth = Math.floor((month - 1) / 3) * 3 + 4;
      return new Date(Date.UTC(year, nextQuarterMonth - 1, 1)).toISOString().slice(0, 10);
    }
    case "yearly":
      return new Date(Date.UTC(year + 1, 0, 1)).toISOString().slice(0, 10);
  }
};

const frameSizeForShape = (shape: PeriodTemplatePlacementShape) => {
  switch (shape) {
    case "monthly":
      return 5;
    case "quarterly":
      return 13;
    case "yearly":
      return 52;
  }
};

const majorityOwnedPeriodKey = (
  shape: PeriodTemplatePlacementShape,
  cycleStartLocalDate: string,
) => {
  const counts = new Map<string, number>();
  for (let offset = 0; offset < 7; offset++) {
    const key = periodKeyForDate(shape, addLocalDateDays(cycleStartLocalDate, offset));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? ""
  );
};

export const buildPeriodPlacementFrame = (params: {
  readonly periodStartLocalDate: string;
  readonly shape: PeriodTemplatePlacementShape;
}): PeriodPlacementFrame => {
  const periodKey = periodKeyForDate(params.shape, params.periodStartLocalDate);
  const firstCycleStart = startOfCycle(params.periodStartLocalDate);
  const nextStart = nextPeriodStart(params.shape, params.periodStartLocalDate);
  const frameSize = frameSizeForShape(params.shape);
  const normalizedStarts = Array.from({ length: frameSize }, (_, index) =>
    addLocalDateDays(firstCycleStart, index * 7),
  );

  const cycles = normalizedStarts.map((cycleStart) => {
    const ownedPeriodKey = majorityOwnedPeriodKey(params.shape, cycleStart);
    return {
      days: Array.from({ length: 7 }, (_, offset) => {
        const localDate = addLocalDateDays(cycleStart, offset);
        const dayPeriodKey = periodKeyForDate(params.shape, localDate);
        return {
          isPeriodBoundary:
            localDate === params.periodStartLocalDate ||
            localDate === addLocalDateDays(nextStart, -1),
          localDate,
          periodKey: dayPeriodKey,
        };
      }),
      isInFocusPeriod: ownedPeriodKey === periodKey,
      ownedPeriodKey,
      startLocalDate: cycleStart,
    };
  });

  return {
    cycles,
    endCycleStartLocalDate: cycles.at(-1)?.startLocalDate ?? firstCycleStart,
    periodKey,
    shape: params.shape,
  };
};

export const resolvePeriodPlacementDueDate = (params: {
  readonly endCycleStartLocalDate: string;
  readonly placement: TemplateTaskPlacement;
}) =>
  addLocalDateDays(
    params.endCycleStartLocalDate,
    params.placement.cycleOffsetFromEnd * 7 + params.placement.weekday,
  );

export const defaultTemplateScheduleForPlacementShape = (
  shape: PeriodTemplatePlacementShape,
  options?: { readonly repeatYearly?: boolean },
):
  | {
      readonly recurrence: "repeating";
      readonly rule: { readonly kind: "monthly"; readonly repeat: "monthly" };
    }
  | {
      readonly recurrence: "repeating";
      readonly rule: { readonly kind: "quarterly"; readonly repeat: "quarterly" };
    }
  | {
      readonly recurrence: "oneOff";
      readonly rule: { readonly kind: "yearly"; readonly repeat: "none" };
    }
  | {
      readonly recurrence: "repeating";
      readonly rule: { readonly kind: "yearly"; readonly repeat: "yearly" };
    } => {
  if (shape === "monthly")
    return { recurrence: "repeating", rule: { kind: "monthly", repeat: "monthly" } };
  if (shape === "quarterly")
    return { recurrence: "repeating", rule: { kind: "quarterly", repeat: "quarterly" } };
  return options?.repeatYearly
    ? { recurrence: "repeating", rule: { kind: "yearly", repeat: "yearly" } }
    : { recurrence: "oneOff", rule: { kind: "yearly", repeat: "none" } };
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
    assignedUserId: string | null;
    description: string | null;
    parentTemplateTaskId: string | null;
    dueDate: string;
    estimate: string | null;
    priority: string | null;
    labelIds: readonly string[];
    teamId: string;
    templateTaskId: string;
    templateTaskKey: string;
    title: string;
  } = { ...base };
  for (const override of adjustment?.overrides ?? []) {
    if (override.field === "title") effectiveTask.title = override.value;
    if (override.field === "description") effectiveTask.description = override.value;
    if (override.field === "assignedUserId") effectiveTask.assignedUserId = override.value;
    if (override.field === "teamId") effectiveTask.teamId = override.value;
    if (override.field === "dueDate") effectiveTask.dueDate = override.value;
    if (override.field === "labelIds") effectiveTask.labelIds = override.value;
    if (override.field === "estimate") effectiveTask.estimate = override.value;
    if (override.field === "priority") effectiveTask.priority = override.value;
    if (override.field === "parentTemplateTaskId")
      effectiveTask.parentTemplateTaskId = override.value;
  }

  return { appliedOverrides: adjustment?.overrides ?? [], effectiveTask, skipped: false };
};
