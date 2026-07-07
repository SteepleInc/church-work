"use client";

import { env } from "@church-work/env/web";
import { mutators, schema, type OptionalZeroSessionContext } from "@church-work/zero";
import { ZeroProvider } from "@rocicorp/zero/react";
import { useEffect, useMemo, useRef } from "react";

import { useSession } from "@/hooks/use-session";

type SessionWithZeroContext = {
  readonly activeOrganizationId?: string | null;
  readonly id: string;
  readonly orgRole?: string | null;
  readonly userRole?: string | null;
};

type AuthSessionData = {
  readonly session?: SessionWithZeroContext | null;
  readonly user?: { readonly id?: string | null; readonly role?: string | null } | null;
} | null;

const getZeroCacheUrl = () => {
  const configuredUrl = env.VITE_ZERO_CACHE_URL;
  const sameOriginZeroUrl = () => `${globalThis.location?.origin ?? "http://localhost:2001"}/zero`;
  const isLocalWebHost = ["127.0.0.1", "localhost"].includes(globalThis.location?.hostname ?? "");

  if (!configuredUrl) return sameOriginZeroUrl();

  try {
    const url = new URL(configuredUrl);

    // Local Better Auth cookies are host-only for the web app host (localhost:2001).
    // Connecting directly to zero-cache on 127.0.0.1:4848 prevents the browser from
    // sending that cookie, so zero-cache validates the connection as anonymous while
    // the client declares the signed-in userID. Use the Vite same-origin websocket
    // proxy in local dev so forwarded query/mutate requests receive the auth cookie.
    if ((url.hostname === "127.0.0.1" || url.hostname === "localhost") && isLocalWebHost) {
      return sameOriginZeroUrl();
    }

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return "https://zero.churchwork.ai";
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
};

export function ZeroRuntimeProvider(props: { readonly children: React.ReactNode }) {
  const { isPending: sessionPending, session: sessionData } = useSession();
  const data = sessionData as AuthSessionData;
  const lastAuthenticatedContext = useRef<OptionalZeroSessionContext>(null);
  const session = data?.session ?? undefined;
  const userId = data?.user?.id;

  const activeChurchId = session?.activeOrganizationId ?? null;
  const sessionId = session?.id ?? data?.session?.id;
  const churchRole = session?.orgRole ?? null;
  const isAppAdmin = data?.user?.role === "admin" || session?.userRole === "admin";
  const hasSession = Boolean(data?.user && data.session && userId && sessionId);

  // Build a context with a stable identity: ZeroProvider reconstructs its
  // client when any prop's reference changes, so a fresh object every render
  // would thrash the client. Memoize on the primitive fields instead.
  const nextContext = useMemo<OptionalZeroSessionContext>(
    () =>
      !hasSession || !userId || !sessionId
        ? null
        : {
            authenticated: true,
            active_church_id: activeChurchId,
            church_role: churchRole,
            is_app_admin: isAppAdmin,
            runtime: "client",
            session_id: sessionId,
            user_id: userId,
          },
    [hasSession, userId, sessionId, activeChurchId, churchRole, isAppAdmin],
  );
  if (nextContext) lastAuthenticatedContext.current = nextContext;
  const context = sessionPending ? lastAuthenticatedContext.current : nextContext;

  const cacheURL = useMemo(() => getZeroCacheUrl(), []);

  useEffect(() => {
    console.info("[church-work] Zero cache URL", {
      cacheURL,
      configuredUrl: env.VITE_ZERO_CACHE_URL,
    });
  }, [cacheURL]);

  return (
    <ZeroProvider
      cacheURL={cacheURL}
      context={context}
      // No external key: ZeroProvider rebuilds its client internally when
      // userID changes and updates context/auth on the existing instance
      // otherwise. Keying on the session would unmount the whole subtree on
      // every auth resolution, replaying header animations and dropping Zero's
      // synced state.
      mutators={mutators}
      schema={schema}
      userID={userId}
    >
      {props.children}
    </ZeroProvider>
  );
}
