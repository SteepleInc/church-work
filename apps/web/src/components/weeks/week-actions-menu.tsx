import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatWeekDateRange } from "@/data/cycles/cyclesData.app";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import {
  Download,
  ExternalLink,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import {
  WEEK_ACTION_MENU_LABELS,
  buildWeekTasksCsv,
  getWeekCsvTasks,
  type WeekCsvTask,
} from "./week-actions-data";

const [exportTasksLabel, openInNewTabLabel, openInNewWindowLabel, copyLinkLabel] =
  WEEK_ACTION_MENU_LABELS;

export type WeekActionsMenuCycle = {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly name: string | null;
  readonly description: string | null;
};

export function WeekActionsMenu({
  churchId,
  cycle,
  tasks = [],
  trigger,
}: {
  readonly churchId: string;
  readonly cycle: WeekActionsMenuCycle;
  readonly tasks?: readonly WeekCsvTask[];
  // Optional custom trigger so callers can present the menu inline (e.g. a Week
  // header) while the default "⋯" button still works on its own.
  readonly trigger?: ReactElement;
}) {
  const { openEditWeek } = useQuickActionOpeners();

  const dateRange = formatWeekDateRange(cycle);
  const weekUrl = typeof window === "undefined" ? "" : window.location.href;
  const scopedTaskCount = getWeekCsvTasks({ cycleId: cycle.id, tasks }).length;
  const weekLabel = cycle.name?.trim() || dateRange;

  const editWeek = () => {
    // The menu closes on item click; defer the quick action open to the next
    // frame so the dropdown's own close handling (focus restore, outside-press
    // detection) settles first and doesn't immediately dismiss the dialog.
    requestAnimationFrame(() =>
      openEditWeek({
        churchId,
        cycleId: cycle.id,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        name: cycle.name,
        description: cycle.description,
      }),
    );
  };
  const exportTasks = () => {
    const csv = buildWeekTasksCsv({ cycleId: cycle.id, tasks });
    downloadCsv(csv, `week-${cycle.startDate}-tasks.csv`);
    toast.success(
      scopedTaskCount === 1
        ? "Exported 1 Task as CSV."
        : `Exported ${scopedTaskCount} Tasks as CSV.`,
    );
  };
  const openInNewTab = () => {
    if (!weekUrl) return;
    window.open(weekUrl, "_blank", "noopener,noreferrer");
  };
  const openInNewWindow = () => {
    if (!weekUrl) return;
    window.open(weekUrl, "_blank", "noopener,noreferrer,width=1280,height=900");
  };
  const copyLink = () => {
    if (!weekUrl) return;
    void navigator.clipboard?.writeText(weekUrl);
    toast.success("Link copied.");
  };

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger aria-label="Week actions" render={trigger} />
      ) : (
        <DropdownMenuTrigger
          aria-label="Week actions"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
      )}
      {/* Fan to the right (Linear's Cycle menu opens from the "⋯" toward the
          content), so the menu anchors its left edge to the trigger. */}
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="truncate">{weekLabel}</DropdownMenuLabel>

        <DropdownMenuItem onClick={editWeek}>
          <Pencil className="size-4" />
          Edit week name and description…
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={copyLink}>
          <LinkIcon className="size-4" />
          {copyLinkLabel}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={scopedTaskCount === 0} onClick={exportTasks}>
          <Download className="size-4" />
          <span className="truncate">{exportTasksLabel}…</span>
          {scopedTaskCount > 0 ? (
            <DropdownMenuShortcut className="tabular-nums">{scopedTaskCount}</DropdownMenuShortcut>
          ) : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={openInNewWindow}>
          <SquareArrowOutUpRight className="size-4" />
          {openInNewWindowLabel}
          <DropdownMenuShortcut>Ctrl ,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openInNewTab}>
          <ExternalLink className="size-4" />
          {openInNewTabLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
