import { describe, expect, test } from "bun:test";

const orgDetailsPaneSource = await Bun.file(
  new URL("./org-details-pane.tsx", import.meta.url),
).text();

describe("org details pane", () => {
  test("renders the PreachX-style org pane slots and detail sections", () => {
    expect(orgDetailsPaneSource).toContain("<DetailsShell");
    expect(orgDetailsPaneSource).toContain("topBarButtons={<OrgTopBarButtons orgId={orgId} />}");
    expect(orgDetailsPaneSource).toContain('<OrgActions orgId={orgId} mode="details-pane" />');
    expect(orgDetailsPaneSource).toContain("tabBar={<OrgDetailsTabBar activeTab={tab} />}");
    expect(orgDetailsPaneSource).toContain('title="Overview"');
    expect(orgDetailsPaneSource).toContain('title="Location / Address"');
    expect(orgDetailsPaneSource).toContain('title="Size"');
    expect(orgDetailsPaneSource).toContain('title="Onboarding"');
    expect(orgDetailsPaneSource).toContain('title="Members"');
    expect(orgDetailsPaneSource).toContain('title="Created"');
  });
});
