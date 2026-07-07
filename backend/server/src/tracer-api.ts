import { createAuth, createLocalOtpStore } from "@church-work/auth";
import { bootstrapChurchOnboarding, createDb } from "@church-work/db";
import {
  demo_items,
  invitation,
  member,
  notifications,
  organization,
  session as sessionTable,
  tasks,
  teams,
  user,
} from "@church-work/db/schema";
import { formatTaskIdentifier } from "@church-work/domain";
import { getChurchInvitationId, getNotificationId } from "@church-work/shared/get-ids";
import { anonymousServerContext, mutators, queries, schema } from "@church-work/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { OptionalZeroSessionContext } from "@church-work/zero";
import { handleAgentRequest } from "./agent-operations";

const getSessionContext = async (
  auth: ReturnType<typeof createAuth>["auth"],
  db: ReturnType<typeof createDb>["db"],
  request: Request,
): Promise<OptionalZeroSessionContext> => {
  const authSession = await auth.api.getSession({ headers: request.headers });

  if (!authSession) {
    return anonymousServerContext();
  }

  const session = authSession.session as typeof authSession.session & {
    readonly activeOrganizationId?: string | null;
    readonly orgRole?: string | null;
    readonly userRole?: string | null;
  };
  const activeChurchId = session.activeOrganizationId ?? null;
  const [membership] = activeChurchId
    ? await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(eq(member.organizationId, activeChurchId), eq(member.userId, authSession.user.id)),
        )
        .limit(1)
    : [];

  return {
    authenticated: true,
    active_church_id: activeChurchId,
    church_role: session.orgRole ?? membership?.role ?? null,
    is_app_admin: session.userRole === "admin",
    runtime: "server",
    session_id: authSession.session.id,
    user_id: authSession.user.id,
  };
};

const toResponse = (result: unknown) =>
  result instanceof Response ? result : Response.json(result);

