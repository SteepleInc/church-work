import { describe, expect, test } from "bun:test";

const userMenuSource = await Bun.file(new URL("./user-menu.tsx", import.meta.url)).text();

describe("UserMenu sign out", () => {
  test("navigates directly to marketing after the session has ended", () => {
    expect(userMenuSource).toContain("markIntentionalSignOut();");
    expect(userMenuSource).toContain("await authClient.signOut();");
    expect(userMenuSource).toContain('await navigate({ to: "/" });');
    expect(userMenuSource).toContain(
      "<DropdownMenuItemWithLoading loading={isSigningOut} onClick={signOut}>",
    );
    expect(userMenuSource).not.toContain("disabled={isSigningOut}");
    expect(userMenuSource).not.toContain("onSuccess");
  });
});
