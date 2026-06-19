import { PencilLine, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Source metadata for a Task that originates from a weekly service Template
 * Schedule — either projected (UI-only, not yet materialized) or materialized.
 * The colored dot is stable per Template Schedule so the same schedule reads
 * consistently across Cycle board and list surfaces.
 */
export type TemplateSourceBadgeData = {
  readonly scheduleName: string;
  readonly occurrenceLabel: string;
  readonly occurrenceDate: string | null;
  readonly occurrencePeriod: string | null;
  readonly periodLabel: string | null;
  readonly dotClassName: string;
};

/**
 * Native-looking source chip for Template-origin Tasks on Cycle board/list
 * surfaces. Mirrors the Label badge convention (outline badge, colored dot,
 * muted text) so it sits comfortably beside Team/Label/Due chips, while a
 * Tooltip carries the full Template Schedule name, occurrence, and period.
 */
export function TemplateSourceBadge({
  badge,
  className,
}: {
  readonly badge: TemplateSourceBadgeData;
  readonly className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            aria-label={`From Template Schedule ${badge.scheduleName}, ${badge.occurrenceLabel}`}
            className={cn("gap-1.5 text-muted-foreground", className)}
            variant="outline"
          >
            <Repeat2 aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/70" />
            <span className={cn("size-1.5 shrink-0 rounded-full", badge.dotClassName)} />
            <span className="truncate font-medium">{badge.scheduleName}</span>
            <span aria-hidden="true" className="text-muted-foreground/50">
              ·
            </span>
            <span className="whitespace-nowrap">{badge.occurrenceLabel}</span>
          </Badge>
        }
      />
      <TooltipContent className="flex flex-col items-start gap-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <span className={cn("size-1.5 shrink-0 rounded-full", badge.dotClassName)} />
          {badge.scheduleName}
        </span>
        <span className="text-background/70">
          {badge.occurrenceLabel}
          {badge.periodLabel ? ` · ${badge.periodLabel}` : ""}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Marks a projected Template Task whose planning fields have been edited for
 * this Cycle via a Cycle Adjustment. It stays a projection (the dashed ghost
 * treatment still applies); this chip just signals the occurrence differs from
 * the Template default until it materializes into a real Task.
 */
export function ProjectedAdjustedBadge({ className }: { readonly className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            aria-label="Adjusted for this Cycle"
            className={cn("gap-1 text-muted-foreground", className)}
            variant="outline"
          >
            <PencilLine aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/70" />
            <span className="font-medium">Adjusted</span>
          </Badge>
        }
      />
      <TooltipContent className="max-w-56">
        Edited for this Cycle. The Template default is unchanged; this projection keeps your changes
        until it becomes a real Task.
      </TooltipContent>
    </Tooltip>
  );
}
