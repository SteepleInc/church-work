import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { COMPLETED_APP_LANDING_PATH } from "@/data/org-routing";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { clearIntentionalSignOut, isIntentionalSignOut } from "@/features/auth/sign-out-routing";
import { useSession } from "@/hooks/use-session";

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
  const { isPending: sessionLoading, session } = useSession();
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const sessionActiveChurchId = session?.session.activeOrganizationId ?? null;
  const hasCompletedOnboarding = Boolean(
    session?.session.orgCompletedOnboarding ?? activeChurch?.completedOnboarding,
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (requireAuth && !session) {
      if (isIntentionalSignOut()) {
        clearIntentionalSignOut();
        void navigate({ to: "/" });
        return;
      }

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
