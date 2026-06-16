import { describe, expect, test } from "vitest";

import {
  isAppAdminSession,
  requireAppAdminSession,
  requireSignedInSession,
} from "./session-context";

const memberContext = {
  active_church_id: "org_seed",
  church_role: "owner",
  is_app_admin: false,
  session_id: "session_seed",
  user_id: "user_seed",
} as const;

describe("Zero session access conventions", () => {
  test("distinguishes Church-scoped sessions from App Administrator sessions", () => {
    expect(requireSignedInSession(memberContext)).toBe(memberContext);
    expect(isAppAdminSession(memberContext)).toBe(false);

    const adminContext = { ...memberContext, is_app_admin: true };

    expect(isAppAdminSession(adminContext)).toBe(true);
    expect(requireAppAdminSession(adminContext)).toBe(adminContext);
  });

  test("rejects missing or non-admin sessions at the access helper seam", () => {
    expect(() => requireSignedInSession(null)).toThrow("Authentication required.");
    expect(() => requireAppAdminSession(memberContext)).toThrow(
      "App Administrator access required.",
    );
  });
});
