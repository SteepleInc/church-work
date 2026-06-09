import { useOrgData } from "@/data/orgs/orgData.app";
import type { DetailsPaneOrg } from "@/components/details-pane/details-pane-types";
import { DetailItem, DetailSection } from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCreatedAt, formatDisplayUrl } from "@/data/orgs/orgsCollectionDef";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";
import { OrgActions } from "@/features/actions/orgActions";

export function OrgDetailsPane({
  orgId,
  tab,
}: {
  readonly orgId: string;
  readonly tab: DetailsPaneOrg["tab"];
}) {
  const { orgOpt: org, loading } = useOrgData({ orgId });

  return (
    <DetailsShell
      topBarButtons={<OrgTopBarButtons orgId={orgId} />}
      header={
        <div className="flex flex-row items-center gap-3">
          <BaseAvatar _tag="org" avatar={org?.logo} name={org?.name ?? "Church"} size={48} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="line-clamp-2 font-semibold text-lg leading-6">
              {org?.name ?? "Church"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {loading ? "Loading..." : (org?.slug ?? orgId)}
            </p>
          </div>
        </div>
      }
      tabBar={<OrgDetailsTabBar activeTab={tab} />}
      content={
        org ? (
          <OrgDetailsContent org={org} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading Church details..." : "Church details are unavailable."}
          </p>
        )
      }
    />
  );
}

function OrgTopBarButtons({ orgId }: { readonly orgId: string }) {
  return (
    <div className="flex items-center gap-2">
      <OrgActions orgId={orgId} mode="details-pane" />
      <Button disabled size="sm" type="button" variant="outline">
        Church details
      </Button>
      <span className="sr-only">Details for Church {orgId}</span>
    </div>
  );
}

function OrgDetailsTabBar({ activeTab }: { readonly activeTab: DetailsPaneOrg["tab"] }) {
  return (
    <Tabs className="relative z-10 flex flex-1 flex-row" value={activeTab}>
      <TabsList className="flex-1 justify-start">
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

type OrgDetailsContentProps = {
  readonly org: OrgCollectionItem;
};

function OrgDetailsContent({ org }: OrgDetailsContentProps) {
  const address = formatAddress(org);

  return (
    <>
      <DetailSection title="Overview">
        <DetailItem label="Name" value={org.name} />
        <DetailItem label="Slug" value={org.slug ?? "Not set"} />
        <DetailItem label="Church Time Zone" value={org.churchTimeZone ?? "Not set"} />
        <DetailItem
          label="Website"
          value={
            org.url ? (
              <a
                className="break-all text-primary hover:underline"
                href={org.url}
                rel="noreferrer"
                target="_blank"
              >
                {formatDisplayUrl(org.url)}
              </a>
            ) : (
              "Not set"
            )
          }
        />
      </DetailSection>

      <DetailSection title="Location / Address">
        <DetailItem label="Address" value={address ?? "No address"} />
        <DetailItem label="City" value={org.city ?? "Not set"} />
        <DetailItem label="State" value={org.state ?? "Not set"} />
        <DetailItem label="Country" value={org.countryCode ?? "Not set"} />
      </DetailSection>

      <DetailSection title="Size">
        <DetailItem
          label="Church Size"
          value={org.size ? <Badge variant="outline">{org.size}</Badge> : "Not specified"}
        />
        <DetailItem label="Teams" value={org.teamsCount ?? 0} />
      </DetailSection>

      <DetailSection title="Onboarding">
        <DetailItem
          label="Status"
          value={
            <Badge variant={org.completedOnboarding ? "default" : "outline"}>
              {org.completedOnboarding ? "Onboarding Complete" : "Onboarding Incomplete"}
            </Badge>
          }
        />
      </DetailSection>

      <DetailSection title="Members">
        <DetailItem label="Members" value={org.membersCount ?? 0} />
      </DetailSection>

      <DetailSection title="Created">
        <DetailItem label="Created At" value={formatCreatedAt(org.createdAt)} />
      </DetailSection>
    </>
  );
}

function formatAddress(org: {
  readonly street?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly zip?: string | null;
  readonly countryCode?: string | null;
}) {
  const parts = [org.street, org.city, org.state, org.zip, org.countryCode].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}
