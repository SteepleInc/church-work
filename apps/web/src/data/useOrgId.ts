import { api } from "@church-task/backend/convex/_generated/api";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

export function useOrgId() {
  const activeOrg = useQuery(api.dashboard.getActiveOrganization);

  return activeOrg?.id ?? "";
}
