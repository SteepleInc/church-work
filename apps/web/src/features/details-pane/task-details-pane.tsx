import { CalendarIcon, ChevronRight, Tag, Triangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTaskByIdentifier } from "@/data/tasks/taskData.app";
import { useTasksCollection, useUpdateTaskMutation } from "@/data/tasks/tasksData.app";
import { useTeamMembershipsCollection, useTeamsCollection } from "@/data/teams/teamsData.app";
import { getUserDisplayName, useChurchUsersCollection } from "@/data/users/usersData.app";
import { useWorkflowStatusesCollection } from "@/data/workflows/workflowsData.app";
import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { useChangeDetailsPaneId } from "@/components/details-pane/details-pane-helpers";
import { DetailsShell } from "@/components/details-pane/details-shell";
import {
  AssigneeAvatar,
  AssigneeComboboxSelector,
  DueDateSelector,
  EstimateComboboxSelector,
  formatDueDate,
  getEstimateMeta,
  getPriorityMeta,
  labelDotClassName,
  LabelsComboboxSelector,
  PriorityComboboxSelector,
  StatusComboboxSelector,
  TeamComboboxSelector,
  WorkflowStatusIcon,
  type TaskEstimate,
  type TaskPriority,
} from "@/components/tasks/task-card-fields";
import {
  isEditableTarget,
  matchPickerHotkey,
  statusOptions,
  type PickerHotkey,
} from "@/components/tasks/task-kanban-board-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Linear-style property pill used in the Task pane's fixed property band. The
 * trigger lives inside a picker, so the pill itself is purely presentational.
 * Borderless by default (Linear treats property chips as quiet ghost buttons),
 * tinted via `border` only when a value is set and we want it to read as active.
 */
