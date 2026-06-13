import { Schema } from "effect";

import { lenientSearchField } from "@/shared/lenient-search";

/**
 * Insights State (see CONTEXT.md): the open/closed state of the Insights panel
 * together with its Measure, Slice, Segment, and show-canceled toggle, carried
 * in the URL under the `insights` search key so a shared link reproduces the
 * same Insights its sender sees. Absent fields mean "use the default". Insights
 * inherits the Saved View's filters and Task set, so its totals match the
 * Board; only Slice/Segment/Measure/show-canceled are Insights-local.
 */

// The only Measure is Task count; Estimate is counted by, never summed
// (CONTEXT.md — no points / summed-Estimate Measure).
export const InsightsMeasureSchema = Schema.Literal("task_count");
export type InsightsMeasure = typeof InsightsMeasureSchema.Type;

// Slice and Segment draw from the same five Task dimensions the Board groups by.
export const InsightsDimensionSchema = Schema.Literal(
  "workflow_status",
  "task_state",
  "assignee",
  "team",
  "estimate",
);
export type InsightsDimension = typeof InsightsDimensionSchema.Type;

// Segment is optional; "none" gives plain (un-stacked) bars.
export const InsightsSegmentSchema = Schema.Literal(
  "none",
  "workflow_status",
  "task_state",
  "assignee",
  "team",
  "estimate",
);
export type InsightsSegment = typeof InsightsSegmentSchema.Type;

export const InsightsStateSchema = Schema.Struct({
  open: Schema.optional(Schema.Boolean),
  measure: Schema.optional(InsightsMeasureSchema),
  slice: Schema.optional(InsightsDimensionSchema),
  segment: Schema.optional(InsightsSegmentSchema),
  showCanceled: Schema.optional(Schema.Boolean),
});
export type InsightsState = typeof InsightsStateSchema.Type;

export type ResolvedInsightsState = {
  readonly open: boolean;
  readonly measure: InsightsMeasure;
  readonly slice: InsightsDimension;
  readonly segment: InsightsSegment;
  readonly showCanceled: boolean;
};

export const DEFAULT_INSIGHTS_STATE: ResolvedInsightsState = {
  open: false,
  measure: "task_count",
  slice: "workflow_status",
  segment: "none",
  showCanceled: false,
};

export const INSIGHTS_MEASURE_OPTIONS: ReadonlyArray<{
  readonly value: InsightsMeasure;
  readonly label: string;
}> = [{ value: "task_count", label: "Task count" }];

export const INSIGHTS_DIMENSION_OPTIONS: ReadonlyArray<{
  readonly value: InsightsDimension;
  readonly label: string;
}> = [
  { value: "workflow_status", label: "Workflow Status" },
  { value: "task_state", label: "Task State" },
  { value: "assignee", label: "Assignee" },
  { value: "team", label: "Team" },
  { value: "estimate", label: "Estimate" },
];

export function resolveInsightsState(state: InsightsState | undefined): ResolvedInsightsState {
  const slice = state?.slice ?? DEFAULT_INSIGHTS_STATE.slice;
  // A chosen Segment cannot be the same dimension as the Slice (CONTEXT.md).
  const requestedSegment = state?.segment ?? DEFAULT_INSIGHTS_STATE.segment;
  const segment = requestedSegment === slice ? "none" : requestedSegment;

  return {
    open: state?.open ?? DEFAULT_INSIGHTS_STATE.open,
    measure: state?.measure ?? DEFAULT_INSIGHTS_STATE.measure,
    slice,
    segment,
    showCanceled: state?.showCanceled ?? DEFAULT_INSIGHTS_STATE.showCanceled,
  };
}

/**
 * Strip default-valued fields so a clean configuration produces a clean URL
 * (no `insights` key at all).
 */
export function toInsightsSearchValue(state: ResolvedInsightsState): InsightsState | undefined {
  const next: InsightsState = {
    ...(state.open !== DEFAULT_INSIGHTS_STATE.open ? { open: state.open } : {}),
    ...(state.measure !== DEFAULT_INSIGHTS_STATE.measure ? { measure: state.measure } : {}),
    ...(state.slice !== DEFAULT_INSIGHTS_STATE.slice ? { slice: state.slice } : {}),
    ...(state.segment !== DEFAULT_INSIGHTS_STATE.segment ? { segment: state.segment } : {}),
    ...(state.showCanceled !== DEFAULT_INSIGHTS_STATE.showCanceled
      ? { showCanceled: state.showCanceled }
      : {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

export const InsightsSearchSchema = {
  insights: lenientSearchField(InsightsStateSchema),
};

export type InsightsSearch = {
  readonly insights?: InsightsState;
};
