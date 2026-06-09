import { env } from "@church-task/env/web";
import type { clearOrgForOnboarding } from "@church-task/backend/authCore";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { adminClient, emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const completeOnboardingClient = () =>
  ({
    getActions: ($fetch) => ({
      completeOnboarding: async (data: { readonly orgId: string }) =>
        await $fetch<{ status: boolean }>("/complete-onboarding", {
          body: data,
          method: "POST",
        }),
    }),
    id: "complete-onboarding",
  }) satisfies BetterAuthClientPlugin;

const clearOrgForOnboardingClient = () =>
  ({
    $InferServerPlugin: {} as ReturnType<typeof clearOrgForOnboarding>,
    atomListeners: [
      {
        matcher: (path: string) => path === "/clear-org-for-onboarding",
        signal: "$sessionSignal",
      },
    ],
    id: "clear-org-for-onboarding",
    pathMethods: {
      "/clear-org-for-onboarding": "POST",
    },
  }) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL: env.VITE_CONVEX_SITE_URL,
  plugins: [
    emailOTPClient(),
    adminClient(),
    completeOnboardingClient(),
    clearOrgForOnboardingClient(),
    organizationClient({
      teams: { enabled: true },
      schema: {
        organization: {
          additionalFields: {
            churchTimeZone: {
              type: "string",
              required: true,
            },
            completedOnboarding: {
              type: "boolean",
              required: false,
            },
            url: {
              type: "string",
              required: false,
            },
            street: {
              type: "string",
              required: false,
            },
            city: {
              type: "string",
              required: false,
            },
            state: {
              type: "string",
              required: false,
            },
            zip: {
              type: "string",
              required: false,
            },
            countryCode: {
              type: "string",
              required: false,
            },
            latitude: {
              type: "number",
              required: false,
            },
            longitude: {
              type: "number",
              required: false,
            },
            size: {
              type: "string",
              required: false,
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
    }),
    convexClient(),
    crossDomainClient(),
  ],
});
