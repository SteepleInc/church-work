import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";
import { useWorkflowsCollection } from "@/data/workflows/workflowsData.app";
import { DetailItem, DetailSection } from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";

export function TeamDetailsPane({ teamId }: { readonly teamId: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const workflows = useWorkflowsCollection({ churchId: activeChurch?.id ?? null });
  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;
  const defaultWorkflow = workflows.workflowsCollection.find(
    (candidate) => candidate.id === team?.defaultWorkflowId,
  );
  const loading = orgLoading || teams.loading;

  return (
    <DetailsShell
      topBarButtons={<p className="text-sm text-muted-foreground">Team details</p>}
      header={
        <>
          <h2 className="font-semibold text-lg">{team?.name ?? "Team"}</h2>
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : teamId}</p>
        </>
      }
      content={
        team ? (
          <DetailSection title="Overview">
            <DetailItem label="Name" value={team.name} />
            <DetailItem
              label="Default Workflow"
              value={defaultWorkflow?.name ?? "Church default"}
            />
            <DetailItem label="Sort Order" value={team.sortOrder} />
          </DetailSection>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading Team details..." : "Team details are unavailable."}
          </p>
        )
      }
    />
  );
}
