import { describe, expect, test } from "bun:test";

const editOrgSource = await Bun.file(
  new URL("./edit-org-quick-action.tsx", import.meta.url),
).text();
const quickActionsSource = await Bun.file(new URL("./quick-actions.tsx", import.meta.url)).text();

describe("edit org quick action", () => {
  test("prefills and saves editable Church fields through the admin update mutation", () => {
    expect(editOrgSource).toContain("editOrgQuickActionStateAtom");
    expect(editOrgSource).toContain("api.admin.getOrg");
    expect(editOrgSource).toContain("api.admin.updateOrg");
    expect(editOrgSource).toContain("name: org.name");
    expect(editOrgSource).toContain('slug: org.slug ?? ""');
    expect(editOrgSource).toContain(
      "churchTimeZone: org.churchTimeZone ?? detectedChurchTimeZone()",
    );
    expect(editOrgSource).toContain("completedOnboarding: org.completedOnboarding");
    expect(editOrgSource).toContain('name="completedOnboarding"');
    expect(editOrgSource).toContain("normalizeOptionalOrgValue(value.url)");
  });

  test("is mounted with the global quick-actions shell", () => {
    expect(quickActionsSource).toContain("<EditOrgQuickAction />");
  });
});
