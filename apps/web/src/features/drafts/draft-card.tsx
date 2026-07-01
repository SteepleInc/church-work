import type { MouseEvent } from "react";
import { Trash2Icon } from "lucide-react";

import type { TaskDraft } from "@church-work/zero";

import { WorkflowStatusIcon } from "@/components/tasks/task-card-fields";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatActivityTime } from "@/features/details-pane/task-activity-feed-utils";
import { useWorkflowStatusMeta } from "@/data/workflows/workflowsData.app";
import { cn } from "@/lib/utils";

const DESCRIPTION_PLACEHOLDER = "Add description...";

/**
 * A single Task Draft, rendered Linear-style: the Workflow Status icon leads a
 * bold title with a relative "edited" timestamp trailing it on one line, and
 * the description sits below. The discard affordance stays hidden until the
 * card is hovered or keyboard-focused, then reveals a destructive trash button.
 */
export function DraftCard({
  taskDraft,
  churchId,
  onDiscard,
  onOpen,
}: {
  readonly taskDraft: TaskDraft;
  readonly churchId: string | null;
  readonly onDiscard: (draftId: string) => void;
  readonly onOpen: (draftId: string) => void;
}) {
  const title = taskDraft.title?.trim() || "Untitled draft";
  const description = taskDraft.description?.trim();

  const status = useWorkflowStatusMeta({
    churchId,
    statusId: taskDraft.workflow_status_id ?? null,
  });

  const editedAtMs = taskDraft.updated_at ?? taskDraft.created_at ?? null;
  const editedLabel = editedAtMs !== null ? formatActivityTime(editedAtMs, Date.now()) : null;
  const editedTitle = editedAtMs !== null ? new Date(editedAtMs).toLocaleString() : undefined;

  function handleDiscard(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onDiscard(taskDraft.draft_id);
  }

  return (
    <article
      className="group relative cursor-pointer rounded-xl border bg-card p-4 shadow-xs ring-foreground/5 transition-colors hover:bg-accent/30 hover:ring-1"
      onClick={() => onOpen(taskDraft.draft_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(taskDraft.draft_id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Discard draft"
              className="absolute top-3 right-3 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              onClick={handleDiscard}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <Trash2Icon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Discard draft</TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 items-center gap-2 pr-8">
        {status ? (
          <span className="flex size-4 shrink-0 items-center justify-center">
            <WorkflowStatusIcon className="size-3.5" taskState={status.taskState} />
          </span>
        ) : null}
        <h2 className="min-w-0 truncate font-medium text-card-foreground text-sm">{title}</h2>
        {editedLabel ? (
          <span className="shrink-0 text-muted-foreground text-xs" title={editedTitle}>
            {editedLabel}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-sm",
          description ? "text-muted-foreground" : "text-muted-foreground/60",
        )}
      >
        {description || DESCRIPTION_PLACEHOLDER}
      </p>
    </article>
  );
}
