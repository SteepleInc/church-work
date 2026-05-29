import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import {
  BackendClient,
  BackendError,
  CredentialStorage,
  type BackendClientService,
  type CliCredential,
  type CredentialStorageService,
  runCli,
} from "./cli";

const unauthenticatedCurrentUser = {
  ok: true,
  operation: "currentUser",
  data: { user: null },
} as const;

const noActiveChurch = {
  ok: true,
  operation: "activeChurch",
  data: { status: "noActiveChurch", activeChurch: null, membership: null },
} as const;

const fakeBackend = (overrides: Partial<BackendClientService>) =>
  Layer.succeed(BackendClient, {
    healthCheck: Effect.succeed("OK" as const),
    currentUser: Effect.succeed(unauthenticatedCurrentUser),
    currentUserWithToken: () => Effect.succeed(unauthenticatedCurrentUser),
    activeChurch: () => Effect.succeed(noActiveChurch),
    activeChurchWithToken: () => Effect.succeed(noActiveChurch),
    createCliCredential: () =>
      Effect.succeed({
        id: "cred_123",
        name: "Test CLI",
        token: "created-cli-token",
        start: "ctcli_",
      }),
    revokeCliCredential: () => Effect.succeed({ revoked: true }),
    ...overrides,
  });

const fakeCredentialStorage = (overrides: Partial<CredentialStorageService>) =>
  Layer.succeed(CredentialStorage, {
    read: Effect.succeed(null),
    write: () => Effect.void,
    remove: Effect.void,
    ...overrides,
  });

