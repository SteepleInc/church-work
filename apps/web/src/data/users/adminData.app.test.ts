import { describe, expect, test } from "bun:test";

import { isAppAdministratorSessionUser } from "./adminData-utils";

describe("App Administrator session state", () => {
  test("recognizes only Better Auth admin-role users as App Administrators", () => {
    expect(isAppAdministratorSessionUser({ role: "admin" })).toBe(true);
    expect(isAppAdministratorSessionUser({ role: "owner" })).toBe(false);
    expect(isAppAdministratorSessionUser({ role: "member" })).toBe(false);
    expect(isAppAdministratorSessionUser({ role: null })).toBe(false);
    expect(isAppAdministratorSessionUser(null)).toBe(false);
  });
});
