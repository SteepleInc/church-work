# Agent Platform Setup

This guide verifies the local CLI and MCP setup path for [PRD #11: Agent CLI and MCP Foundation](https://github.com/SteepleInc/church-task/issues/11). It is the smoke-test path for AFK agents and contributors who need non-browser access to Church Task operations.

## Prerequisites

- Install dependencies with `bun install`.
- Configure Convex with `bun run dev:setup` if the repo is not connected to a Convex deployment yet.
- Use Bun commands from the repo root.

## Environment

Set these variables before running agent-platform commands:

```bash
export CHURCH_TASK_CONVEX_URL="https://<deployment>.convex.cloud"
export CHURCH_TASK_SITE_URL="https://<deployment>.convex.site"
```

`CHURCH_TASK_SITE_URL` is optional for deployments that use the standard `.convex.cloud` to `.convex.site` pairing, but setting it explicitly makes MCP and auth smoke tests easier to read.

For CI, AFK agents, or local sandboxes, set `CHURCH_TASK_CREDENTIAL_FILE` to keep local CLI credentials out of your normal home directory:

```bash
export CHURCH_TASK_CREDENTIAL_FILE="$PWD/.tmp/church-task-credential.json"
```

Do not commit that file.

## CLI Health Smoke Test

Run the public health command:

```bash
bun packages/cli/src/bin.ts health
```

Expected successful output:

```json
{ "ok": true, "operation": "health", "status": "OK" }
```

If `CHURCH_TASK_CONVEX_URL` is missing, the command should fail with a structured setup error instead of a stack trace:

```json
{
  "ok": false,
  "error": {
    "code": "missing_backend_config",
    "message": "Set CHURCH_TASK_CONVEX_URL to your Convex deployment URL."
  }
}
```

## CLI Authentication Smoke Test

Use an explicit Better Auth bearer token only as a bootstrap token for creating a named CLI credential:

```bash
export CHURCH_TASK_AUTH_TOKEN="<short-lived Better Auth bearer token>"
bun packages/cli/src/bin.ts login --name "local-agent"
unset CHURCH_TASK_AUTH_TOKEN
```

Expected login output includes credential metadata, not the raw token:

```json
{
  "ok": true,
  "operation": "login",
  "credential": { "id": "<credential id>", "name": "local-agent", "start": "ctcli_" }
}
```

After login, verify the stored credential resolves the current User through the shared typed operation path:

```bash
bun packages/cli/src/bin.ts auth status
bun packages/cli/src/bin.ts current-user
```

Until Church Membership and Active Church smoke tests are complete, these commands verify User authentication only. Church access is still derived from Church Membership and Active Church session state, not from the CLI credential itself.

## Credential Safety And Revocation

- CLI credentials are named, user-owned Better Auth API keys with `ctcli_` token starts.
- Server-side credential records are hashed at rest by Better Auth storage.
- Local credential material is stored in `~/.church-task/credential.json` by default, or in `CHURCH_TASK_CREDENTIAL_FILE` when set.
- The CLI writes the credential file with restrictive file permissions where the operating system honors POSIX modes.
- Command output must not print raw `CHURCH_TASK_AUTH_TOKEN` values or stored CLI tokens.
- Use `CHURCH_TASK_AUTH_TOKEN` for explicit bootstrap or CI override flows only. Unset it after `login` so later commands use the stored credential.
- Revoke and remove the local credential with:

```bash
bun packages/cli/src/bin.ts auth logout
```

Expected logout output omits the raw token:

```json
{
  "ok": true,
  "operation": "logout",
  "revoked": true,
  "credential": { "id": "<credential id>", "name": "local-agent", "start": "ctcli_" }
}
```

If a local token is lost, run `auth logout` from that machine when possible. If the local file is unavailable, revoke the named API key through the Better Auth API-key management path once a product UI or admin workflow exposes it.

## MCP Discovery Smoke Test

MCP clients should discover OAuth/OIDC metadata from the Convex site URL:

```bash
curl "$CHURCH_TASK_SITE_URL/.well-known/oauth-authorization-server"
```

Expected metadata includes these fields:

```json
{
  "issuer": "https://<deployment>.convex.site",
  "authorization_endpoint": "https://<deployment>.convex.site/api/auth/mcp/authorize",
  "token_endpoint": "https://<deployment>.convex.site/api/auth/mcp/token",
  "userinfo_endpoint": "https://<deployment>.convex.site/api/auth/mcp/userinfo",
  "jwks_uri": "https://<deployment>.convex.site/api/auth/mcp/jwks",
  "registration_endpoint": "https://<deployment>.convex.site/api/auth/mcp/register"
}
```

MCP protected-resource metadata should advertise bearer-token header support:

```bash
curl "$CHURCH_TASK_SITE_URL/.well-known/oauth-protected-resource"
```

Expected metadata includes:

```json
{
  "resource": "https://<deployment>.convex.site",
  "authorization_servers": ["https://<deployment>.convex.site"],
  "bearer_methods_supported": ["header"]
}
```

Invalid bearer tokens must be rejected without leaking the token value:

```bash
curl -i \
  -H "Authorization: Bearer invalid-mcp-token" \
  "$CHURCH_TASK_SITE_URL/api/mcp/current-session"
```

Expected response status is `401` with a structured error:

```json
{ "ok": false, "error": { "code": "UNAUTHENTICATED", "message": "Authentication required" } }
```

## Verification Commands

Run the feedback loops that cover this setup path:

```bash
bun run test:cli
bun run test:backend
bun run check-types
```

`bun run test:cli` verifies CLI health output, missing configuration errors, auth status, login, logout, credential storage, and secret-safe structured errors with fake Effect layers. `bun run test:backend` verifies MCP metadata discovery, invalid bearer rejection, and authenticated MCP current User behavior through public HTTP routes.
