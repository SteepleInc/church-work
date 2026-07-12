import { describe, expect, test } from "bun:test";

const orgDetailsPaneSource = await Bun.file(
  new URL("./org-details-pane.tsx", import.meta.url),
).text();

describe("org details pane", () => {
  test("renders the PreachX-style org pane slots and detail sections", () => {
    expect(orgDetailsPaneSource).toContain("<DetailsShell");
    expect(orgDetailsPaneSource).toContain("useAdminOrgData({ orgId })");
    expect(orgDetailsPaneSource).toContain("topBarButtons={<OrgTopBarButtons orgId={orgId} />}");
    expect(orgDetailsPaneSource).toContain('<OrgActions orgId={orgId} mode="details-pane" />');
    expect(orgDetailsPaneSource).toContain("tabBar={<OrgDetailsTabBar activeTab={tab} />}");
    expect(orgDetailsPaneSource).toContain('title="Overview"');
    expect(orgDetailsPaneSource).toContain('title="Location / Address"');
    expect(orgDetailsPaneSource).toContain('title="Size"');
    expect(orgDetailsPaneSource).toContain('title="Onboarding"');
    expect(orgDetailsPaneSource).toContain('title="Members"');
    expect(orgDetailsPaneSource).toContain('title="Created"');
    expect(orgDetailsPaneSource).toContain('title="Billing"');
    expect(orgDetailsPaneSource).toContain('label="Task Usage"');
    expect(orgDetailsPaneSource).toContain('label="Payment Grace Period Ends"');
    expect(orgDetailsPaneSource).toContain('label="Scheduled Cancellation"');
    expect(orgDetailsPaneSource).toContain(
      "{org.billing ? <BillingSection billing={org.billing} /> : null}",
    );
    expect(orgDetailsPaneSource).toContain("<ChurchPlanBadge");
    expect(orgDetailsPaneSource).toContain("<SubscriptionStatusBadge");
    // Absent lifecycle dates render no row at all — no dash walls for the
    // common Free-with-no-subscription case.
    expect(orgDetailsPaneSource).toContain("if (value == null) return null;");
    expect(orgDetailsPaneSource).toContain(
      "aria-valuetext={`${taskUsage} of ${FREE_PLAN_TASK_LIMIT} Tasks`}",
    );
    expect(orgDetailsPaneSource).toContain("FREE_PLAN_TASK_LIMIT");
    expect(orgDetailsPaneSource).toContain("Payment Grace Period runs through");
    expect(orgDetailsPaneSource).not.toContain("Customer Portal");
    expect(orgDetailsPaneSource).not.toContain("Upgrade");
  });
});
