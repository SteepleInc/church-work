export const COMPLETED_APP_LANDING_PATH = "/my-work";

export type OrgSwitchTarget = typeof COMPLETED_APP_LANDING_PATH | "/onboarding";

export type SessionOrgRoutingFields = {
  readonly activeOrganizationId?: string | null;
  readonly orgCompletedOnboarding?: boolean | null;
};

export function getOrgSwitchTarget(params: {
  readonly completedOnboarding: boolean;
}): OrgSwitchTarget {
  return params.completedOnboarding ? COMPLETED_APP_LANDING_PATH : "/onboarding";
}

export function getSessionOrgSwitchTarget(session: SessionOrgRoutingFields): OrgSwitchTarget {
  return getOrgSwitchTarget({ completedOnboarding: Boolean(session.orgCompletedOnboarding) });
}
