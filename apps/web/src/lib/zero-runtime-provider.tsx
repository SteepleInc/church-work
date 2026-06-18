"use client";

import { env } from "@church-task/env/web";
import { mutators, schema, type OptionalZeroSessionContext } from "@church-task/zero";
import { ZeroProvider } from "@rocicorp/zero/react";

import { authClient } from "@/lib/auth-client";

type SessionWithZeroContext = {
  readonly activeOrganizationId?: string | null;
  readonly id: string;
  readonly orgRole?: string | null;
  readonly userRole?: string | null;
};

const getZeroCacheUrl = () => {
  const configuredUrl = env.VITE_ZERO_CACHE_URL;

  if (!configuredUrl) return "http://127.0.0.1:4848";

  return configuredUrl;
};

export function ZeroRuntimeProvider(props: { readonly children: React.ReactNode }) {
  const { data, isPending: sessionPending } = authClient.useSession();
  const session = data?.session as SessionWithZeroContext | undefined;
  const userId = data?.user?.id;

  const activeChurchId = session?.activeOrganizationId ?? null;
  const sessionId = session?.id ?? data?.session?.id;
  const context: OptionalZeroSessionContext =
    sessionPending || !data?.user || !data.session || !userId || !sessionId
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

  return (
    <ZeroProvider
      cacheURL={getZeroCacheUrl()}
      context={context}
      mutators={mutators}
      schema={schema}
      userID={userId}
    >
      {props.children}
    </ZeroProvider>
  );
}
