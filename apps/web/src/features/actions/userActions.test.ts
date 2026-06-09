import { describe, expect, test } from "bun:test";

const userActionsSource = await Bun.file(new URL("./userActions.tsx", import.meta.url)).text();

describe("user actions", () => {
  test("shows Edit user and Impersonate user to App Administrators", () => {
    expect(userActionsSource).toContain("useIsAdmin()");
    expect(userActionsSource).toContain("if (!isAdmin)");
    expect(userActionsSource).toContain('id: "edit-user"');
    expect(userActionsSource).toContain('label: "Edit user"');
    expect(userActionsSource).toContain('id: "impersonate-user"');
    expect(userActionsSource).toContain('label: "Impersonate user"');
  });

  test("impersonates through Better Auth admin client and refreshes the session", () => {
    expect(userActionsSource).toContain("authClient.admin.impersonateUser({ userId })");
    expect(userActionsSource).toContain("await refetchSession()");
  });
});
