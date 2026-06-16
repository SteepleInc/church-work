export interface ZeroSessionContext {
  readonly active_church_id: string | null;
  readonly church_role: string | null;
  readonly is_app_admin: boolean;
  readonly session_id: string;
  readonly user_id: string;
}

export type OptionalZeroSessionContext = ZeroSessionContext | null;

export const isAppAdminSession = (ctx: OptionalZeroSessionContext) => ctx?.is_app_admin === true;

export const requireSignedInSession = (ctx: OptionalZeroSessionContext) => {
  if (!ctx) {
    throw new Error("Authentication required.");
  }

  return ctx;
};

export const requireAppAdminSession = (ctx: OptionalZeroSessionContext) => {
  const session = requireSignedInSession(ctx);

  if (!session.is_app_admin) {
    throw new Error("App Administrator access required.");
  }

  return session;
};

export const requireActiveChurchAccess = (ctx: OptionalZeroSessionContext, church_id: string) => {
  const session = requireSignedInSession(ctx);

  if (!session.is_app_admin && session.active_church_id !== church_id) {
    throw new Error("Active Church access required.");
  }

  return session;
};
