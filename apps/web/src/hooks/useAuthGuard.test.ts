import { describe, expect, test } from "bun:test";

const authGuardSource = await Bun.file(new URL("./useAuthGuard.ts", import.meta.url)).text();

describe("useAuthGuard sign-out redirects", () => {
  test("sends an intentional sign-out directly to marketing instead of sign-in", () => {
    expect(authGuardSource).toContain("isIntentionalSignOut()");
    expect(authGuardSource).toContain('void navigate({ to: "/" });');
    expect(authGuardSource.indexOf("isIntentionalSignOut()")).toBeLessThan(
      authGuardSource.indexOf('void navigate({ to: "/sign-in" });'),
    );
  });
});
