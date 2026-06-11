type InvitationRole = "member" | "admin";
export type CurrentMemberRole = string | readonly string[] | null | undefined;

export const inviteMemberRoleOptions: readonly {
  readonly label: string;
  readonly value: InvitationRole;
}[] = [
  { label: "Member", value: "member" },
  { label: "Admin", value: "admin" },
];

export function canInviteChurchMembers(currentRole: CurrentMemberRole) {
  return Array.isArray(currentRole)
    ? currentRole.includes("owner") || currentRole.includes("admin")
    : currentRole === "owner" || currentRole === "admin";
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInviteMemberEmails(value: string) {
  const emails = value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  return Array.from(new Set(emails));
}

export function getInvalidInviteMemberEmails(emails: readonly string[]) {
  return emails.filter((email) => !emailPattern.test(email));
}
