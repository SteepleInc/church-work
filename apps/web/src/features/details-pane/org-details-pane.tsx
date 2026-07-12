import { useOrgData } from "@/data/orgs/orgData.app";
import { useAdminOrgData } from "@/data/orgs/orgsData.app";
import type { DetailsPaneOrg } from "@/components/details-pane/details-pane-types";
import {
  DetailItem,
  DetailSection,
  DetailSectionSkeleton,
} from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FREE_PLAN_TASK_LIMIT, FREE_PLAN_TASK_USAGE_NOTICE_THRESHOLD } from "@church-work/domain";

import { formatCreatedAt, formatDisplayUrl } from "@/data/orgs/orgsCollectionDef";
import { formatBillingDate, graceDaysLeft } from "@/features/billing/billing-helpers";
import { ChurchPlanBadge, SubscriptionStatusBadge } from "@/features/billing/subscription-badges";
import type { AdminChurchBilling, OrgCollectionItem } from "@/data/orgs/orgsData.app";
import { OrgActions } from "@/features/actions/orgActions";
import { cn } from "@/lib/utils";

export function OrgDetailsPane({
  orgId,
  tab,
}: {
  readonly orgId: string;
  readonly tab: DetailsPaneOrg["tab"];
}) {
  const userOrgData = useOrgData({ orgId });
  const adminOrgData = useAdminOrgData({ orgId });
  const org = adminOrgData.orgOpt ?? userOrgData.orgOpt;
  const loading = adminOrgData.orgOpt ? adminOrgData.loading : userOrgData.loading;

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
            {loading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <p className="text-muted-foreground text-sm">{org?.slug ?? orgId}</p>
            )}
          </div>
        </div>
      }
      tabBar={<OrgDetailsTabBar activeTab={tab} />}
      content={
        org ? (
          <OrgDetailsContent org={org} />
        ) : loading ? (
          <DetailSectionSkeleton />
        ) : (
          <p className="text-sm text-muted-foreground">Church details are unavailable.</p>
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

      {org.billing ? <BillingSection billing={org.billing} /> : null}

      <DetailSection title="Created">
        <DetailItem label="Created At" value={formatCreatedAt(org.createdAt)} />
      </DetailSection>
    </>
  );
}

/**
 * Read-only App Administration billing summary for a Church: plan, Stripe
 * subscription lifecycle, Payment Grace Period, and Task Usage. Rendered only
 * when the App Administrator data path supplies billing state. This is a
 * support view — Stripe stays the operational control plane, so there are no
 * payment details and no billing actions here.
 */
function BillingSection({ billing }: { readonly billing: AdminChurchBilling }) {
  const summary = getBillingLifecycleSummary(billing);

  return (
    <DetailSection title="Billing">
      <DetailItem
        label="Plan"
        value={
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <ChurchPlanBadge plan={billing.plan} />
              <SubscriptionStatusBadge
                cancelAtPeriodEnd={billing.cancelAtPeriodEnd}
                status={billing.status}
              />
            </div>
            <p className="text-muted-foreground text-xs">{summary}</p>
          </div>
        }
      />
      <DetailItem
        label="Task Usage"
        value={
          <TaskUsageValue isPaid={billing.plan === "Paid"} taskUsage={billing.taskUsage ?? 0} />
        }
      />
      <BillingDateItem label="Renewal / Period End" value={billing.periodEnd} />
      <BillingDateItem label="Scheduled Cancellation" value={billing.cancelAt} />
      <BillingDateItem
        label="Payment Grace Period Ends"
        suffix={
          billing.status === "past_due" && billing.graceEndsAt != null
            ? formatGraceDaysLeft(billing.graceEndsAt)
            : null
        }
        value={billing.graceEndsAt}
      />
      <BillingDateItem label="Canceled At" value={billing.canceledAt} />
      <BillingDateItem label="Ended At" value={billing.endedAt} />
      <p className="text-muted-foreground text-xs">
        Read-only — subscription changes and payment recovery are handled in Stripe.
      </p>
    </DetailSection>
  );
}

