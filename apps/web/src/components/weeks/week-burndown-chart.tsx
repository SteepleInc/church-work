import { useId } from "react";

import { cn } from "@/lib/utils";

import type { TeamWeekBurndown } from "./team-weeks-index-data";

// A compact burndown-style chart matching Linear's expanded Cycle view: the
// Scope line caps the top, the Started area fills toward it, the Completed line
// runs along the bottom, and a dashed ideal-guide cuts diagonally across. Days
// are evenly spaced left → right with the Week's start/end dates on the axis.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 168;
const PADDING = { top: 12, right: 8, bottom: 4, left: 8 };

function buildPath(
  points: readonly { readonly t: number; readonly value: number }[],
  max: number,
): string {
  if (points.length === 0) return "";
  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  return points
    .map((point, index) => {
      const x = PADDING.left + point.t * innerW;
      const ratio = max === 0 ? 0 : point.value / max;
      const y = PADDING.top + (1 - ratio) * innerH;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function WeekBurndownChart({
  burndown,
  className,
}: {
  readonly burndown: TeamWeekBurndown;
  readonly className?: string;
}) {
  const gradientId = useId();
  const max = Math.max(burndown.scope, 1);

  const scopePath = buildPath(
    burndown.points.map((point) => ({ t: point.t, value: point.scope })),
    max,
  );
  const idealPath = buildPath(
    burndown.points.map((point) => ({ t: point.t, value: point.ideal })),
    max,
  );
  const startedPath = buildPath(
    burndown.points.map((point) => ({ t: point.t, value: point.started })),
    max,
  );
  const completedPath = buildPath(
    burndown.points.map((point) => ({ t: point.t, value: point.completed })),
    max,
  );

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const startedArea = `${startedPath} L ${(PADDING.left + innerW).toFixed(2)} ${(
    PADDING.top + innerH
  ).toFixed(2)} L ${PADDING.left.toFixed(2)} ${(PADDING.top + innerH).toFixed(2)} Z`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <svg
        aria-hidden
        className="w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-amber-400)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-amber-400)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Started fill under the scope line. */}
        <path d={startedArea} fill={`url(#${gradientId})`} />

        {/* Ideal burndown guide. */}
        <path
          d={idealPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeDasharray="4 4"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />

        {/* Scope ceiling. */}
        <path
          d={scopePath}
          fill="none"
          stroke="var(--color-amber-500)"
          strokeLinecap="round"
          strokeWidth="2"
        />

        {/* Started line. */}
        <path
          d={startedPath}
          fill="none"
          stroke="var(--color-amber-400)"
          strokeLinecap="round"
          strokeWidth="2"
        />

        {/* Completed line. */}
        <path
          d={completedPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </svg>

      <div className="flex items-center justify-between px-1 text-[11px] tabular-nums text-muted-foreground">
        {burndown.axisLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
