export const COMPLETED_APP_LANDING_PATH = "/my-work";

export type OrgSwitchTarget = typeof COMPLETED_APP_LANDING_PATH | "/onboarding";

export function getOrgSwitchTarget(params: {
  readonly completedOnboarding: boolean;
}): OrgSwitchTarget {
  return params.completedOnboarding ? COMPLETED_APP_LANDING_PATH : "/onboarding";
}
