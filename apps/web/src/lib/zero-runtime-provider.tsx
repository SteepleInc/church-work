"use client";

import { env } from "@church-task/env/web";
import { mutators, schema, type OptionalZeroSessionContext } from "@church-task/zero";
import { ZeroProvider } from "@rocicorp/zero/react";
import { Option, pipe } from "effect";

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

  return configuredUrl.includes("127.0.0.1") || configuredUrl.includes("localhost")
    ? typeof window === "undefined"
      ? configuredUrl
      : `${window.location.origin}/zero`
    : configuredUrl;
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
  const userIdProps = pipe(
    userId,
    Option.fromNullable,
    Option.match({
      onNone: () => ({}),
      onSome: (id) => ({ userID: id }),
    }),
  );

  return (
    <ZeroProvider
      cacheURL={getZeroCacheUrl()}
      context={context}
      key={`${userId ?? "anonymous"}:${sessionId ?? "anonymous"}:${activeChurchId ?? "none"}`}
      mutators={mutators}
      schema={schema}
      {...userIdProps}
    >
      {props.children}
    </ZeroProvider>
  );
}
