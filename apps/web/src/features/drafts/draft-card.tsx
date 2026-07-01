import type { MouseEvent, ReactNode } from "react";
import { CalendarIcon, TagIcon, Trash2Icon, Triangle, UsersIcon } from "lucide-react";

import type { TaskDraft } from "@church-work/zero";

import { AssigneeAvatar } from "@/components/tasks/task-card-fields";
import {
  formatDueDate,
  getEstimateMeta,
  getPriorityMeta,
  WorkflowStatusIcon,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLabelName } from "@/data/labels/labelsData.app";
import { useTeamName } from "@/data/teams/teamData.app";
import { getUserDisplayName } from "@/data/users/usersData.app";
import { useUserOpt } from "@/data/users/userData.app";
import { useWorkflowStatusMeta } from "@/data/workflows/workflowsData.app";
import { cn } from "@/lib/utils";

const DESCRIPTION_PLACEHOLDER = "No description";

/**
 * A single Task Draft, rendered with the same product chrome the live Task
 * surfaces use — Workflow Status icon, priority signal, estimate triangle,
 * Label dots and assignee avatar — so a saved draft reads as the Task it will
 * become. The discard affordance stays hidden until the card is hovered or
 * keyboard-focused (Linear-style), then reveals a destructive trash button.
 */
export function DraftCard({
  taskDraft,
  churchId,
  onDiscard,
}: {
  readonly taskDraft: TaskDraft;
  readonly churchId: string | null;
  readonly onDiscard: (draftId: string) => void;
}) {
  const title = taskDraft.title?.trim() || "Untitled draft";
  const description = taskDraft.description?.trim();

  const status = useWorkflowStatusMeta({
    churchId,
    statusId: taskDraft.workflow_status_id ?? null,
  });
  const teamName = useTeamName({ churchId, teamId: taskDraft.team_id ?? null });
  const { userOpt } = useUserOpt({
    churchId,
    userId: taskDraft.assigned_user_id ?? "__no_user__",
  });

  const priority = (taskDraft.priority ?? null) as TaskPriority | null;
  const priorityMeta = priority && priority !== "no_priority" ? getPriorityMeta(priority) : null;
  const PriorityIcon = priorityMeta?.icon;

  const estimate = (taskDraft.estimate ?? null) as TaskEstimate | null;
  const estimateMeta = estimate && estimate !== "no_estimate" ? getEstimateMeta(estimate) : null;

  const dueDate = formatDueDate(taskDraft.due_date);
  const labelIds = parseLabelIds(taskDraft.label_ids);

  const assigneeLabel = userOpt ? getUserDisplayName(userOpt) : "Assignee";

  const hasMeta =
    priorityMeta !== null ||
    status !== null ||
    estimateMeta !== null ||
    dueDate !== null ||
    Boolean(teamName) ||
    Boolean(taskDraft.assigned_user_id) ||
    labelIds.length > 0;

  function handleDiscard(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onDiscard(taskDraft.draft_id);
  }

  return (
    <article className="group relative rounded-xl border bg-card p-4 shadow-xs ring-foreground/5 transition-colors hover:bg-accent/30 hover:ring-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Discard draft"
              className="absolute top-3 right-3 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              onClick={handleDiscard}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <Trash2Icon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Discard draft</TooltipContent>
      </Tooltip>

      <div className="flex items-start gap-2 pr-8">
        {status ? (
          <span className="flex size-5 shrink-0 items-center justify-center pt-px">
            <WorkflowStatusIcon className="size-3.5" taskState={status.taskState} />
          </span>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate font-medium text-card-foreground text-sm">
          {title}
        </h2>
      </div>

      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-sm",
          description ? "text-muted-foreground" : "text-muted-foreground/60 italic",
        )}
      >
        {description || DESCRIPTION_PLACEHOLDER}
      </p>

      {hasMeta ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {priorityMeta && PriorityIcon ? (
            <ChipShell>
              <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
              <span>{priorityMeta.label}</span>
            </ChipShell>
          ) : null}

          {status ? (
            <ChipShell>
              <WorkflowStatusIcon className="size-3.5" taskState={status.taskState} />
              <span>{status.name}</span>
            </ChipShell>
          ) : null}

          {estimateMeta?.short ? (
            <ChipShell>
              <Triangle className="size-3.5" />
              <span>{estimateMeta.short}</span>
            </ChipShell>
          ) : null}

          {dueDate ? (
            <ChipShell>
              <CalendarIcon className="size-3.5" />
              <span>{dueDate}</span>
            </ChipShell>
          ) : null}

          {teamName ? (
            <ChipShell>
              <UsersIcon className="size-3.5" />
              <span>{teamName}</span>
            </ChipShell>
          ) : null}

          {labelIds.map((labelId) => (
            <DraftLabelChip churchId={churchId} key={labelId} labelId={labelId} />
          ))}

          {taskDraft.assigned_user_id ? (
            <span className="flex size-6 items-center justify-center">
              <AssigneeAvatar
                assignee={{ id: taskDraft.assigned_user_id, label: assigneeLabel }}
                size={20}
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** A Label chip that resolves its own name through the Label by-id query. */
function DraftLabelChip({
  churchId,
  labelId,
}: {
  readonly churchId: string | null;
  readonly labelId: string;
}) {
  const name = useLabelName({ churchId, labelId });
  if (!name) return null;
  return (
    <ChipShell>
      <TagIcon className="size-3.5" />
      <span>{name}</span>
    </ChipShell>
  );
}

function ChipShell({ children }: { readonly children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-1.5 text-muted-foreground text-xs">
      {children}
    </span>
  );
}

function parseLabelIds(raw: string | null | undefined): readonly string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}
