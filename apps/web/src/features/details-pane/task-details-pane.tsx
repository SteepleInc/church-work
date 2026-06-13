import { useEffect } from "react";
import { Tag } from "lucide-react";

import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useLabelsCollection } from "@/data/labels/labelsData.app";
import { useTaskByIdentifier } from "@/data/tasks/taskData.app";
import { useUpdateTaskMutation } from "@/data/tasks/tasksData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { useWorkflowStatusesCollection } from "@/data/workflows/workflowsData.app";
import {
  DetailItem,
  DetailSection,
  DetailSectionSkeleton,
} from "@/components/details-pane/details-components";
import { useChangeDetailsPaneId } from "@/components/details-pane/details-pane-helpers";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { labelDotClassName, LabelsComboboxSelector } from "@/components/tasks/task-card-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TaskDetailsPane({ identifier }: { readonly identifier: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const { taskOpt: task, loading: taskLoading } = useTaskByIdentifier({
    churchId: activeChurch?.id ?? null,
    identifier,
  });
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const users = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId: activeChurch?.id ?? null });
  const labels = useLabelsCollection({ churchId: activeChurch?.id ?? null });
  const updateTask = useUpdateTaskMutation();
  const team = teams.teamsCollection.find((candidate) => candidate.id === task?.teamId) ?? null;
  const assignee = users.usersCollection.find((candidate) => candidate.id === task?.assignedUserId);
  const workflowStatus = workflowStatuses.workflowStatusesCollection.find(
    (candidate) => candidate.id === task?.workflowStatusId,
  );
  const loading = orgLoading || taskLoading;
  const changeDetailsPaneId = useChangeDetailsPaneId();
  const canonicalIdentifier = task?.identifier ?? null;

  // URL normalization (ADR 0013): a lowercase or retired identifier resolves,
  // then the URL state is rewritten to the canonical current uppercase
  // identifier so the address bar always shows the canonical reference.
  useEffect(() => {
    if (canonicalIdentifier !== null && canonicalIdentifier !== identifier) {
      changeDetailsPaneId(canonicalIdentifier).forceNav();
    }
  }, [canonicalIdentifier, changeDetailsPaneId, identifier]);

  // Church Labels plus the Task's Team's Labels are applicable here
  // (see CONTEXT.md "Team Label").
  const applicableLabels = labels.labelsCollection.filter(
    (label) => label.teamId === null || label.teamId === task?.teamId,
  );
  const taskLabels = (task?.labelIds ?? [])
    .map((labelId) => labels.labelsCollection.find((label) => label.id === labelId))
    .filter((label) => label !== undefined);

  return (
    <DetailsShell
      topBarButtons={<p className="text-sm text-muted-foreground">Task details</p>}
      header={
        <>
          <h2 className="font-semibold text-lg">{task?.title ?? "Task"}</h2>
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : task ? (
            // The Task Identifier (e.g. "PRD-48") is the user-facing
            // reference, not the database id (ADR 0013).
            <p className="text-sm text-muted-foreground">{task.identifier}</p>
          ) : null}
        </>
      }
      content={
        task ? (
          <DetailSection title="Overview">
            <DetailItem label="State" value={task.taskState} />
            <DetailItem
              label="Workflow Status"
              value={workflowStatus?.name ?? task.workflowStatusId}
            />
            <DetailItem label="Due Date" value={task.dueDate ?? "No due date"} />
            {task.description ? <DetailItem label="Description" value={task.description} /> : null}
            <DetailItem label="Team" value={team?.name ?? ""} />
            <DetailItem
              label="Assignee"
              value={assignee?.name ?? assignee?.email ?? "Unassigned"}
            />
            <DetailItem
              label="Labels"
              value={
                activeChurch ? (
                  <LabelsComboboxSelector
                    onValueChange={(next) =>
                      void updateTask({
                        churchId: activeChurch.id,
                        actorUserId: activeChurch.currentUserId,
                        taskId: task.id,
                        fields: { labelIds: [...next] },
                      })
                    }
                    options={applicableLabels}
                    trigger={
                      taskLabels.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Tag className="size-3.5" />
                          Add labels
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {taskLabels.map((label) => (
                            <span className="flex items-center gap-1.5" key={label.id}>
                              <span
                                className={cn("size-2 rounded-full", labelDotClassName(label))}
                              />
                              {label.name}
                            </span>
                          ))}
                        </span>
                      )
                    }
                    value={task.labelIds ?? []}
                  />
                ) : null
              }
            />
          </DetailSection>
        ) : loading ? (
          <DetailSectionSkeleton rows={5} />
        ) : (
          // Graceful not-found pane state for unknown identifiers (ADR 0013).
          <p className="text-sm text-muted-foreground">
            No Task matches {identifier} in this Church.
          </p>
        )
      }
    />
  );
}
