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

const emptySetupRead = {
  ok: true,
  operation: "coreWorkBatchRead",
  results: [],
} as const;

const emptySetupWrite = {
  ok: true,
  operation: "coreWorkBatchWrite",
  results: [],
} as const;

const taskToolResponse = (tool: string, body: Record<string, unknown>) => ({
  ok: true,
  tool,
  ...body,
});

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
    setupBatchRead: () => Effect.succeed(emptySetupRead),
    setupBatchWrite: () => Effect.succeed(emptySetupWrite),
    taskTool: () => Effect.succeed(taskToolResponse("unknown", {})),
    ...overrides,
  });

const fakeCredentialStorage = (overrides: Partial<CredentialStorageService>) =>
  Layer.succeed(CredentialStorage, {
    read: Effect.succeed(null),
    write: () => Effect.void,
    remove: Effect.void,
    ...overrides,
  });

describe("church-work health", () => {
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
        message: "Set CHURCH_WORK_API_URL or CHURCH_WORK_SITE_URL to your Church Work server URL.",
      },
    });
  });

  it("does not print secrets from environment or backend failures", async () => {
    const secret = "super-secret-token";
    const result = await runCli(["health"], {
      env: { CHURCH_WORK_API_URL: "https://church-work.test", TOKEN: secret },
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

describe("church-work active-church", () => {
  it("prints a clear no Active Church result through the CLI path", async () => {
    const result = await runCli(["active-church"], {
      env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
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
        activeChurch: {
          id: "church_123",
          name: "Grace Church",
          slug: "grace-church",
          churchTimeZone: "America/New_York",
        },
        membership: { role: "owner" },
      },
    } as const;
    let requested: { readonly token: string; readonly churchId: string | null } | null = null;

    const result = await runCli(["active-church", "--church-id", "church_123"], {
      env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
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
      env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
      backendLayer: fakeBackend({
        activeChurchWithToken: () => Effect.succeed(authorizationError),
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual(authorizationError);
  });

  it("returns the shared structured Active Church auth error when no CLI auth token is available", async () => {
    const result = await runCli(["active-church"], {
      env: {},
      backendLayer: fakeBackend({}),
      credentialStorageLayer: fakeCredentialStorage({ read: Effect.succeed(null) }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      operation: "activeChurch",
      error: {
        code: "authentication_required",
        message: "Authentication required to resolve Active Church.",
      },
    });
  });
});

describe("church-work setup read", () => {
  it("lists setup records through one compact agent-facing CLI command", async () => {
    const setupRead = {
      ok: true,
      operation: "coreWorkBatchRead",
      results: [
        {
          id: "teams",
          operation: "listTeams",
          result: { ok: true, operation: "listTeams", data: { teams: [] } },
        },
        {
          id: "team-memberships",
          operation: "listTeamMemberships",
          result: {
            ok: true,
            operation: "listTeamMemberships",
            data: { teamMemberships: [] },
          },
        },
        {
          id: "work-defaults",
          operation: "readWorkDefaults",
          result: {
            ok: true,
            operation: "readWorkDefaults",
            data: { workflows: [], workflowStatuses: [], keyDates: [] },
          },
        },
        {
          id: "church-settings",
          operation: "readChurchSettings",
          result: {
            ok: true,
            operation: "readChurchSettings",
            data: { church: { id: "church_123", churchTimeZone: "America/New_York" } },
          },
        },
      ],
    } as const;
    let request: {
      readonly token: string;
      readonly operations: ReadonlyArray<{
        readonly id: string;
        readonly operation: string;
        readonly input: unknown;
      }>;
    } | null = null;

    const result = await runCli(["setup", "read", "--church-id", "church_123"], {
      env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
      backendLayer: fakeBackend({
        setupBatchRead: (args) => {
          request = args;
          return Effect.succeed(setupRead);
        },
      }),
    });

    expect(request).toEqual({
      token: "env-token",
      operations: [
        { id: "teams", operation: "listTeams", input: { churchId: "church_123" } },
        {
          id: "team-memberships",
          operation: "listTeamMemberships",
          input: { churchId: "church_123" },
        },
        {
          id: "work-defaults",
          operation: "readWorkDefaults",
          input: { churchId: "church_123" },
        },
        {
          id: "church-settings",
          operation: "readChurchSettings",
          input: { churchId: "church_123" },
        },
      ],
    });
    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: `${JSON.stringify(setupRead)}\n` });
  });
});

describe("church-work setup write", () => {
  it("runs setup mutations through one compact agent-facing CLI command", async () => {
    const setupWrite = {
      ok: true,
      operation: "coreWorkBatchWrite",
      results: [
        {
          id: "create-care-team",
          operation: "createTeam",
          result: {
            ok: true,
            operation: "createTeam",
            data: { teams: [{ id: "team_123", name: "Care", churchId: "church_123" }] },
          },
        },
      ],
    } as const;
    let request: {
      readonly token: string;
      readonly operations: ReadonlyArray<{
        readonly id: string;
        readonly operation: string;
        readonly input: unknown;
      }>;
    } | null = null;

    const result = await runCli(
      [
        "setup",
        "write",
        "--json",
        JSON.stringify({
          operations: [
            {
              id: "create-care-team",
              operation: "createTeam",
              input: { churchId: "church_123", name: "Care" },
            },
          ],
        }),
      ],
      {
        env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
        backendLayer: fakeBackend({
          setupBatchWrite: (args) => {
            request = args;
            return Effect.succeed(setupWrite);
          },
        }),
      },
    );

    expect(request).toEqual({
      token: "env-token",
      operations: [
        {
          id: "create-care-team",
          operation: "createTeam",
          input: { churchId: "church_123", name: "Care" },
        },
      ],
    });
    expect(result).toEqual({ exitCode: 0, stderr: "", stdout: `${JSON.stringify(setupWrite)}\n` });
  });
});

describe("church-work task execution", () => {
  it("maps Template Library CLI commands to MCP tools", async () => {
    const requests: Array<{
      readonly token: string;
      readonly tool: string;
      readonly body: Record<string, unknown>;
    }> = [];
    const env = { CHURCH_WORK_AUTH_TOKEN: "env-token" };
    const backendLayer = fakeBackend({
      taskTool: (args) =>
        Effect.sync(() => {
          requests.push(args);
          return taskToolResponse(args.tool, { received: args.body });
        }),
    });

    await runCli(
      [
        "template",
        "create-weekly-service",
        "--church-id",
        "church_123",
        "--name",
        "Sunday Service",
        "--team-id",
        "team_123",
        "--start-date",
        "2026-06-01",
        "--weekday",
        "6",
      ],
      { backendLayer, env },
    );
    await runCli(
      [
        "template-task",
        "add-at-placement",
        "--church-id",
        "church_123",
        "--template-id",
        "template_123",
        "--team-id",
        "team_123",
        "--title",
        "Prepare slides",
        "--cycle-offset",
        "-1",
        "--weekday",
        "4",
      ],
      { backendLayer, env },
    );
    await runCli(
      [
        "mcp",
        "call",
        "template-schedule-create",
        "--json",
        JSON.stringify({ churchId: "church_123", templateId: "template_123", kind: "monthly" }),
      ],
      { backendLayer, env },
    );
    await runCli(
      [
        "mcp",
        "call",
        "template-delete",
        "--json",
        JSON.stringify({ churchId: "church_123", templateId: "template_123" }),
      ],
      { backendLayer, env },
    );
    await runCli(
      [
        "mcp",
        "call",
        "template-restore",
        "--json",
        JSON.stringify({ churchId: "church_123", templateId: "template_123" }),
      ],
      { backendLayer, env },
    );
    await runCli(
      [
        "mcp",
        "call",
        "template-duplicate",
        "--json",
        JSON.stringify({ churchId: "church_123", templateId: "template_123" }),
      ],
      { backendLayer, env },
    );

    expect(requests).toEqual([
      {
        token: "env-token",
        tool: "template-create-weekly-service",
        body: {
          churchId: "church_123",
          name: "Sunday Service",
          teamId: "team_123",
          startDate: "2026-06-01",
          weekday: 6,
        },
      },
      {
        token: "env-token",
        tool: "template-task-add-at-placement",
        body: {
          churchId: "church_123",
          templateId: "template_123",
          teamId: "team_123",
          title: "Prepare slides",
          cycleOffset: -1,
          weekday: 4,
        },
      },
      {
        token: "env-token",
        tool: "template-schedule-create",
        body: { churchId: "church_123", templateId: "template_123", kind: "monthly" },
      },
      {
        token: "env-token",
        tool: "template-delete",
        body: { churchId: "church_123", templateId: "template_123" },
      },
      {
        token: "env-token",
        tool: "template-restore",
        body: { churchId: "church_123", templateId: "template_123" },
      },
      {
        token: "env-token",
        tool: "template-duplicate",
        body: { churchId: "church_123", templateId: "template_123" },
      },
    ]);
  });

  it("updates a Task assignment and lists the assigned Task in My Work", async () => {
    const requests: Array<{
      readonly token: string;
      readonly tool: string;
      readonly body: Record<string, unknown>;
    }> = [];
    const updatedTask = {
      id: "task_123",
      title: "Prepare liturgy",
      assignedUserId: "user_123",
      taskState: "todo",
    };

    const result = await runCli(
      [
        "task",
        "update",
        "--church-id",
        "church_123",
        "--task-id",
        "task_123",
        "--assigned-user-id",
        "user_123",
      ],
      {
        env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
        backendLayer: fakeBackend({
          taskTool: (args) =>
            Effect.sync(() => {
              requests.push(args);
              return taskToolResponse("update_task", { task: updatedTask });
            }),
        }),
      },
    );

    expect(requests).toEqual([
      {
        token: "env-token",
        tool: "update-task",
        body: {
          churchId: "church_123",
          taskId: "task_123",
          assignedUserId: "user_123",
        },
      },
    ]);
    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${JSON.stringify(taskToolResponse("update_task", { task: updatedTask }))}\n`,
    });

    requests.length = 0;
    const listResult = await runCli(
      ["task", "list", "--church-id", "church_123", "--surface", "my_work"],
      {
        env: { CHURCH_WORK_AUTH_TOKEN: "env-token" },
        backendLayer: fakeBackend({
          taskTool: (args) =>
            Effect.sync(() => {
              requests.push(args);
              return taskToolResponse("list_tasks", { tasks: [updatedTask] });
            }),
        }),
      },
    );

    expect(requests).toEqual([
      {
        token: "env-token",
        tool: "list-tasks",
        body: { churchId: "church_123", surface: "my_work" },
      },
    ]);
    expect(listResult.stdout).toBe(
      `${JSON.stringify(taskToolResponse("list_tasks", { tasks: [updatedTask] }))}\n`,
    );
  });

  it("maps task create, get, lifecycle, and lookup commands to compact backend tools", async () => {
    const requests: Array<{
      readonly token: string;
      readonly tool: string;
      readonly body: Record<string, unknown>;
    }> = [];
    const backendLayer = fakeBackend({
      taskTool: (args) =>
        Effect.sync(() => {
          requests.push(args);
          return taskToolResponse(args.tool.replaceAll("-", "_"), {});
        }),
    });
    const env = { CHURCH_WORK_AUTH_TOKEN: "env-token" };

    const commands = [
      [
        [
          "task",
          "create",
          "--church-id",
          "church_123",
          "--title",
          "Prepare liturgy",
          "--workflow-status-id",
          "status_todo",
          "--due-date",
          "2026-06-03",
          "--team-id",
          "team_123",
          "--assigned-user-id",
          "user_123",
          "--parent-task-id",
          "task_parent",
        ],
        {
          tool: "create-task",
          body: {
            churchId: "church_123",
            title: "Prepare liturgy",
            workflowStatusId: "status_todo",
            dueDate: "2026-06-03",
            teamId: "team_123",
            assignedUserId: "user_123",
            parentTaskId: "task_parent",
          },
        },
      ],
      [
        ["task", "get", "--church-id", "church_123", "--task-identifier", "PRD-48"],
        { tool: "get-task", body: { churchId: "church_123", taskIdentifier: "PRD-48" } },
      ],
      [
        [
          "task",
          "list",
          "--church-id",
          "church_123",
          "--surface",
          "our_work",
          "--cycle-id",
          "cycle_123",
          "--team-id",
          "team_123",
          "--assignee-id",
          "user_123",
          "--workflow-status-id",
          "status_todo",
          "--task-state",
          "todo",
        ],
        {
          tool: "list-tasks",
          body: {
            churchId: "church_123",
            surface: "our_work",
            cycleId: "cycle_123",
            teamId: "team_123",
            assignedUserId: "user_123",
            workflowStatusId: "status_todo",
            taskState: "todo",
          },
        },
      ],
      [
        [
          "task",
          "update",
          "--church-id",
          "church_123",
          "--task-identifier",
          "PRD-48",
          "--title",
          "Updated title",
          "--workflow-status-id",
          "status_doing",
          "--due-date",
          "2026-06-04",
          "--cycle-id",
          "cycle_next",
          "--unassign-user",
          "--team-id",
          "team_456",
          "--clear-parent",
        ],
        {
          tool: "update-task",
          body: {
            churchId: "church_123",
            taskIdentifier: "PRD-48",
            title: "Updated title",
            workflowStatusId: "status_doing",
            dueDate: "2026-06-04",
            cycleId: "cycle_next",
            assignedUserId: null,
            teamId: "team_456",
            parentTaskId: null,
          },
        },
      ],
      [
        ["task", "complete", "--church-id", "church_123", "--task-identifier", "PRD-48"],
        { tool: "complete-task", body: { churchId: "church_123", taskIdentifier: "PRD-48" } },
      ],
      [
        ["task", "cancel", "--church-id", "church_123", "--task-identifier", "PRD-48"],
        { tool: "cancel-task", body: { churchId: "church_123", taskIdentifier: "PRD-48" } },
      ],
      [
        ["task", "reopen", "--church-id", "church_123", "--task-identifier", "PRD-48"],
        { tool: "reopen-task", body: { churchId: "church_123", taskIdentifier: "PRD-48" } },
      ],
      [
        ["lookup", "users", "--church-id", "church_123"],
        { tool: "list-users", body: { churchId: "church_123" } },
      ],
      [
        ["lookup", "teams", "--church-id", "church_123"],
        { tool: "list-teams", body: { churchId: "church_123" } },
      ],
      [
        ["lookup", "cycles", "--church-id", "church_123"],
        { tool: "list-cycles", body: { churchId: "church_123" } },
      ],
      [
        [
          "lookup",
          "workflow-statuses",
          "--church-id",
          "church_123",
          "--workflow-id",
          "workflow_123",
        ],
        {
          tool: "list-workflow-statuses",
          body: { churchId: "church_123", workflowId: "workflow_123" },
        },
      ],
    ] as const;

    for (const [command, expected] of commands) {
      const result = await runCli(command, { env, backendLayer });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
      expect(requests.at(-1)).toEqual({ token: "env-token", ...expected });
    }
  });
});

describe("church-work current-user", () => {
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
      env: { CHURCH_WORK_AUTH_TOKEN: secret },
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

describe("church-work auth status", () => {
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

describe("church-work auth logout", () => {
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

describe("church-work login", () => {
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
      env: { CHURCH_WORK_AUTH_TOKEN: bootstrapToken },
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
        message: "Set CHURCH_WORK_AUTH_TOKEN to create a named CLI credential.",
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
