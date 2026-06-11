type SessionUserWithRole = {
  readonly role?: string | null;
};

export function isAppAdministratorSessionUser(user: SessionUserWithRole | null | undefined) {
  return user?.role === "admin";
}
