import { Copy, Download, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { buildInsightsData, type InsightsBucketMeta } from "@/components/tasks/task-insights-data";
import {
  INSIGHTS_DIMENSION_OPTIONS,
  INSIGHTS_MEASURE_OPTIONS,
  type InsightsDimension,
  type InsightsSegment,
  type ResolvedInsightsState,
} from "@/components/tasks/task-insights-options";
import type { TaskBoardTask } from "@/components/tasks/task-kanban-adapter";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function TaskInsightsPanel({
  state,
  onStateChange,
  onClose,
  onCopyLink,
  onExportCsv,
  onRefresh,
  tasks,
  meta,
  className,
}: {
  readonly state: ResolvedInsightsState;
  readonly onStateChange: (next: ResolvedInsightsState) => void;
  readonly onClose: () => void;
  readonly onCopyLink: () => void;
  readonly onExportCsv: () => void;
  readonly onRefresh: () => void;
  readonly tasks: readonly TaskBoardTask[];
  readonly meta: InsightsBucketMeta;
  readonly className?: string;
}) {
  // "Show canceled tasks" is the only panel-local filter (CONTEXT.md). Canceled
  // Tasks are otherwise excluded; including them only matters when slicing by
  // Task State, where they form their own bucket.
  const scopedTasks = useMemo(
    () => (state.showCanceled ? tasks : tasks.filter((task) => task.taskState !== "canceled")),
    [tasks, state.showCanceled],
  );

  const data = useMemo(
    () =>
      buildInsightsData({ slice: state.slice, segment: state.segment, tasks: scopedTasks, meta }),
    [state.slice, state.segment, scopedTasks, meta],
  );

  const hasSegment = state.segment !== "none";

  const chartConfig = useMemo<ChartConfig>(() => {
    if (!hasSegment) {
      return { total: { label: "Task count", color: colorAt(0) } };
    }
    return Object.fromEntries(
      data.series.map((entry, index) => [entry.id, { label: entry.label, color: colorAt(index) }]),
    );
  }, [hasSegment, data.series]);

  const chartData = useMemo(
    () =>
      data.slices.map((slice) => {
        const row: Record<string, number | string> = { slice: slice.label, total: slice.total };
        for (const segment of slice.segments) {
          row[segment.id] = segment.count;
        }
        return row;
      }),
    [data.slices],
  );

  const stackKeys = hasSegment ? data.series.map((entry) => entry.id) : ["total"];

  // The Segment options exclude the current Slice (a Segment can never equal the
  // Slice — CONTEXT.md). "No segment" leads so the closed trigger can resolve
  // the "none" value to its label.
  const segmentOptions = INSIGHTS_DIMENSION_OPTIONS.filter(
    (option) => option.value !== state.slice,
  );
  const segmentItems = [
    { value: "none" as InsightsSegment, label: "No segment" },
    ...segmentOptions,
  ];

  return (
    <aside
      aria-label="Insights"
      className={cn(
        "flex w-full flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{data.total}</span>{" "}
          <span className="text-muted-foreground">tasks</span>
        </p>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button aria-label="Insights actions" size="icon-sm" type="button" variant="ghost">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem onClick={onCopyLink}>
                <Copy />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCsv}>
                <Download />
                Export Insights as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label="Close Insights"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Measure</Label>
          <Select
            items={INSIGHTS_MEASURE_OPTIONS}
            value={state.measure}
            onValueChange={(value) =>
              onStateChange({ ...state, measure: value as ResolvedInsightsState["measure"] })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSIGHTS_MEASURE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Slice</Label>
          <Select
            items={INSIGHTS_DIMENSION_OPTIONS}
            value={state.slice}
            onValueChange={(value) => {
              const slice = value as InsightsDimension;
              onStateChange({
                ...state,
                slice,
                // Keep Slice and Segment distinct (CONTEXT.md).
                segment: state.segment === slice ? "none" : state.segment,
              });
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSIGHTS_DIMENSION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Segment</Label>
          <Select
            items={segmentItems}
            value={state.segment}
            onValueChange={(value) =>
              onStateChange({ ...state, segment: value as InsightsSegment })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No segment</SelectItem>
              {segmentOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ChartContainer className="aspect-auto h-64 w-full" config={chartConfig}>
        <BarChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="slice" tickLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const total = data.total === 0 ? 0 : Number(value);
                  return (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {chartConfig[name as string]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">{total}</span>
                    </span>
                  );
                }}
              />
            }
          />
          {hasSegment ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {stackKeys.map((key, index) => (
            <Bar
              dataKey={key}
              fill={hasSegment ? `var(--color-${key})` : colorAt(0)}
              key={key}
              radius={
                stackKeys.length === 1
                  ? 4
                  : index === stackKeys.length - 1
                    ? [4, 4, 0, 0]
                    : [0, 0, 0, 0]
              }
              stackId="insights"
            />
          ))}
        </BarChart>
      </ChartContainer>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground" htmlFor="insights-show-canceled">
          Show canceled tasks
        </Label>
        <Switch
          checked={state.showCanceled}
          id="insights-show-canceled"
          onCheckedChange={(checked) => onStateChange({ ...state, showCanceled: checked })}
        />
      </div>

      <InsightsTable data={data} hasSegment={hasSegment} sliceLabel={sliceLabel(state.slice)} />
    </aside>
  );
}

function sliceLabel(slice: InsightsDimension): string {
  return INSIGHTS_DIMENSION_OPTIONS.find((option) => option.value === slice)?.label ?? "Slice";
}

function InsightsTable({
  data,
  hasSegment,
  sliceLabel,
}: {
  readonly data: ReturnType<typeof buildInsightsData>;
  readonly hasSegment: boolean;
  readonly sliceLabel: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{sliceLabel}</TableHead>
          <TableHead className="text-right">Task count</TableHead>
          {hasSegment
            ? data.series.map((entry) => (
                <TableHead className="text-right" key={entry.id}>
                  {entry.label}
                </TableHead>
              ))
            : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.slices.map((slice) => (
          <TableRow key={slice.id}>
            <TableCell className="font-medium">{slice.label}</TableCell>
            <TableCell className="text-right tabular-nums">{slice.total}</TableCell>
            {hasSegment
              ? slice.segments.map((segment) => (
                  <TableCell className="text-right tabular-nums" key={segment.id}>
                    {segment.count}
                  </TableCell>
                ))
              : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
