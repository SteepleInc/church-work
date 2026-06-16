import { createAuth, createLocalOtpStore } from "@church-task/auth";
import { createDb } from "@church-task/db";
import { demo_items } from "@church-task/db/schema";
import { mutators, queries, schema } from "@church-task/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import type { OptionalZeroSessionContext } from "@church-task/zero";

const getSessionContext = async (
  auth: ReturnType<typeof createAuth>["auth"],
  request: Request,
): Promise<OptionalZeroSessionContext> => {
  const authSession = await auth.api.getSession({ headers: request.headers });

  if (!authSession) {
    return null;
  }

  const session = authSession.session as typeof authSession.session & {
    readonly activeOrganizationId?: string | null;
    readonly orgRole?: string | null;
    readonly userRole?: string | null;
  };

  return {
    active_church_id: session.activeOrganizationId ?? null,
    church_role: session.orgRole ?? null,
    is_app_admin: session.userRole === "admin",
    session_id: authSession.session.id,
    user_id: authSession.user.id,
  };
};

export const createTracerApi = (databaseUrl: string) => {
  const { db, pool } = createDb(databaseUrl);
  const otpStore = createLocalOtpStore();
  const authRuntime = createAuth(databaseUrl, otpStore);
  const zeroDb = zeroDrizzle(schema, db);

  const handleHealth = () =>
    Effect.succeed(
      Response.json({
        ok: true,
        service: "@church-task/server",
      }),
    );

  const handleCreateDemoItem = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const context = await getSessionContext(authRuntime.auth, request);
        const body = (await request.json()) as { name?: string };
        const mutator = mustGetMutator(mutators, "demo_items.create");

        await zeroDb.transaction(async (tx) => {
          await mutator.fn({
            args: { name: body.name ?? "Tracer item" },
            ctx: context,
            tx,
          });
        });

        const [row] = await db
          .select()
          .from(demo_items)
          .where(eq(demo_items.name, body.name ?? "Tracer item"))
          .limit(1);

        return Response.json({ item: row });
      },
    });

  const handleZeroQuery = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const ctx = await getSessionContext(authRuntime.auth, request);

        return handleQueryRequest(
          (name, args) =>
            mustGetQuery(queries, name).fn({
              args,
              ctx,
            }),
          schema,
          request,
        ).then((body) => Response.json(body));
      },
    });

  const handleZeroMutate = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () =>
        handleMutateRequest(
          zeroDb,
          (transact) =>
            transact(async (tx, name, args) => {
              await mustGetMutator(mutators, name).fn({
                args,
                ctx: await getSessionContext(authRuntime.auth, request),
                tx,
              });
            }),
          request,
        ).then((body) => Response.json(body)),
    });

  const handleTestOtp = (request: Request) =>
    Effect.sync(() => {
      const url = new URL(request.url);
      const email = url.searchParams.get("email")?.trim();

      if (!email) {
        return Response.json({ ok: false, otp: null }, { status: 400 });
      }

      const captured = otpStore.getLatestOtp(email, "sign-in");

      if (!captured) {
        return Response.json({ ok: false, otp: null }, { status: 404 });
      }

      return Response.json({ ok: true, email, otp: captured.otp });
    });

  const fetch = async (request: Request) => {
    const url = new URL(request.url);

    const effect = url.pathname.startsWith("/api/auth/")
      ? Effect.promise(() => authRuntime.auth.handler(request))
      : url.pathname === "/api/test/otp" && request.method === "GET"
        ? handleTestOtp(request)
        : url.pathname === "/api/tracer" && request.method === "GET"
          ? handleHealth()
          : url.pathname === "/api/tracer/demo-items" && request.method === "POST"
            ? handleCreateDemoItem(request)
            : url.pathname === "/api/zero/query" && request.method === "POST"
              ? handleZeroQuery(request)
              : url.pathname === "/api/zero/mutate" && request.method === "POST"
                ? handleZeroMutate(request)
                : Effect.succeed(Response.json({ error: "Not found" }, { status: 404 }));

    return Effect.runPromise(effect).catch((cause) =>
      Response.json(
        { error: cause instanceof Error ? cause.message : String(cause) },
        { status: 500 },
      ),
    );
  };

  return {
    close: async () => {
      await authRuntime.pool.end();
      await pool.end();
    },
    fetch,
  };
};
