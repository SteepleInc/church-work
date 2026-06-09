import { describe, expect, it } from "vitest";

import { assertAppAdministratorUser, isAppAdministratorUser } from "../adminAccess";

describe("App Administrator access", () => {
  it("allows only Better Auth admin-role users", () => {
    expect(isAppAdministratorUser({ role: "admin" })).toBe(true);
    expect(isAppAdministratorUser({ role: "owner" })).toBe(false);
    expect(isAppAdministratorUser({ role: "member" })).toBe(false);
    expect(isAppAdministratorUser(null)).toBe(false);
  });

  it("rejects non-App-Administrators in the server-side helper", () => {
    expect(() => assertAppAdministratorUser({ role: "admin" })).not.toThrow();
    expect(() => assertAppAdministratorUser({ role: "owner" })).toThrow(
      "App Administrator access required.",
    );
  });
});
