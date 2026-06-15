import {
  buildTaskBoardColumns,
  buildTaskBoardGroupColumns,
  getTaskGroupColumnId,
  workflowStatusGroupKey,
  type TaskBoardGroupColumn,
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

/**
 * Builds Workflow Status columns collapsed across Teams' Workflows (ADR 0013):
 * every Team owns its own Workflow, so "To Do" / "In Progress" / "Done" exist
 * once per Team with distinct ids. Insights aggregates over the whole Task set,
 * so same-identity statuses share one bucket — otherwise the chart and table
 * show a duplicate row per Team. Built from `buildTaskBoardColumns` so the
 * sort, canceled-exclusion, and labels still match the Board exactly, then
 * collapsed by the shared (Task State, name) identity key.
 */
function buildMergedStatusColumns(
  statuses: readonly TaskBoardWorkflowStatus[],
): TaskBoardGroupColumn[] {
  const seen = new Set<string>();
  const columns: TaskBoardGroupColumn[] = [];
  for (const column of buildTaskBoardColumns(statuses)) {
    const key = workflowStatusGroupKey(column.taskState, column.title);
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push({ id: key, title: column.title, taskState: column.taskState });
  }
  return columns;
}

/**
 * Maps each Workflow Status id to its merged identity-key column id so Tasks
 * from different Teams' Workflows land in the same Insights bucket.
 */
function buildStatusIdToMergedId(
  statuses: readonly TaskBoardWorkflowStatus[],
): ReadonlyMap<string, string> {
  return new Map(
    statuses.map((status) => [status.id, workflowStatusGroupKey(status.taskState, status.name)]),
  );
}

function buildColumns(
  dimension: TaskBoardGrouping,
  meta: InsightsBucketMeta,
  tasks: readonly TaskBoardTask[],
  showEmpty: boolean,
): TaskBoardGroupColumn[] {
  // Workflow Status is the one dimension that needs name-merging; every other
  // dimension already has globally-unique buckets.
  if (dimension === "workflow_status") {
    const merged = buildMergedStatusColumns(meta.workflowStatuses);
    if (showEmpty) return merged;
    const statusIdToMergedId = buildStatusIdToMergedId(meta.workflowStatuses);
    const populated = new Set(
      tasks
        .map((task) => statusIdToMergedId.get(task.workflowStatusId))
        .filter((id): id is string => id !== undefined),
    );
    return merged.filter((column) => populated.has(column.id));
  }

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
 * Resolves the bucket id for a Task under a dimension, applying the same
 * Workflow Status name-merge the columns use.
 */
function bucketIdForTask(
  dimension: TaskBoardGrouping,
  task: TaskBoardTask,
  statusIdToMergedId: ReadonlyMap<string, string>,
): string {
  if (dimension === "workflow_status") {
    return statusIdToMergedId.get(task.workflowStatusId) ?? task.workflowStatusId;
  }
  return getTaskGroupColumnId(dimension, task);
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

  // Shared by the column builders and the per-task bucketing so merged Workflow
  // Status buckets line up exactly.
  const statusIdToMergedId = buildStatusIdToMergedId(meta.workflowStatuses);

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
    const sliceId = bucketIdForTask(slice, task, statusIdToMergedId);
    if (!sliceColumnIds.has(sliceId)) continue;
    const segmentId = hasSegment
      ? bucketIdForTask(segment as TaskBoardGrouping, task, statusIdToMergedId)
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
