import { authClient } from "@/lib/auth-client";

type SessionUserWithRole = {
  readonly role?: string | null;
};

export function isAppAdministratorSessionUser(user: SessionUserWithRole | null | undefined) {
  return user?.role === "admin";
}

export function useIsAdmin() {
  const { data } = authClient.useSession();

  return isAppAdministratorSessionUser(data?.user as SessionUserWithRole | null | undefined);
}
