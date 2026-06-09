import { describe, expect, test } from "bun:test";

const orgsCollectionSource = await Bun.file(
  new URL("./orgsCollection.tsx", import.meta.url),
).text();
const orgsColumnsSource = await Bun.file(
  new URL("../../data/orgs/orgsCollectionDef.tsx", import.meta.url),
).text();

describe("orgs collection details-pane wiring", () => {
  test("clicking an org name opens the org details pane via OrgLink", () => {
    expect(orgsColumnsSource).toContain('import { OrgLink } from "@/components/navigation/links"');
    expect(orgsColumnsSource).toContain("<OrgLink");
    expect(orgsColumnsSource).toContain("org={{ id: row.original.id, name: row.original.name }}");
  });

  test("renders App Administrator row actions for every org row", () => {
    expect(orgsCollectionSource).toContain(
      'import { OrgActions } from "@/features/actions/orgActions"',
    );
    expect(orgsCollectionSource).toContain(
      'rowActions={(org) => <OrgActions mode="table" orgId={org.id} />}',
    );
  });
});
