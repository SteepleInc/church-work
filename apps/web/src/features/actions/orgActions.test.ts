import { describe, expect, test } from "bun:test";

const orgActionsSource = await Bun.file(new URL("./orgActions.tsx", import.meta.url)).text();
const entityActionsMenuSource = await Bun.file(
  new URL("./entityActionsMenu.tsx", import.meta.url),
).text();

describe("org actions", () => {
  test("shows only Edit org to App Administrators", () => {
    expect(orgActionsSource).toContain("useIsAdmin()");
    expect(orgActionsSource).toContain("if (!isAdmin)");
    expect(orgActionsSource).toContain('id: "edit-org"');
    expect(orgActionsSource).toContain('label: "Edit org"');
    expect(orgActionsSource).not.toMatch(/merge-orgs|Merge into this org/);
  });

  test("uses a dropdown menu trigger for table row actions", () => {
    expect(entityActionsMenuSource).toContain('aria-label="Open actions menu"');
    expect(entityActionsMenuSource).toContain("<DropdownMenuContent");
    expect(entityActionsMenuSource).toContain("event.stopPropagation()");
  });
});
