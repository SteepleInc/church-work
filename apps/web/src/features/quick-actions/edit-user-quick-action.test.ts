import { describe, expect, test } from "bun:test";

const editUserSource = await Bun.file(
  new URL("./edit-user-quick-action.tsx", import.meta.url),
).text();
const quickActionsSource = await Bun.file(new URL("./quick-actions.tsx", import.meta.url)).text();

describe("edit user quick action", () => {
  test("prefills and saves editable User fields through the admin update endpoint", () => {
    expect(editUserSource).toContain("editUserQuickActionStateAtom");
    expect(editUserSource).toContain("useUserData({ userId })");
    expect(editUserSource).toContain('fetch("/api/admin/users/update"');
    expect(editUserSource).toContain("name: user.name");
    expect(editUserSource).toContain('email: user.email ?? ""');
    expect(editUserSource).toContain('name: (value.name ?? "").trim()');
    expect(editUserSource).toContain('email: (value.email ?? "").trim()');
  });

  test("is mounted with the global quick-actions shell", () => {
    expect(quickActionsSource).toContain("<EditUserQuickAction />");
  });
});
