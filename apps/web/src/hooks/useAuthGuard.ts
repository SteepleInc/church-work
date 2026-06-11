import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";
import type { SessionOrgRoutingFields } from "@/data/org-routing";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { authClient } from "@/lib/auth-client";

type UseAuthGuardOptions = {
  /** Redirect to sign-in when there is no authenticated session. */
  readonly requireAuth?: boolean;
  /** Redirect to /onboarding when the Active Church is missing or has not Completed Onboarding. */
  readonly requireOnboarding?: boolean;
  /** Redirect into the product when the Active Church has Completed Onboarding. */
  readonly redirectIfOnboarded?: boolean;
};

type UseAuthGuardResult = {
  readonly loading: boolean;
  readonly activeChurch: CurrentOrg | null;
  readonly sessionActiveChurchId: string | null;
  readonly hasCompletedOnboarding: boolean;
};

/**
 * Routing guard over session auth state. The live Active Church query remains
 * available for page rendering, but route gating should not wait for it.
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}): UseAuthGuardResult {
  const { requireAuth = false, requireOnboarding = false, redirectIfOnboarded = false } = options;
  const navigate = useNavigate();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const sessionRouting = session?.session as SessionOrgRoutingFields | undefined;
  const sessionActiveChurchId = sessionRouting?.activeOrganizationId ?? null;
  const hasCompletedOnboarding = Boolean(
    sessionRouting?.orgCompletedOnboarding ?? activeChurch?.completedOnboarding,
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (requireAuth && !session) {
      void navigate({ to: "/sign-in" });
      return;
    }

    if (requireOnboarding && session && !hasCompletedOnboarding) {
      void navigate({ to: "/onboarding" });
      return;
    }

    if (redirectIfOnboarded && session && hasCompletedOnboarding) {
      void navigate({ to: COMPLETED_APP_LANDING_PATH });
    }
  }, [
    hasCompletedOnboarding,
    navigate,
    redirectIfOnboarded,
    requireAuth,
    requireOnboarding,
    session,
    sessionLoading,
  ]);

  return {
    loading: sessionLoading,
    activeChurch: loading ? null : activeChurch,
    sessionActiveChurchId,
    hasCompletedOnboarding,
  };
}
