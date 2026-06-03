import { describe, expect, it } from "bun:test";

import {
  getInvalidInviteMemberEmails,
  inviteMemberRoleOptions,
  parseInviteMemberEmails,
} from "@/features/settings/invite-member";

describe("invite member settings helpers", () => {
  it("normalizes pasted email lists like the copied invite member action", () => {
    expect(
      parseInviteMemberEmails(" Alice@Example.com, bob@example.com\nBOB@example.com; carol@example.com "),
    ).toEqual(["alice@example.com", "bob@example.com", "carol@example.com"]);
  });

  it("flags invalid email addresses before submitting invitations", () => {
    expect(getInvalidInviteMemberEmails(["member@example.com", "not-an-email"])).toEqual([
      "not-an-email",
    ]);
  });

  it("keeps Church Task invitation roles focused on active member roles", () => {
    expect(inviteMemberRoleOptions).toEqual([
      { label: "Member", value: "member" },
      { label: "Admin", value: "admin" },
    ]);
  });
});
