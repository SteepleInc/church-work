"use client";

import { env } from "@church-task/env/web";
import { mutators, schema, type OptionalZeroSessionContext } from "@church-task/zero";
import { ZeroProvider } from "@rocicorp/zero/react";
import { useRef } from "react";

import { authClient } from "@/lib/auth-client";

type SessionWithZeroContext = {
  readonly activeOrganizationId?: string | null;
  readonly id: string;
  readonly orgRole?: string | null;
  readonly userRole?: string | null;
};

const getZeroCacheUrl = () => {
  const configuredUrl = env.VITE_ZERO_CACHE_URL;
  const sameOriginZeroUrl = () => `${globalThis.location?.origin ?? "http://localhost:2001"}/zero`;

  if (!configuredUrl) return sameOriginZeroUrl();

  try {
    const url = new URL(configuredUrl);

    // Local Better Auth cookies are host-only for the web app host (localhost:2001).
    // Connecting directly to zero-cache on 127.0.0.1:4848 prevents the browser from
    // sending that cookie, so zero-cache validates the connection as anonymous while
    // the client declares the signed-in userID. Use the Vite same-origin websocket
    // proxy in local dev so forwarded query/mutate requests receive the auth cookie.
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return sameOriginZeroUrl();
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
};

export function ZeroRuntimeProvider(props: { readonly children: React.ReactNode }) {
  const { data, isPending: sessionPending } = authClient.useSession();
  const lastAuthenticatedContext = useRef<OptionalZeroSessionContext>(null);
  const session = data?.session as SessionWithZeroContext | undefined;
  const userId = data?.user?.id;

  const activeChurchId = session?.activeOrganizationId ?? null;
  const sessionId = session?.id ?? data?.session?.id;
  const nextContext: OptionalZeroSessionContext =
    !data?.user || !data.session || !userId || !sessionId
      ? null
      : {
          authenticated: true,
          active_church_id: activeChurchId,
          church_role: session?.orgRole ?? null,
          is_app_admin: session?.userRole === "admin",
          runtime: "client",
          session_id: sessionId,
          user_id: data.user.id,
        };
  if (nextContext) lastAuthenticatedContext.current = nextContext;
  const context = sessionPending ? lastAuthenticatedContext.current : nextContext;

  return (
    <ZeroProvider
      cacheURL={getZeroCacheUrl()}
      context={context}
      // ZeroProvider creates the client from initial props; remount when auth context changes.
      key={`${userId ?? "anonymous"}:${sessionId ?? "anonymous"}:${activeChurchId ?? "none"}`}
      mutators={mutators}
      schema={schema}
      userID={userId}
    >
      {props.children}
    </ZeroProvider>
  );
}
