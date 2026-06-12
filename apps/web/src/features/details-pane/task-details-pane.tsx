import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { useWorkflowStatusesCollection } from "@/data/workflows/workflowsData.app";
import {
  DetailItem,
  DetailSection,
  DetailSectionSkeleton,
} from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskDetailsPane({ taskId }: { readonly taskId: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const tasks = useTasksCollection({
    churchId: activeChurch?.id ?? null,
    currentUserId: activeChurch?.currentUserId ?? null,
    filters: { taskId },
  });
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const users = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const workflowStatuses = useWorkflowStatusesCollection({ churchId: activeChurch?.id ?? null });
  const task = tasks.tasksCollection.find((candidate) => candidate.id === taskId) ?? null;
  const team = teams.teamsCollection.find((candidate) => candidate.id === task?.teamId) ?? null;
  const assignee = users.usersCollection.find((candidate) => candidate.id === task?.assignedUserId);
  const workflowStatus = workflowStatuses.workflowStatusesCollection.find(
    (candidate) => candidate.id === task?.workflowStatusId,
  );
  const loading = orgLoading || tasks.loading;

  return (
    <DetailsShell
      topBarButtons={<p className="text-sm text-muted-foreground">Task details</p>}
      header={
        <>
          <h2 className="font-semibold text-lg">{task?.title ?? "Task"}</h2>
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p className="text-sm text-muted-foreground">{taskId}</p>
          )}
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
            <DetailItem label="Team" value={team?.name ?? "No Team"} />
            <DetailItem
              label="Assignee"
              value={assignee?.name ?? assignee?.email ?? "Unassigned"}
            />
          </DetailSection>
        ) : loading ? (
          <DetailSectionSkeleton rows={5} />
        ) : (
          <p className="text-sm text-muted-foreground">Task details are unavailable.</p>
        )
      }
    />
  );
}
