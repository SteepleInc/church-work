type ChurchInvitationEmailData = {
  id: string;
  role: string;
  email: string;
  organization: {
    name: string;
  };
  inviter: {
    user: {
      name?: string | null;
      email: string;
    };
  };
};

type SendChurchInvitationEmailOptions = {
  apiKey: string | undefined;
  from: string | undefined;
  siteUrl: string;
  fetch: typeof fetch;
};

export function churchInvitationUrl(siteUrl: string, invitationId: string) {
  const url = new URL("/dashboard", siteUrl);
  url.searchParams.set("churchInvitationId", invitationId);
  return url.toString();
}

export async function sendChurchInvitationEmail(
  data: ChurchInvitationEmailData,
  options: SendChurchInvitationEmailOptions,
) {
  if (!options.apiKey || !options.from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Resend invitation email is not configured.");
    }

    return;
  }

  const inviterName = data.inviter.user.name ?? data.inviter.user.email;
  const inviteUrl = churchInvitationUrl(options.siteUrl, data.id);
  const response = await options.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: data.email,
      subject: `Invitation to join ${data.organization.name} on Church Task`,
      text: [
        `${inviterName} invited you to join ${data.organization.name} as ${data.role}.`,
        "",
        `Accept the Church Invitation: ${inviteUrl}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend invitation email failed with status ${response.status}.`);
  }
}
