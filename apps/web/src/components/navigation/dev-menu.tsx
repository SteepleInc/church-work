import { DevMenuContent } from "@/components/navigation/dev-menu-content";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";

export function DevMenu() {
  const { currentOrgOpt } = useCurrentOrgOpt();

  if (currentOrgOpt?.role !== "owner" && currentOrgOpt?.role !== "admin") {
    return null;
  }

  return <DevMenuContent orgId={currentOrgOpt.id} userId={currentOrgOpt.currentUserId} />;
}