describe("church-task health", () => {
  it("prints machine-readable success when the backend health operation succeeds", async () => {
    const result = await runCli(["health"], {
      env: {},
      backendLayer: fakeBackend({ healthCheck: Effect.succeed("OK" as const) }),
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${JSON.stringify({ ok: true, operation: "health", status: "OK" })}\n`,
    });
  });

  it("returns a structured error when backend configuration is missing", async () => {
    const result = await runCli(["health"], { env: {} });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      error: {
        code: "missing_backend_config",
        message: "Set CHURCH_TASK_CONVEX_URL to your Convex deployment URL.",
      },
    });
  });

  it("does not print secrets from environment or backend failures", async () => {
    const secret = "super-secret-token";
    const result = await runCli(["health"], {
      env: { CHURCH_TASK_CONVEX_URL: "https://steady-church-123.convex.cloud", TOKEN: secret },
      backendLayer: fakeBackend({
        healthCheck: Effect.fail(
          new BackendError({
            cause: `request failed with ${secret}`,
          }),
        ),
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain(secret);
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      error: {
        code: "backend_unavailable",
        message: "Backend operation failed.",
      },
    });
  });
});

describe("church-task active-church", () => {
  it("prints a clear no Active Church result through the CLI path", async () => {
    const result = await runCli(["active-church"], {
      env: { CHURCH_TASK_AUTH_TOKEN: "env-token" },
      backendLayer: fakeBackend({
        activeChurchWithToken: () => Effect.succeed(noActiveChurch),
      }),
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${JSON.stringify(noActiveChurch)}\n`,
    });
  });

  it("passes a requested Church through the authenticated Active Church path", async () => {
    const activeChurch = {
      ok: true,
      operation: "activeChurch",
      data: {
        status: "activeChurchReady",
        activeChurch: { id: "church_123", name: "Grace Church", slug: "grace-church" },
        membership: { role: "owner" },
      },
    } as const;
    let requested: { readonly token: string; readonly churchId: string | null } | null = null;

    const result = await runCli(["active-church", "--church-id", "church_123"], {
      env: { CHURCH_TASK_AUTH_TOKEN: "env-token" },
      backendLayer: fakeBackend({
        activeChurchWithToken: (args) => {
          requested = args;
          return Effect.succeed(activeChurch);
        },
      }),
    });

    expect(requested).toEqual({ token: "env-token", churchId: "church_123" });
    expect(result.stdout).toBe(`${JSON.stringify(activeChurch)}\n`);
  });

  it("returns structured authorization errors for Churches without membership", async () => {
    const authorizationError = {
      ok: false,
      operation: "activeChurch",
      error: {
        code: "not_church_member",
        message: "User does not have Church Membership for requested Church.",
      },
    } as const;

    const result = await runCli(["active-church", "--church-id", "church_without_membership"], {
      env: { CHURCH_TASK_AUTH_TOKEN: "env-token" },
      backendLayer: fakeBackend({
        activeChurchWithToken: () => Effect.succeed(authorizationError),
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual(authorizationError);
  });
});

describe("church-task current-user", () => {
  it("prints the shared typed currentUser operation response", async () => {
    const result = await runCli(["current-user"], {
      env: {},
      backendLayer: fakeBackend({ currentUser: Effect.succeed(unauthenticatedCurrentUser) }),
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${JSON.stringify(unauthenticatedCurrentUser)}\n`,
    });
  });

  it("uses an environment token override without reading local credential storage", async () => {
    const secret = "env-override-token";
    const authenticatedCurrentUser = {
      ok: true,
      operation: "currentUser",
      data: { user: { id: "user_123", email: "user@example.com", name: "CLI User" } },
    } as const;
    let tokenUsed: string | null = null;
    let storageReads = 0;

    const result = await runCli(["current-user"], {
      env: { CHURCH_TASK_AUTH_TOKEN: secret },
      backendLayer: fakeBackend({
        currentUserWithToken: (token) => {
          tokenUsed = token;
          return Effect.succeed(authenticatedCurrentUser);
        },
      }),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.sync(() => {
          storageReads += 1;
          return null;
        }),
        write: () => Effect.void,
      }),
    });

    expect(tokenUsed).toBe(secret);
    expect(storageReads).toBe(0);
    expect(result.stdout).toBe(`${JSON.stringify(authenticatedCurrentUser)}\n`);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });
});

describe("church-task auth status", () => {
  it("shows authenticated User identity and safe credential metadata without printing the token", async () => {
    const storedToken = "stored-cli-token";
    const currentUser = {
      ok: true,
      operation: "currentUser",
      data: { user: { id: "user_456", email: "stored@example.com", name: "Stored User" } },
    } as const;

    const result = await runCli(["auth", "status"], {
      env: {},
      backendLayer: fakeBackend({
        currentUserWithToken: (token) => {
          expect(token).toBe(storedToken);
          return Effect.succeed(currentUser);
        },
      }),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.succeed({
          id: "cred_456",
          name: "Stored CLI",
          token: storedToken,
          start: "ctcli_",
          createdAt: "2026-05-29T00:00:00.000Z",
        }),
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(storedToken);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      operation: "authStatus",
      authenticated: true,
      user: { id: "user_456", email: "stored@example.com", name: "Stored User" },
      credential: {
        source: "local",
        id: "cred_456",
        name: "Stored CLI",
        start: "ctcli_",
        createdAt: "2026-05-29T00:00:00.000Z",
      },
    });
  });

  it("returns a clear unauthenticated state after logout removes local credential material", async () => {
    const result = await runCli(["auth", "status"], {
      env: {},
      backendLayer: fakeBackend({}),
      credentialStorageLayer: fakeCredentialStorage({ read: Effect.succeed(null) }),
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${JSON.stringify({
        ok: true,
        operation: "authStatus",
        authenticated: false,
        user: null,
        credential: null,
      })}\n`,
    });
  });
});

describe("church-task auth logout", () => {
  it("revokes the server credential and removes local credential material", async () => {
    const storedToken = "stored-cli-token";
    let revoked: { readonly credentialId: string; readonly token: string } | null = null;
    let removed = false;

    const result = await runCli(["auth", "logout"], {
      env: {},
      backendLayer: fakeBackend({
        revokeCliCredential: (args) =>
          Effect.sync(() => {
            revoked = args;
            return { revoked: true };
          }),
      }),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.succeed({
          id: "cred_456",
          name: "Stored CLI",
          token: storedToken,
          start: "ctcli_",
        }),
        remove: Effect.sync(() => {
          removed = true;
        }),
      }),
    });

    expect(revoked).toEqual({ credentialId: "cred_456", token: storedToken });
    expect(removed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(storedToken);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      operation: "logout",
      revoked: true,
      credential: { id: "cred_456", name: "Stored CLI", start: "ctcli_" },
    });
  });
});

describe("church-task login", () => {
  it("creates a named CLI credential and stores the local secret without printing it", async () => {
    const bootstrapToken = "bootstrap-session-token";
    const createdCredential = {
      id: "cred_123",
      name: "Izak MacBook",
      token: "created-cli-token",
      start: "ctcli_",
    };
    let storedCredential: CliCredential | null = null;

    const result = await runCli(["login", "--name", "Izak MacBook"], {
      env: { CHURCH_TASK_AUTH_TOKEN: bootstrapToken },
      backendLayer: fakeBackend({
        createCliCredential: ({ name, sessionToken }) => {
          expect(name).toBe("Izak MacBook");
          expect(sessionToken).toBe(bootstrapToken);
          return Effect.succeed(createdCredential);
        },
      }),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.succeed(null),
        write: (credential) =>
          Effect.sync(() => {
            storedCredential = credential;
          }),
      }),
    });

    expect(storedCredential).toEqual(createdCredential);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(bootstrapToken);
    expect(result.stdout).not.toContain(createdCredential.token);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      operation: "login",
      credential: {
        id: createdCredential.id,
        name: createdCredential.name,
        start: createdCredential.start,
      },
    });
  });

  it("returns a structured error when login has no environment bootstrap token", async () => {
    const result = await runCli(["login", "--name", "No Token"], {
      env: {},
      backendLayer: fakeBackend({}),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.succeed(null),
        write: () => Effect.void,
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      error: {
        code: "missing_login_token",
        message: "Set CHURCH_TASK_AUTH_TOKEN to create a named CLI credential.",
      },
    });
  });

  it("uses a stored credential for later authenticated current-user calls", async () => {
    const storedToken = "stored-cli-token";
    const authenticatedCurrentUser = {
      ok: true,
      operation: "currentUser",
      data: { user: { id: "user_456", email: "stored@example.com", name: "Stored User" } },
    } as const;
    let tokenUsed: string | null = null;

    const result = await runCli(["current-user"], {
      env: {},
      backendLayer: fakeBackend({
        currentUserWithToken: (token) => {
          tokenUsed = token;
          return Effect.succeed(authenticatedCurrentUser);
        },
      }),
      credentialStorageLayer: fakeCredentialStorage({
        read: Effect.succeed({
          id: "cred_456",
          name: "Stored CLI",
          token: storedToken,
          start: "ctcli_",
        }),
        write: () => Effect.void,
      }),
    });

    expect(tokenUsed).toBe(storedToken);
    expect(result.stdout).toBe(`${JSON.stringify(authenticatedCurrentUser)}\n`);
    expect(result.stdout).not.toContain(storedToken);
    expect(result.stderr).not.toContain(storedToken);
  });
});
