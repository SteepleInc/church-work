import { describe, expect, test } from "bun:test";

const userDetailsPaneSource = await Bun.file(
  new URL("./user-details-pane.tsx", import.meta.url),
).text();

describe("user details pane", () => {
  test("renders through the shared details shell with header, tabs, and sections", () => {
    expect(userDetailsPaneSource).toContain("<DetailsShell");
    expect(userDetailsPaneSource).toContain(
      "topBarButtons={<UserTopBarButtons userId={userId} />}",
    );
    expect(userDetailsPaneSource).toContain('<UserActions userId={userId} mode="details-pane" />');
    expect(userDetailsPaneSource).toContain("tabBar={<UserDetailsTabBar activeTab={tab} />}");
    expect(userDetailsPaneSource).toContain('title="Overview"');
    expect(userDetailsPaneSource).toContain('title="Churches"');
    expect(userDetailsPaneSource).toContain('title="Created"');
  });
});