export const createTracerApi = (databaseUrl: string) => {
  const { db, pool } = createDb(databaseUrl);
  const otpStore = createLocalOtpStore();
  const authRuntime = createAuth(databaseUrl, otpStore);
  const zeroDb = zeroDrizzle(schema, db);
  const getQuery = (name: string) =>
    mustGetQuery(queries, name) as { fn: (input: unknown) => unknown };
  const getMutator = (name: string) =>
    mustGetMutator(mutators, name) as { fn: (input: unknown) => Promise<unknown> };

  const handleHealth = () =>
    Effect.succeed(
      Response.json({
        ok: true,
        service: "@church-work/server",
      }),
    );

  const handleCreateDemoItem = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const context = await getSessionContext(authRuntime.auth, db, request);
        const body = (await request.json()) as { name?: string };
        const mutator = getMutator("demo_items.create");

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
        const sessionContext = await getSessionContext(authRuntime.auth, db, request);
        const ctx = sessionContext?.authenticated
          ? ({ ...sessionContext, runtime: "client" } as const)
          : sessionContext;

        return handleQueryRequest({
          handler: (name, args): any => {
            return getQuery(name).fn({
              args,
              ctx,
            });
          },
          request,
          schema,
          userID: ctx?.authenticated ? ctx.user_id : undefined,
        }).then(toResponse);
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
              const ctx = await getSessionContext(authRuntime.auth, db, request);
              await getMutator(name).fn({
                args,
                ctx,
                tx,
              });
            }),
          request.clone() as unknown as Parameters<typeof handleMutateRequest>[2],
        ).then(toResponse),
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

  const handleCreateTestSession = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const body = (await request.json()) as {
          churchName?: string;
          email?: string;
          role?: string | null;
          userName?: string;
        };
        const email = body.email?.trim().toLowerCase();
        const name = body.userName?.trim() || "E2E User";
        const churchName = body.churchName?.trim() || "E2E Church";

        if (!email) {
          return Response.json({ error: "Email is required" }, { status: 400 });
        }

        const signUp = await authRuntime.auth.api.signUpEmail({
          asResponse: true,
          body: {
            email,
            name,
            password: `church-work-e2e-${crypto.randomUUID()}`,
          },
        });
        const signUpCookie = signUp.headers.get("set-cookie");

        if (!signUp.ok || !signUpCookie) {
          return Response.json({ error: "Could not create test user session" }, { status: 500 });
        }

        const signUpSession = await authRuntime.auth.api.getSession({
          headers: new Headers({ cookie: signUpCookie }),
        });

        if (!signUpSession) {
          return Response.json({ error: "Could not read test sign-up session" }, { status: 500 });
        }

        const org = await authRuntime.auth.api.createOrganization({
          body: {
            churchTimeZone: "America/Chicago",
            name: churchName,
            slug: `e2e-${crypto.randomUUID()}`,
          },
          headers: new Headers({ cookie: signUpCookie }),
        });

        if (!org?.id) {
          return Response.json({ error: "Could not create test Church" }, { status: 500 });
        }

        await bootstrapChurchOnboarding(db, { church_id: org.id, user_id: signUpSession.user.id });

        const activeResponse = await authRuntime.auth.api.setActiveOrganization({
          asResponse: true,
          body: { organizationId: org.id },
          headers: new Headers({ cookie: signUpCookie }),
        });
        const activeCookie = activeResponse.headers.get("set-cookie") ?? signUpCookie;

        const completeResponse = await authRuntime.auth.handler(
          new Request("http://127.0.0.1/api/auth/complete-onboarding", {
            body: JSON.stringify({ orgId: org.id }),
            headers: {
              "content-type": "application/json",
              cookie: activeCookie,
              origin: process.env.E2E_SITE_URL ?? process.env.SITE_URL ?? "http://127.0.0.1",
            },
            method: "POST",
          }),
        );
        const sessionCookie = completeResponse.headers.get("set-cookie") ?? activeCookie;

        if (!completeResponse.ok) {
          return Response.json(
            {
              detail: await completeResponse.text(),
              error: "Could not complete test Church onboarding",
            },
            { status: 500 },
          );
        }

        const authSession = await authRuntime.auth.api.getSession({
          headers: new Headers({ cookie: sessionCookie }),
        });

        if (!authSession) {
          return Response.json({ error: "Could not read test session" }, { status: 500 });
        }

        if (body.role === "admin") {
          await db.update(user).set({ role: "admin" }).where(eq(user.id, authSession.user.id));
          await db
            .update(sessionTable)
            .set({ userRole: "admin" })
            .where(eq(sessionTable.id, authSession.session.id));
        }

        return Response.json(
          {
            church: { id: org.id, name: churchName },
            ok: true,
            user: { email, id: authSession.user.id, name },
          },
          { headers: { "set-cookie": sessionCookie } },
        );
      },
    });

  const handlePromoteCurrentUserToAppAdmin = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const authSession = await authRuntime.auth.api.getSession({ headers: request.headers });

        if (!authSession) {
          return Response.json({ error: "Authentication required" }, { status: 401 });
        }

        await db.update(user).set({ role: "admin" }).where(eq(user.id, authSession.user.id));
        await db
          .update(sessionTable)
          .set({ userRole: "admin" })
          .where(eq(sessionTable.id, authSession.session.id));

        return Response.json({ ok: true });
      },
    });

  const handleCreateTestNotification = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const authSession = await authRuntime.auth.api.getSession({ headers: request.headers });

        if (!authSession) {
          return Response.json({ error: "Authentication required" }, { status: 401 });
        }

        const body = (await request.json()) as { taskTitle?: string };
        const taskTitle = body.taskTitle?.trim();
        const session = authSession.session as typeof authSession.session & {
          readonly activeOrganizationId?: string | null;
        };
        const churchId = session.activeOrganizationId;

        if (!churchId || !taskTitle) {
          return Response.json({ error: "Church id and Task title are required" }, { status: 400 });
        }

        const [taskRow] = await db
          .select({ id: tasks.id, number: tasks.number, teamIdentifier: teams.identifier })
          .from(tasks)
          .innerJoin(teams, eq(teams.id, tasks.team_id))
          .where(and(eq(tasks.church_id, churchId), eq(tasks.title, taskTitle)))
          .limit(1);

        if (!taskRow) {
          return Response.json({ error: "Task not found" }, { status: 404 });
        }

        const now = new Date();
        const taskIdentifier = formatTaskIdentifier(taskRow.teamIdentifier, taskRow.number);
        const notificationId = getNotificationId();

        await db.insert(notifications).values({
          _tag: "notification",
          actor_user_id: authSession.user.id,
          church_id: churchId,
          created_at: now,
          created_by: authSession.user.id,
          display_body: `Please review ${taskTitle}.`,
          display_metadata: JSON.stringify({
            task_identifier: taskIdentifier,
            task_title: taskTitle,
          }),
          display_title: `${authSession.user.name} mentioned you`,
          id: notificationId,
          idempotency_key: `e2e:${notificationId}`,
          recipient_user_id: authSession.user.id,
          task_id: taskRow.id,
          type: "mention_explicit_target",
          updated_at: now,
          updated_by: authSession.user.id,
        });

        return Response.json({ id: notificationId, taskIdentifier });
      },
    });

  const handleCreateTestInvitation = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const authSession = await authRuntime.auth.api.getSession({ headers: request.headers });

        if (!authSession) {
          return Response.json({ error: "Authentication required" }, { status: 401 });
        }

        const session = authSession.session as typeof authSession.session & {
          readonly activeOrganizationId?: string | null;
        };
        const organizationId = session.activeOrganizationId;

        if (!organizationId) {
          return Response.json({ error: "Active Church required" }, { status: 400 });
        }

        const body = (await request.json()) as { email?: string; role?: string };
        const email = body.email?.trim().toLowerCase();
        const role = body.role === "admin" ? "admin" : "member";

        if (!email) {
          return Response.json({ error: "Email is required" }, { status: 400 });
        }

        const invitationId = getChurchInvitationId();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db.insert(invitation).values({
          email,
          expiresAt,
          id: invitationId,
          inviterId: authSession.user.id,
          organizationId,
          role,
          status: "pending",
        });

        return Response.json({ invitation: { _id: invitationId, id: invitationId } });
      },
    });

  const requireAppAdmin = async (request: Request) => {
    const authSession = await authRuntime.auth.api.getSession({ headers: request.headers });

    if (!authSession)
      return { response: Response.json({ error: "Authentication required" }, { status: 401 }) };

    const session = authSession.session as typeof authSession.session & {
      readonly userRole?: string | null;
    };

    if (session.userRole !== "admin") {
      return { response: Response.json({ error: "App administrator required" }, { status: 403 }) };
    }

    return { authSession, response: null };
  };

  const handleUpdateAdminUser = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const admin = await requireAppAdmin(request);
        if (admin.response) return admin.response;

        const body = (await request.json()) as { email?: string; name?: string; userId?: string };
        const userId = body.userId?.trim();
        const name = body.name?.trim();
        const email = body.email?.trim().toLowerCase();

        if (!userId || !name || !email) {
          return Response.json({ error: "User id, name, and email are required" }, { status: 400 });
        }

        await db
          .update(user)
          .set({ email, name, updatedAt: new Date() })
          .where(eq(user.id, userId));

        return Response.json({ ok: true });
      },
    });

  const handleUpdateAdminOrg = (request: Request) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const admin = await requireAppAdmin(request);
        if (admin.response) return admin.response;

        const body = (await request.json()) as {
          churchTimeZone?: string;
          city?: string | null;
          completedOnboarding?: boolean;
          countryCode?: string | null;
          name?: string;
          orgId?: string;
          size?: string | null;
          slug?: string | null;
          state?: string | null;
          street?: string | null;
          url?: string | null;
          zip?: string | null;
        };
        const orgId = body.orgId?.trim();
        const name = body.name?.trim();
        const churchTimeZone = body.churchTimeZone?.trim();

        if (!orgId || !name || !churchTimeZone) {
          return Response.json(
            { error: "Church id, name, and Church Time Zone are required" },
            { status: 400 },
          );
        }

        await db
          .update(organization)
          .set({
            churchTimeZone,
            city: body.city ?? null,
            completedOnboarding: Boolean(body.completedOnboarding),
            countryCode: body.countryCode ?? null,
            name,
            size: body.size ?? null,
            slug: body.slug ?? null,
            state: body.state ?? null,
            street: body.street ?? null,
            updatedAt: new Date(),
            url: body.url ?? null,
            zip: body.zip ?? null,
          })
          .where(eq(organization.id, orgId));

        return Response.json({ ok: true });
      },
    });

  const fetch = async (request: Request) => {
    const url = new URL(request.url);
    const agentResponse = await handleAgentRequest({ auth: authRuntime.auth, db }, request);
    if (agentResponse) return agentResponse;

    const effect = (() => {
      if (url.pathname.startsWith("/api/auth/")) {
        return Effect.promise(() => authRuntime.auth.handler(request));
      }
      if (url.pathname === "/api/test/otp" && request.method === "GET")
        return handleTestOtp(request);
      if (url.pathname === "/api/test/app-admin" && request.method === "POST") {
        return handlePromoteCurrentUserToAppAdmin(request);
      }
      if (url.pathname === "/api/test/session" && request.method === "POST") {
        return handleCreateTestSession(request);
      }
      if (url.pathname === "/api/test/notifications" && request.method === "POST") {
        return handleCreateTestNotification(request);
      }
      if (url.pathname === "/api/test/invitations" && request.method === "POST") {
        return handleCreateTestInvitation(request);
      }
      if (url.pathname === "/api/tracer" && request.method === "GET") return handleHealth();
      if (url.pathname === "/api/tracer/demo-items" && request.method === "POST") {
        return handleCreateDemoItem(request);
      }
      if (url.pathname === "/api/admin/users/update" && request.method === "POST") {
        return handleUpdateAdminUser(request);
      }
      if (url.pathname === "/api/admin/orgs/update" && request.method === "POST") {
        return handleUpdateAdminOrg(request);
      }
      if (url.pathname === "/api/zero/query" && request.method === "POST") {
        return handleZeroQuery(request);
      }
      if (url.pathname === "/api/zero/mutate" && request.method === "POST") {
        return handleZeroMutate(request);
      }

      return Effect.succeed(Response.json({ error: "Not found" }, { status: 404 }));
    })();

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
