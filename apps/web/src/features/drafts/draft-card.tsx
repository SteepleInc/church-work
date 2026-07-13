import type { MouseEvent } from "react";
import { ListTreeIcon, Trash2Icon } from "lucide-react";

import type { TaskDraft } from "@church-work/zero";

import { commentValueToPlainText } from "@/components/editor/comment-value";
import {
  TaskAssigneePillTrigger,
  TaskDueDatePillTrigger,
  TaskEstimatePillTrigger,
  TaskLabelsPillTrigger,
  TaskPriorityPillTrigger,
  TaskPropertyPill,
  TaskStatusPillTrigger,
  TaskTeamPillTrigger,
  WorkflowStatusIcon,
  type TaskLabelOption,
} from "@/components/tasks/task-card-fields";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatActivityTime } from "@/features/details-pane/task-activity-feed-utils";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTask } from "@/data/tasks/taskData.app";
import { useTeamData } from "@/data/teams/teamData.app";
import { useUserOpt } from "@/data/users/userData.app";
import { getUserDisplayName } from "@/data/users/usersData.app";
import { useWorkflowStatusMeta } from "@/data/workflows/workflowsData.app";
import {
  normalizeDraftEstimate,
  normalizeDraftPriority,
  parseDraftLabelIds,
} from "@/features/drafts/task-draft-values";
import { cn } from "@/lib/utils";

const DESCRIPTION_PLACEHOLDER = "Add description...";

/**
 * A single Task Draft, rendered Linear-style: the Workflow Status icon leads a
 * bold title with a relative "edited" timestamp trailing it on one line, and
 * the description sits below. A row of compact property pills — one for every
 * field the Draft carries a value for — matches the create-Task composer's
 * pills, so the card previews exactly what was already chosen. The discard
 * affordance stays hidden until the card is hovered or keyboard-focused, then
 * reveals a destructive trash button.
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
  const title = taskDraft.title?.trim() || "Untitled";
  // Draft descriptions share the Task description storage format (serialized
  // Plate JSON), so flatten to plain text for the card preview — never show
  // the raw JSON. Mentions render as their label (`@Jane`, `DEV-12`).
  const description = commentValueToPlainText(taskDraft.description);

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
      className="group relative cursor-pointer rounded-xl border bg-card p-4 shadow-xs ring-foreground/5 transition-colors outline-none hover:bg-accent/30 hover:ring-1 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

      <DraftCardPills churchId={churchId} taskDraft={taskDraft} />
    </article>
  );
}

/**
 * The row of read-only property pills for a Draft card. Each pill mirrors the
 * create-Task composer's picker chrome (same `*PillTrigger` components) but is
 * non-interactive here — clicking the card opens the composer, where the real
 * pickers live. A pill renders only when the Draft carries a value for that
 * field; a Draft with no properties set renders no pills (and no row).
 */
function DraftCardPills({
  taskDraft,
  churchId,
}: {
  readonly taskDraft: TaskDraft;
  readonly churchId: string | null;
}) {
  const statusMeta = useWorkflowStatusMeta({
    churchId,
    statusId: taskDraft.workflow_status_id ?? null,
  });
  const { teamOpt } = useTeamData({
    churchId: taskDraft.team_id ? churchId : null,
    teamId: taskDraft.team_id ?? "__no_team__",
  });
  const { userOpt } = useUserOpt({
    churchId: taskDraft.assigned_user_id ? churchId : null,
    userId: taskDraft.assigned_user_id ?? "__no_user__",
  });
  const { labelsCollection } = useLabelsCollection({
    churchId: taskDraft.label_ids && taskDraft.label_ids !== "[]" ? churchId : null,
  });
  const { taskOpt: parentTask } = useTask({
    churchId: taskDraft.parent_task_id ? churchId : null,
    taskId: taskDraft.parent_task_id ?? "__no_parent_task__",
  });

  const priority = normalizeDraftPriority(taskDraft.priority);
  const estimate = normalizeDraftEstimate(taskDraft.estimate);
  const labelIds = parseDraftLabelIds(taskDraft.label_ids);
  const selectedLabels: readonly TaskLabelOption[] = labelIds
    .map((id) => labelsCollection.find((label) => label.id === id))
    .filter((label): label is (typeof labelsCollection)[number] => label !== undefined)
    .map((label) => ({ id: label.id, name: label.name, color: label.color }));

  const hasStatus = taskDraft.workflow_status_id != null && statusMeta !== null;
  const hasTeam = taskDraft.team_id != null && teamOpt !== null;
  const hasAssignee = taskDraft.assigned_user_id != null && userOpt !== null;
  const hasPriority = priority !== "no_priority";
  const hasEstimate = estimate !== "no_estimate";
  const hasLabels = selectedLabels.length > 0;
  const hasDueDate = taskDraft.due_date != null;
  const hasParentTask = taskDraft.parent_task_id != null && parentTask !== null;

  const hasAnyPill =
    hasStatus ||
    hasPriority ||
    hasTeam ||
    hasAssignee ||
    hasEstimate ||
    hasLabels ||
    hasDueDate ||
    hasParentTask;
  if (!hasAnyPill) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {hasStatus ? (
        <TaskStatusPillTrigger
          status={{
            id: taskDraft.workflow_status_id as string,
            name: statusMeta.name,
            taskState: statusMeta.taskState,
          }}
        />
      ) : null}
      {hasPriority ? <TaskPriorityPillTrigger value={priority} /> : null}
      {hasTeam ? (
        <TaskTeamPillTrigger
          team={{ id: teamOpt.id, name: teamOpt.name, color: teamOpt.color ?? null }}
        />
      ) : null}
      {hasAssignee ? (
        <TaskAssigneePillTrigger
          assignee={{ id: userOpt.id, label: getUserDisplayName(userOpt) }}
        />
      ) : null}
      {hasEstimate ? <TaskEstimatePillTrigger value={estimate} /> : null}
      {hasLabels ? <TaskLabelsPillTrigger labels={selectedLabels} showEmptyIcon={false} /> : null}
      {hasDueDate ? <TaskDueDatePillTrigger value={taskDraft.due_date ?? null} /> : null}
      {hasParentTask ? (
        // Mirrors the composer header's subtask lineage pill (Identifier +
        // title) in the shared property pill chrome.
        <TaskPropertyPill
          aria-label={`Subtask of ${parentTask.identifier} ${parentTask.title}`}
          className="max-w-56"
          muted
          title={`${parentTask.identifier} ${parentTask.title}`}
        >
          <ListTreeIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="shrink-0">{parentTask.identifier}</span>
          <span className="truncate text-muted-foreground/80">{parentTask.title}</span>
        </TaskPropertyPill>
      ) : null}
    </div>
  );
}
