import { authClient } from "@/lib/auth-client";
import { isAppAdministratorSessionUser } from "@/data/users/adminData-utils";

type SessionUserWithRole = {
  readonly role?: string | null;
};

export function useIsAdmin() {
  const { data } = authClient.useSession();

  return isAppAdministratorSessionUser(data?.user as SessionUserWithRole | null | undefined);
}