function FieldPill({
  children,
  muted = false,
  bordered = false,
  className,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean;
  readonly bordered?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-2 font-medium text-[13px] transition-colors hover:bg-accent",
        bordered ? "border" : "border border-transparent",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small rounded-square avatar for the breadcrumb (matches the org switcher). */
function BreadcrumbOrgAvatar({ name }: { readonly name: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-[10px] text-primary-foreground">
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </span>
  );
}

export function TaskDetailsPane({ identifier }: { readonly identifier: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const currentUserId = activeChurch?.currentUserId ?? null;
  const { taskOpt: task, loading: taskLoading } = useTaskByIdentifier({
    churchId,
    identifier,
  });
  const teams = useTeamsCollection({ churchId });
  const teamMemberships = useTeamMembershipsCollection({ churchId });
  const users = useChurchUsersCollection({ churchId });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId });
  const labels = useLabelsCollection({ churchId });
  const allTasks = useTasksCollection({ churchId, currentUserId: null });
  const updateTask = useUpdateTaskMutation();

  const team = teams.teamsCollection.find((candidate) => candidate.id === task?.teamId) ?? null;
  const loading = orgLoading || taskLoading;
  const changeDetailsPaneId = useChangeDetailsPaneId();
  const canonicalIdentifier = task?.identifier ?? null;
  const churchName = activeChurch?.name ?? "Church";

  // Priority has no backend persistence yet (UI-only across the app), so it is
  // held as local pane state, keyed to the resolved Task.
  const [priority, setPriority] = useState<TaskPriority>("no_priority");
  useEffect(() => {
    setPriority("no_priority");
  }, [canonicalIdentifier]);

  // Locally-buffered title, committed to the Task on blur (Linear behavior).
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  useEffect(() => {
    setTitleDraft(null);
  }, [canonicalIdentifier]);

  // Picker openers for pane-level keyboard shortcuts (S/P/A/L/⇧E/D/T). Each
  // picker populates its ref with an open callback (same pattern as the Task
  // card's hover shortcuts); here they are always live while the pane is open.
  const statusOpenRef = useRef<(() => void) | null>(null);
  const priorityOpenRef = useRef<(() => void) | null>(null);
  const assigneeOpenRef = useRef<(() => void) | null>(null);
  const labelsOpenRef = useRef<(() => void) | null>(null);
  const estimateOpenRef = useRef<(() => void) | null>(null);
  const dueDateOpenRef = useRef<(() => void) | null>(null);
  const teamOpenRef = useRef<(() => void) | null>(null);

  const pickerHotkeys = useMemo<readonly PickerHotkey[]>(
    () => [
      { key: "s", openRef: statusOpenRef },
      { key: "p", openRef: priorityOpenRef },
      { key: "a", openRef: assigneeOpenRef },
      { key: "l", openRef: labelsOpenRef },
      { key: "e", shift: true, openRef: estimateOpenRef },
      { key: "d", openRef: dueDateOpenRef },
      { key: "t", openRef: teamOpenRef },
    ],
    [],
  );

  // While the pane is open the field shortcuts are always live (no hover gate,
  // unlike the board cards). A capture-phase listener runs before the board's
  // surface-keyboard handler so an open pane wins even when a card behind it is
  // still focused. Typing in the title/description is left untouched.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const match = matchPickerHotkey(event, pickerHotkeys);
      const opener = match?.openRef.current;
      if (!opener) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opener();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [pickerHotkeys]);

  // URL normalization (ADR 0013): a lowercase or retired identifier resolves,
  // then the URL state is rewritten to the canonical current uppercase
  // identifier so the address bar always shows the canonical reference.
  useEffect(() => {
    if (canonicalIdentifier !== null && canonicalIdentifier !== identifier) {
      changeDetailsPaneId(canonicalIdentifier).forceNav();
    }
  }, [canonicalIdentifier, changeDetailsPaneId, identifier]);

  if (!task) {
    return (
      <DetailsShell
        topBarButtons={<TaskBreadcrumb churchName={churchName} identifier={identifier} title="" />}
        headerBand={
          loading ? (
            <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-7 w-24 rounded-md" key={index} />
              ))}
            </div>
          ) : undefined
        }
        content={
          loading ? (
            <TaskDetailsSkeleton />
          ) : (
            // Graceful not-found pane state for unknown identifiers (ADR 0013).
            <p className="text-muted-foreground text-sm">
              No Task matches {identifier} in this Church.
            </p>
          )
        }
      />
    );
  }

  const statusItems = statusOptions(
    workflowStatuses.workflowStatusesCollection.filter(
      (status) => status.workflowId === task.workflowId,
    ),
  );
  const workflowStatus = workflowStatuses.workflowStatusesCollection.find(
    (candidate) => candidate.id === task.workflowStatusId,
  );

  const assigneeOptions = users.usersCollection.map((user) => ({
    id: user.id,
    label: getUserDisplayName(user),
  }));
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === task.assignedUserId) ?? null;
  const teamMemberIds = new Set(
    teamMemberships.teamMembershipsCollection
      .filter((membership) => membership.teamId === task.teamId)
      .map((membership) => membership.userId),
  );

  // Team picker data: every Church Team is selectable; the current user's
  // Teams are sectioned first ("Your teams") in the picker.
  const teamPickerOptions = teams.teamsCollection.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    color: (candidate.color ?? null) as string | null,
  }));
  const memberTeamIds = new Set(
    teamMemberships.teamMembershipsCollection
      .filter((membership) => membership.userId === currentUserId)
      .map((membership) => membership.teamId),
  );

  // Church Labels plus the Task's Team's Labels are applicable here
  // (see CONTEXT.md "Team Label").
  const applicableLabels = labels.labelsCollection.filter(
    (label) => label.teamId === null || label.teamId === task.teamId,
  );
  const taskLabels = (task.labelIds ?? [])
    .map((labelId) => labels.labelsCollection.find((label) => label.id === labelId))
    .filter((label) => label !== undefined);

  const estimateMeta = getEstimateMeta(task.estimate ?? "no_estimate");
  const priorityMeta = getPriorityMeta(priority);
  const PriorityIcon = priorityMeta.icon;
  const dueDateLabel = formatDueDate(task.dueDate);
  const cardState = task.taskState;

  const subTasks = task.isProjected
    ? []
    : allTasks.tasksCollection.filter((candidate) => candidate.parentTaskId === task.id);
  const parentTask = task.parentTaskId
    ? (allTasks.tasksCollection.find((candidate) => candidate.id === task.parentTaskId) ?? null)
    : null;

  const persist = (fields: Parameters<typeof updateTask>[0]["fields"]) => {
    if (!activeChurch || task.isProjected) return;
    void updateTask({
      churchId: activeChurch.id,
      actorUserId: activeChurch.currentUserId,
      taskId: task.id,
      fields,
    });
  };

  const titleValue = titleDraft ?? task.title;

  return (
    <DetailsShell
      topBarButtons={
        <TaskBreadcrumb churchName={churchName} identifier={task.identifier} title={task.title} />
      }
      headerBand={
        <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
          <StatusComboboxSelector
            disabled={statusItems.length === 0 || task.isProjected}
            emptyText="No statuses."
            onValueChange={(next) => {
              if (next) persist({ workflowStatusId: next });
            }}
            openRef={statusOpenRef}
            options={statusItems}
            trigger={
              <FieldPill bordered>
                <WorkflowStatusIcon className="size-3.5" taskState={cardState} />
                {workflowStatus?.name ?? "Status"}
              </FieldPill>
            }
            value={task.workflowStatusId}
          />

          <PriorityComboboxSelector
            onValueChange={setPriority}
            openRef={priorityOpenRef}
            trigger={
              <FieldPill bordered muted={priority === "no_priority"}>
                <PriorityIcon className={cn("size-3.5", priorityMeta.className)} />
                {priority === "no_priority" ? "Priority" : priorityMeta.label}
              </FieldPill>
            }
            value={priority}
          />

          <AssigneeComboboxSelector
            align="start"
            currentUserId={currentUserId}
            disabled={task.isProjected}
            onValueChange={(next) => persist({ assignedUserId: next })}
            openRef={assigneeOpenRef}
            options={assigneeOptions}
            teamMemberIds={teamMemberIds}
            trigger={
              <FieldPill bordered muted={selectedAssignee === null}>
                <AssigneeAvatar assignee={selectedAssignee} size={16} />
                {selectedAssignee?.label ?? "Assignee"}
              </FieldPill>
            }
            value={task.assignedUserId}
          />

          <LabelsComboboxSelector
            disabled={task.isProjected}
            onValueChange={(next) => persist({ labelIds: [...next] })}
            openRef={labelsOpenRef}
            options={applicableLabels}
            trigger={
              <FieldPill bordered muted={taskLabels.length === 0}>
                {taskLabels.length === 0 ? (
                  <>
                    <Tag className="size-3.5" />
                    Labels
                  </>
                ) : (
                  <>
                    <span className="-space-x-1 flex items-center">
                      {taskLabels.map((label) => (
                        <span
                          className={cn(
                            "size-2.5 rounded-full ring-2 ring-background",
                            labelDotClassName(label),
                          )}
                          key={label.id}
                        />
                      ))}
                    </span>
                    <span className="truncate">
                      {taskLabels.length === 1
                        ? taskLabels[0]?.name
                        : `${taskLabels.length} labels`}
                    </span>
                  </>
                )}
              </FieldPill>
            }
            value={task.labelIds ?? []}
          />

          <EstimateComboboxSelector
            disabled={task.isProjected}
            onValueChange={(next) => persist({ estimate: next === "no_estimate" ? null : next })}
            openRef={estimateOpenRef}
            trigger={
              <FieldPill bordered muted={(task.estimate ?? "no_estimate") === "no_estimate"}>
                <Triangle className="size-3.5" />
                {task.estimate ? estimateMeta.label : "Estimate"}
              </FieldPill>
            }
            value={(task.estimate ?? "no_estimate") as TaskEstimate}
          />

          <DueDateSelector
            disabled={task.isProjected}
            onValueChange={(next) => persist({ dueDate: next })}
            openRef={dueDateOpenRef}
            trigger={
              <FieldPill bordered muted={dueDateLabel === null}>
                <CalendarIcon className="size-3.5" />
                {dueDateLabel ?? "Due date"}
              </FieldPill>
            }
            value={task.dueDate}
          />

          {team ? (
            <TeamComboboxSelector
              disabled={task.isProjected}
              memberTeamIds={memberTeamIds}
              // The destination Team's Workflow takes over server-side: the
              // Task's Workflow Status resets to that Workflow's default and
              // foreign Team Labels drop out (see tasks.update mutator).
              onValueChange={(next) => persist({ teamId: next })}
              openRef={teamOpenRef}
              options={teamPickerOptions}
              trigger={
                <FieldPill bordered>
                  <TeamAvatar color={team.color} name={team.name} size={16} />
                  {team.name}
                </FieldPill>
              }
              value={team.id}
            />
          ) : null}
        </div>
      }
      contentClassName="gap-6 pt-6"
      content={
        <>
          {/* Title */}
          <textarea
            aria-label="Task title"
            className="field-sizing-content w-full resize-none bg-transparent font-semibold text-2xl leading-tight tracking-tight outline-none placeholder:text-muted-foreground disabled:cursor-default"
            disabled={task.isProjected}
            onBlur={() => {
              const next = titleValue.trim();
              if (next !== "" && next !== task.title) persist({ title: next });
              setTitleDraft(null);
            }}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            placeholder="Task title"
            rows={1}
            value={titleValue}
          />

          {/* Description */}
          {task.description ? (
            <p className="whitespace-pre-wrap break-words text-[15px] text-foreground/90 leading-relaxed">
              {task.description}
            </p>
          ) : (
            <p className="text-muted-foreground text-[15px]">Add a description...</p>
          )}

          {/* Parent context */}
          {parentTask ? (
            <section className="grid gap-2">
              <h3 className="font-medium text-muted-foreground text-xs">Parent</h3>
              <button
                className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-3 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => changeDetailsPaneId(parentTask.identifier).forceNav()}
                type="button"
              >
                <span className="shrink-0 font-medium text-muted-foreground text-xs">
                  {parentTask.identifier}
                </span>
                <span className="truncate">{parentTask.title}</span>
              </button>
            </section>
          ) : null}

          {/* Sub-issues */}
          {subTasks.length > 0 ? (
            <section className="grid gap-2">
              <h3 className="font-medium text-muted-foreground text-xs">
                Sub-issues
                <span className="ml-1.5 font-normal text-muted-foreground">{subTasks.length}</span>
              </h3>
              <div className="grid gap-1.5">
                {subTasks.map((subTask) => {
                  const subStatus = workflowStatuses.workflowStatusesCollection.find(
                    (candidate) => candidate.id === subTask.workflowStatusId,
                  );
                  return (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-3 text-left text-sm transition-colors hover:bg-accent"
                      key={subTask.id}
                      onClick={() => changeDetailsPaneId(subTask.identifier).forceNav()}
                      type="button"
                    >
                      <WorkflowStatusIcon
                        className="size-3.5 shrink-0"
                        taskState={subStatus?.taskState ?? subTask.taskState}
                      />
                      <span className="shrink-0 font-medium text-muted-foreground text-xs">
                        {subTask.identifier}
                      </span>
                      <span className="truncate">{subTask.title}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      }
    />
  );
}

function TaskBreadcrumb({
  churchName,
  identifier,
  title,
}: {
  readonly churchName: string;
  readonly identifier: string;
  readonly title: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <BreadcrumbOrgAvatar name={churchName} />
      <span className="hidden shrink-0 text-muted-foreground sm:inline">
        {churchName.length > 6 ? `${churchName.slice(0, 6)}...` : churchName}
      </span>
      <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:inline" />
      <span className="shrink-0 font-medium text-muted-foreground">{identifier}</span>
      {title ? <span className="min-w-0 truncate text-foreground/80">{title}</span> : null}
    </div>
  );
}

function TaskDetailsSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-3/4" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </>
  );
}
