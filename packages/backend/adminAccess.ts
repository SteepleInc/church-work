type AuthUserWithRole = {
  readonly role?: string | null;
};

export function isAppAdministratorUser(user: AuthUserWithRole | null | undefined) {
  return user?.role === "admin";
}

export function assertAppAdministratorUser(
  user: AuthUserWithRole | null | undefined,
): asserts user is AuthUserWithRole & { readonly role: "admin" } {
  if (!isAppAdministratorUser(user)) {
    throw new Error("App Administrator access required.");
  }
}
