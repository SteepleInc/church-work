import { describe, expect, test } from "bun:test";

const orgsColumnsSource = await Bun.file(
  new URL("../../data/orgs/orgsCollectionDef.tsx", import.meta.url),
).text();
const usersColumnsSource = await Bun.file(
  new URL("../../data/users/usersCollectionDef.tsx", import.meta.url),
).text();
const linksSource = await Bun.file(new URL("../navigation/links.tsx", import.meta.url)).text();

describe("collection row-click behavior", () => {
  test("org name cell opens the org details pane via OrgLink", () => {
    expect(orgsColumnsSource).toContain('import { OrgLink } from "@/components/navigation/links"');
    expect(orgsColumnsSource).toContain("<OrgLink");
  });

  test("user name cell opens the user details pane via UserLink", () => {
    expect(usersColumnsSource).toContain(
      'import { UserLink } from "@/components/navigation/links"',
    );
    expect(usersColumnsSource).toContain("<UserLink");
  });

  test("entity links resolve their details-pane open url", () => {
    expect(linksSource).toContain("useOpenOrgDetailsPaneUrl");
    expect(linksSource).toContain("useOpenUserDetailsPaneUrl");
  });
});
