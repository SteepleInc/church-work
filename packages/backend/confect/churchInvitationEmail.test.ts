import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { churchInvitationUrl, sendChurchInvitationEmail } from "../churchInvitationEmail";

describe("Church Invitation email", () => {
  it.effect("builds a dashboard invitation URL with the invitation id", () =>
    Effect.sync(() => {
      expect(churchInvitationUrl("https://app.example.com", "inv_123")).toBe(
        "https://app.example.com/dashboard?churchInvitationId=inv_123",
      );
    }),
  );

  it.effect("sends Church Invitations through Resend", () =>
    Effect.gen(function* () {
      const requests: Array<{ url: string; init: RequestInit }> = [];
      const fetchStub: typeof fetch = async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
      };

      yield* Effect.promise(() =>
        sendChurchInvitationEmail(
          {
            id: "inv_123",
            role: "admin",
            email: "member@example.com",
            organization: { name: "Grace Church" },
            inviter: { user: { name: "Admin User", email: "admin@example.com" } },
          },
          {
            apiKey: "resend_test_key",
            from: "Church Task <invites@example.com>",
            siteUrl: "https://app.example.com",
            fetch: fetchStub,
          },
        ),
      );

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        url: "https://api.resend.com/emails",
        init: {
          method: "POST",
          headers: {
            authorization: "Bearer resend_test_key",
            "content-type": "application/json",
          },
        },
      });
      expect(JSON.parse(String(requests[0]!.init.body))).toEqual({
        from: "Church Task <invites@example.com>",
        to: "member@example.com",
        subject: "Invitation to join Grace Church on Church Task",
        text: [
          "Admin User invited you to join Grace Church as admin.",
          "",
          "Accept the Church Invitation: https://app.example.com/dashboard?churchInvitationId=inv_123",
        ].join("\n"),
      });
    }),
  );

  it.effect("does not call Resend when local email configuration is absent", () =>
    Effect.gen(function* () {
      let fetchCalls = 0;
      const fetchStub: typeof fetch = async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      };

      yield* Effect.promise(() =>
        sendChurchInvitationEmail(
          {
            id: "inv_123",
            role: "member",
            email: "member@example.com",
            organization: { name: "Grace Church" },
            inviter: { user: { email: "admin@example.com" } },
          },
          {
            apiKey: undefined,
            from: undefined,
            siteUrl: "https://app.example.com",
            fetch: fetchStub,
          },
        ),
      );

      expect(fetchCalls).toBe(0);
    }),
  );
});
