import { describe, expect, test } from "bun:test";

const orgsCollectionSource = await Bun.file(
  new URL("./orgsCollection.tsx", import.meta.url),
).text();

describe("orgs collection details-pane wiring", () => {
  test("clicking an org row opens the org details pane and preserves history", () => {
    expect(orgsCollectionSource).toContain("useDetailsPaneState()");
    expect(orgsCollectionSource).toContain("onRowClick={(org) =>");
    expect(orgsCollectionSource).toContain('_tag: "org"');
    expect(orgsCollectionSource).toContain('tab: "details"');
    expect(orgsCollectionSource).toContain("setDetailsPaneState([...detailsPaneState, nextEntry])");
  });

  test("renders App Administrator row actions for every org row", () => {
    expect(orgsCollectionSource).toContain(
      'import { OrgActions } from "@/features/actions/orgActions"',
    );
    expect(orgsCollectionSource).toContain(
      'rowActions={(org) => <OrgActions orgId={org.id} mode="table" />}',
    );
  });
});
