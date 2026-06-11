import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  canInviteChurchMembers,
  getInvalidInviteMemberEmails,
  inviteMemberRoleOptions,
  parseInviteMemberEmails,
} from "@/features/settings/invite-member-utils";

describe("invite member settings helpers", () => {
  it("normalizes pasted email lists like the copied invite member action", () => {
    expect(
      parseInviteMemberEmails(
        " Alice@Example.com, bob@example.com\nBOB@example.com; carol@example.com ",
      ),
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

  it("gates copied invite-member actions to Church owners and admins", () => {
    expect(canInviteChurchMembers("owner")).toBe(true);
    expect(canInviteChurchMembers("admin")).toBe(true);
    expect(canInviteChurchMembers(["member", "admin"])).toBe(true);
    expect(canInviteChurchMembers("member")).toBe(false);
    expect(canInviteChurchMembers(null)).toBe(false);
  });

  it("uses the copied PreachX TagInputField shape for email entry", () => {
    const inviteMemberSource = readFileSync(
      new URL("./invite-member.tsx", import.meta.url),
      "utf8",
    );
    const tagInputFieldSource = readFileSync(
      new URL("../../components/form/tag-input-field.tsx", import.meta.url),
      "utf8",
    );
    const tagInputSource = readFileSync(
      new URL("../../components/ui/tag-input.tsx", import.meta.url),
      "utf8",
    );

    expect(inviteMemberSource).toContain("<field.TagInputField");
    expect(inviteMemberSource).not.toContain("<field.TextareaField");
    expect(tagInputFieldSource).toContain("useFieldContext<readonly string[]>");
    expect(tagInputSource).toContain("tagValidator.safeParse");
  });
});
