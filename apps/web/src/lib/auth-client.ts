import type { ChurchWorkAuth } from "@church-work/auth";
import type { BetterAuthClientPlugin } from "better-auth/client";
import {
  adminClient,
  customSessionClient,
  emailOTPClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

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
    atomListeners: [
      {
        matcher: (path: string) => path === "/clear-org-for-onboarding",
        signal: "$sessionSignal",
      },
    ],
    getActions: ($fetch) => ({
      clearOrgForOnboarding: async () =>
        await $fetch<{ status: boolean }>("/clear-org-for-onboarding", {
          method: "POST",
        }),
    }),
    id: "clear-org-for-onboarding",
    pathMethods: {
      "/clear-org-for-onboarding": "POST",
    },
  }) satisfies BetterAuthClientPlugin;

const churchLifecycleClient = () =>
  ({
    atomListeners: [
      {
        matcher: (path: string) => path.startsWith("/church/"),
        signal: "$sessionSignal",
      },
    ],
    getActions: ($fetch) => ({
      deleteChurch: async (churchId: string) =>
        await $fetch<{ status: boolean }>("/church/delete", {
          body: { churchId },
          method: "POST",
        }),
      restoreChurch: async (churchId: string) =>
        await $fetch<{ status: boolean }>("/church/restore", {
          body: { churchId },
          method: "POST",
        }),
    }),
    id: "church-lifecycle",
    pathMethods: {
      "/church/delete": "POST",
      "/church/restore": "POST",
    },
  }) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    emailOTPClient(),
    stripeClient({ subscription: true }),
    adminClient(),
    completeOnboardingClient(),
    clearOrgForOnboardingClient(),
    churchLifecycleClient(),
    organizationClient({
      teams: { enabled: true },
      schema: inferOrgAdditionalFields<ChurchWorkAuth>(),
    }),
    customSessionClient<ChurchWorkAuth>(),
    inferAdditionalFields<ChurchWorkAuth>(),
  ],
});

export type Session = typeof authClient.$Infer.Session;
