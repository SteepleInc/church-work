import { useOrgData } from "@/data/orgs/orgData.app";
import { DetailItem, DetailSection } from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";

export function OrgDetailsPane({ orgId }: { readonly orgId: string }) {
  const { orgOpt: org, loading } = useOrgData({ orgId });

  return (
    <DetailsShell
      topBarButtons={<p className="text-sm text-muted-foreground">Church details</p>}
      header={
        <>
          <h2 className="font-semibold text-lg">{org?.name ?? "Church"}</h2>
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : orgId}</p>
        </>
      }
      content={
        org ? (
          <DetailSection title="Overview">
            <DetailItem label="Name" value={org.name} />
            <DetailItem label="Slug" value={org.slug ?? "Not set"} />
            <DetailItem label="Church Time Zone" value={org.churchTimeZone ?? "Not set"} />
            <DetailItem
              label="Onboarding"
              value={org.completedOnboarding ? "Complete" : "Incomplete"}
            />
          </DetailSection>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading Church details..." : "Church details are unavailable."}
          </p>
        )
      }
    />
  );
}
