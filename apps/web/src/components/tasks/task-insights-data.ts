import {
  buildTaskBoardGroupColumns,
  getTaskGroupColumnId,
  type TaskBoardGrouping,
  type TaskBoardTask,
  type TaskBoardWorkflowStatus,
} from "@/components/tasks/task-kanban-adapter";
import type { InsightsDimension, InsightsSegment } from "@/components/tasks/task-insights-options";

/**
 * Insights counting (see CONTEXT.md): the Slice × Segment cross-tab over the
 * Tasks already loaded for the surface. Measure is always Task count; Estimate
 * is counted by, never summed. Reuses the Board's grouping primitives so the
 * buckets, labels, and ordering match the Board exactly.
 */

export type InsightsBucketMeta = {
  readonly assignees: readonly { readonly id: string; readonly label: string }[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
};

export type InsightsSegmentDatum = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  // Share of the bar this segment represents (0–100).
  readonly percentage: number;
};

export type InsightsSliceDatum = {
  readonly id: string;
  readonly label: string;
  readonly total: number;
  readonly segments: readonly InsightsSegmentDatum[];
};

export type InsightsSeries = {
  readonly id: string;
  readonly label: string;
};

export type InsightsData = {
  readonly total: number;
  readonly slices: readonly InsightsSliceDatum[];
  // The ordered Segment series (chart stacks + table columns). Empty when there
  // is no Segment.
  readonly series: readonly InsightsSeries[];
};

const NO_SEGMENT_ID = "__total__";

function buildColumns(
  dimension: TaskBoardGrouping,
  meta: InsightsBucketMeta,
  tasks: readonly TaskBoardTask[],
  showEmpty: boolean,
) {
  return buildTaskBoardGroupColumns({
    grouping: dimension,
    workflowStatuses: meta.workflowStatuses,
    assignees: meta.assignees,
    teams: meta.teams,
    tasks,
    showEmptyColumns: showEmpty,
  });
}

/**
 * Builds the Slice × Segment cross-tab. Canceled Tasks are always excluded by
 * the Board column primitives; `showCanceled` is handled by the caller filtering
 * the task set, since canceled buckets never appear as columns.
 */
export function buildInsightsData(args: {
  readonly slice: InsightsDimension;
  readonly segment: InsightsSegment;
  readonly tasks: readonly TaskBoardTask[];
  readonly meta: InsightsBucketMeta;
}): InsightsData {
  const { slice, segment, tasks, meta } = args;

  // Slice columns drive the bars; show every column (empty included) so the
  // chart shows the full dimension, matching Linear.
  const sliceColumns = buildColumns(slice, meta, tasks, true);
  const sliceColumnIds = new Set(sliceColumns.map((column) => column.id));

  const hasSegment = segment !== "none";
  const segmentColumns = hasSegment
    ? buildColumns(segment as TaskBoardGrouping, meta, tasks, false)
    : [];
  const series: readonly InsightsSeries[] = hasSegment
    ? segmentColumns.map((column) => ({ id: column.id, label: column.title }))
    : [];

  // counts[sliceId][segmentId] = number of tasks
  const counts = new Map<string, Map<string, number>>();
  for (const column of sliceColumns) counts.set(column.id, new Map());

  for (const task of tasks) {
    const sliceId = getTaskGroupColumnId(slice, task);
    if (!sliceColumnIds.has(sliceId)) continue;
    const segmentId = hasSegment
      ? getTaskGroupColumnId(segment as TaskBoardGrouping, task)
      : NO_SEGMENT_ID;
    const bucket = counts.get(sliceId);
    if (!bucket) continue;
    bucket.set(segmentId, (bucket.get(segmentId) ?? 0) + 1);
  }

  const slices: readonly InsightsSliceDatum[] = sliceColumns.map((column) => {
    const bucket = counts.get(column.id) ?? new Map<string, number>();
    const total = [...bucket.values()].reduce((sum, value) => sum + value, 0);

    const segments: readonly InsightsSegmentDatum[] = hasSegment
      ? series.map((entry) => {
          const count = bucket.get(entry.id) ?? 0;
          return {
            id: entry.id,
            label: entry.label,
            count,
            percentage: total === 0 ? 0 : (count / total) * 100,
          };
        })
      : [
          {
            id: NO_SEGMENT_ID,
            label: column.title,
            count: total,
            percentage: total === 0 ? 0 : 100,
          },
        ];

    return { id: column.id, label: column.title, total, segments };
  });

  const total = slices.reduce((sum, slice) => sum + slice.total, 0);

  return { total, slices, series };
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Serializes the Insights cross-tab to CSV — one row per Slice bucket, a Task
 * count column, then a column per Segment series (matching the data table).
 */
export function insightsToCsv(data: InsightsData, sliceLabel: string): string {
  const header = [sliceLabel, "Task count", ...data.series.map((entry) => entry.label)];
  const rows = data.slices.map((slice) => {
    const counts = data.series.length
      ? data.series.map(
          (entry) => slice.segments.find((segment) => segment.id === entry.id)?.count ?? 0,
        )
      : [];
    return [slice.label, slice.total, ...counts];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
    .join("\n");
}
