import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { apiKey } from "@better-auth/api-key";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { bearer, mcp, organization } from "better-auth/plugins";

import { components, internal } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";
import authConfig from "./convex/auth.config";
import { sendChurchInvitationEmail } from "./churchInvitationEmail";
import { isValidChurchTimeZone } from "./churchTimeZone";

const siteUrl = process.env.SITE_URL!;
const trustedOrigins = [
  siteUrl,
  process.env.E2E_SITE_URL,
  "http://127.0.0.1:2101",
  "http://localhost:2101",
].filter((origin): origin is string => Boolean(origin));

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      apiKey({
        apiKeyHeaders: "authorization",
        customAPIKeyGetter: (ctx) => {
          const authorization = ctx.headers?.get("authorization");
          const token = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length)
            : null;

          return token?.startsWith("ctcli_") ? token : null;
        },
        defaultPrefix: "ctcli_",
        enableSessionForAPIKeys: true,
        maximumNameLength: 80,
        rateLimit: { enabled: false },
        requireName: true,
      }),
      bearer(),
      mcp({ loginPage: "/" }),
      organization({
        requireEmailVerificationOnInvitation: false,
        schema: {
          organization: {
            additionalFields: {
              churchTimeZone: {
                type: "string",
                required: true,
              },
            },
          },
          team: {
            additionalFields: {
              archivedAt: {
                type: "string",
                required: false,
              },
              sortOrder: {
                type: "number",
                required: false,
              },
              defaultWorkflowId: {
                type: "string",
                required: false,
              },
            },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            if (!isValidChurchTimeZone(organization.churchTimeZone)) {
              throw new APIError("BAD_REQUEST", {
                message: "Church Time Zone must be a valid IANA time zone.",
              });
            }
          },
          afterCreateOrganization: async ({ organization }) => {
            if ("runMutation" in ctx) {
              await ctx.runMutation(internal.workDefaults.internalSeedForChurch, {
                churchId: organization.id,
              });
            }
          },
        },
        sendInvitationEmail: (data) =>
          sendChurchInvitationEmail(data, {
            apiKey: process.env.RESEND_API_KEY,
            from: process.env.CHURCH_INVITATION_EMAIL_FROM,
            siteUrl,
            fetch,
          }),
        teams: { enabled: true, defaultTeam: { enabled: false } },
      }),
      crossDomain({ siteUrl }),
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  });
}