/**
 * One supportable sentence describing where this Church Subscription sits in
 * its lifecycle, in the same language as the Church Billing settings screen.
 */
function getBillingLifecycleSummary(billing: AdminChurchBilling): string {
  if (billing.status === null) {
    return "No Stripe subscription on record — Free is the default plan, no card required.";
  }

  if (billing.status === "past_due") {
    if (billing.graceEndsAt === null) {
      return "Payment past due.";
    }

    if (billing.plan === "Paid") {
      const daysLeft = graceDaysLeft(billing.graceEndsAt);

      return `Payment past due — Payment Grace Period runs through ${formatBillingDate(billing.graceEndsAt)}${daysLeft > 0 ? ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)` : ""}.`;
    }

    return `Payment Grace Period ended ${formatBillingDate(billing.graceEndsAt)} — Free Plan limits apply. Nothing was deleted or hidden.`;
  }

  if (billing.endedAt !== null) {
    return `Subscription ended ${formatBillingDate(billing.endedAt)} — this Church is on the Free Plan.`;
  }

  if (billing.cancelAtPeriodEnd && billing.periodEnd !== null) {
    return `Cancellation scheduled — Paid access ends ${formatBillingDate(billing.periodEnd)}, then this Church returns to the Free Plan.`;
  }

  if (billing.plan === "Paid" && billing.periodEnd !== null) {
    return `Renews ${formatBillingDate(billing.periodEnd)}.`;
  }

  return "Managed in Stripe.";
}

/**
 * Task Usage against the Free Plan Task Limit, with the same amber-approaching
 * and destructive-at-limit meter tones as the in-app Task Usage card. Paid
 * Churches show the count without a limit — there is no Task limit to meter.
 */
function TaskUsageValue({
  isPaid,
  taskUsage,
}: {
  readonly isPaid: boolean;
  readonly taskUsage: number;
}) {
  if (isPaid) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="tabular-nums">{taskUsage}</span>
        <span className="text-muted-foreground text-xs">
          Counted Tasks in the Active Planning Horizon — no Task limit on the Paid Plan.
        </span>
      </div>
    );
  }

  const atLimit = taskUsage >= FREE_PLAN_TASK_LIMIT;
  const approaching = taskUsage > FREE_PLAN_TASK_USAGE_NOTICE_THRESHOLD;
  const percent = Math.min(100, Math.round((taskUsage / FREE_PLAN_TASK_LIMIT) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="tabular-nums">
        {taskUsage} of {FREE_PLAN_TASK_LIMIT}
        {atLimit ? <span className="text-destructive"> — Task creation paused</span> : null}
      </span>
      <div
        aria-label="Free Plan Task Usage"
        aria-valuemax={FREE_PLAN_TASK_LIMIT}
        aria-valuemin={0}
        aria-valuenow={taskUsage}
        aria-valuetext={`${taskUsage} of ${FREE_PLAN_TASK_LIMIT} Tasks`}
        className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-foreground/10"
        role="meter"
      >
        <div
          className={cn(
            "h-full rounded-full",
            atLimit ? "bg-destructive" : approaching ? "bg-amber-500" : "bg-primary/60",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        Counted Tasks in the Active Planning Horizon.
      </span>
    </div>
  );
}

/**
 * A lifecycle date row that only exists when the date does. Most Churches are
 * Free with no subscription, so absent dates render nothing rather than a
 * wall of dashes — the lifecycle summary sentence already narrates the state.
 */
function BillingDateItem({
  label,
  value,
  suffix,
}: {
  readonly label: string;
  readonly value: number | null | undefined;
  readonly suffix?: string | null;
}) {
  if (value == null) return null;

  return (
    <DetailItem
      label={label}
      value={
        <span>
          {formatBillingDate(value)}
          {suffix ? <span className="text-muted-foreground"> · {suffix}</span> : null}
        </span>
      }
    />
  );
}

function formatGraceDaysLeft(graceEndsAt: number): string | null {
  const daysLeft = graceDaysLeft(graceEndsAt);

  return daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : "ends today";
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
