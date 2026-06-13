import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useWorkflowsCollection } from "@/data/workflows/workflowsData.app";
import {
  DetailItem,
  DetailSection,
  DetailSectionSkeleton,
} from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamDetailsPane({ teamId }: { readonly teamId: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const workflows = useWorkflowsCollection({ churchId: activeChurch?.id ?? null });
  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;
  // Every Team owns its Workflow (ADR 0013).
  const teamWorkflow = workflows.workflowsCollection.find(
    (candidate) => candidate.teamId === teamId && candidate.archivedAt === null,
  );
  const loading = orgLoading || teams.loading;

  return (
    <DetailsShell
      topBarButtons={<p className="text-sm text-muted-foreground">Team details</p>}
      header={
        <>
          <h2 className="font-semibold text-lg">{team?.name ?? "Team"}</h2>
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p className="text-sm text-muted-foreground">{team?.identifier ?? teamId}</p>
          )}
        </>
      }
      content={
        team ? (
          <DetailSection title="Overview">
            <DetailItem label="Name" value={team.name} />
            <DetailItem label="Identifier" value={team.identifier} />
            <DetailItem label="Workflow" value={teamWorkflow?.name ?? "Not seeded"} />
            <DetailItem label="Sort Order" value={team.sortOrder} />
          </DetailSection>
        ) : loading ? (
          <DetailSectionSkeleton rows={3} />
        ) : (
          <p className="text-sm text-muted-foreground">Team details are unavailable.</p>
        )
      }
    />
  );
}
