# Agent CLI and MCP Foundation

> Historical PRD note: this PRD predated the Postgres/Drizzle/Zero migration in PRD #164. Keep the agent-first product interface, Effect runtime, Better Auth token, and CLI/MCP behavior decisions, but implement new work through the current typed server/domain, Drizzle, Better Auth on Postgres, and Effect stack. Old-stack references below are historical context, not current implementation guidance.

## Problem Statement

Church Work is intentionally agent-first, but the current roadmap starts with user workflows before the technical product interface that CLI and MCP clients need. Without a typed, authenticated, Effect-based operation layer, every future PRD that says "supports web UI and MCP/CLI operations" would have to invent its own command shape, token handling, error model, and server integration. Agents and power users need a safe non-browser interface that can authenticate as a User, resolve Active Church context, and call the same domain operations the web UI will eventually use.

## Solution

Build the reusable CLI and MCP foundation before the user workflow PRDs. The foundation uses Effect for command/runtime composition, typed server/domain contracts, Drizzle-backed operations, and Better Auth's token-oriented primitives instead of custom authentication storage. It proves the platform with a small set of smoke-test operations such as authentication status, current User, Active Church readiness, health check, and one read-only domain-shaped operation once Church Membership exists.

## User Stories

1. As a developer, I want CLI and MCP support to exist before core product workflows, so that future PRDs can expose operations consistently across web, CLI, and agent surfaces.
2. As a developer, I want Effect to own CLI runtime composition, configuration, logging, and failure handling, so that command behavior is testable outside a live server.
3. As a developer, I want typed server/domain contracts to define callable backend operation contracts, so that CLI, MCP, and web clients share typed inputs and outputs.
4. As a CLI user, I want to authenticate without browser cookies, so that commands work from terminals and agent tools.
5. As a CLI user, I want a durable local token flow, so that I do not need to reauthenticate for every command.
6. As a CLI user, I want to revoke or rotate CLI credentials, so that lost local tokens do not permanently expose my Church work.
7. As an MCP client, I want standards-compatible OAuth metadata and token endpoints, so that tools can discover and authorize Church Work safely.
8. As an MCP client, I want bearer-token requests to resolve to the same authenticated User as the web session, so that authorization rules stay consistent.
9. As a User who belongs to multiple Churches, I want CLI and MCP operations to know which Church is active, so that agent actions happen in the intended tenant.
10. As a User, I want commands to fail clearly when no Active Church is selected, so that work is not accidentally created in the wrong Church.
11. As an owner or admin, I want CLI token behavior to respect Church Membership and Role checks, so that agent access does not bypass product permissions.
12. As a developer, I want token validation to use Better Auth primitives such as bearer handling, MCP OAuth/OIDC support, and API-key style hashed tokens where appropriate, so that Church Work does not maintain a parallel auth system.
13. As a developer, I want CLI commands to return structured errors, so that agents can recover, ask the User for missing context, or display actionable instructions.
14. As a developer, I want local setup commands for the CLI and MCP server, so that new contributors can verify agent access quickly.
15. As a developer, I want smoke-test operations that exercise auth, context, and server calls end to end, so that later workflow PRDs can build on known-good plumbing.
16. As a developer, I want operation contracts to be batch-shaped from the beginning, so that future agent workflows can read and mutate church work efficiently.
17. As a developer, I want logs and errors to avoid leaking tokens, so that CLI and MCP debugging does not expose credentials.
18. As a developer, I want a clear split between domain operations and transport adapters, so that web, CLI, and MCP can reuse the same core behavior.

## Implementation Decisions

- Add an Agent Platform foundation PRD before the user-facing roadmap PRDs.
- Treat CLI and MCP as first-class product interfaces, consistent with the existing agent-first architecture decision.
- Use Effect for CLI runtime concerns: command composition, environment loading, HTTP client effects, structured errors, logging, and testable service layers.
- Use typed server/domain contracts to define backend operation specs and implementations that can be called by web, CLI, and MCP adapters.
- Use Better Auth token primitives rather than custom token storage: `bearer` for `Authorization: Bearer` request handling, the Better Auth MCP plugin shape for OAuth/OIDC MCP flows, and API-key style hashed user-owned keys for durable CLI credentials.
- CLI token creation must be explicit, named, revocable, hashed at rest, and scoped to a User. Church access is still derived from Church Membership and Active Church context, not from the token alone.
- MCP authorization should expose standards-compatible metadata and token exchange surfaces so external MCP clients can discover and connect without Church Work-specific auth hacks.
- The first vertical slice should prove health check, current User, authenticated session resolution, Active Church resolution once membership exists, and a minimal read-only operation.
- The CLI should persist local credentials in the operating system's normal secure storage when available, with an environment-variable override for CI or agent sandboxes.
- The MCP server and CLI should call the same typed operation layer where possible; transport-specific code should adapt requests, responses, and auth only.
- Do not build full Task, Team, Template, Cycle, Board, or invitation workflows in this PRD. This PRD only creates the foundation they will use.

## Testing Decisions

- Tests should cover externally visible behavior: successful auth, missing auth, expired or revoked token behavior, Active Church context requirements, typed operation responses, and structured error output.
- Effect services should be tested with fake layers for configuration, token storage, and transport so CLI behavior can be verified without a live server.
- Backend operation specs should be tested at typed server/domain boundaries where practical, with tests focused on schema validation and auth/context behavior rather than implementation details.
- Token handling tests should verify that raw tokens are not logged, persisted values are not plaintext when server-side storage is involved, and revoked or disabled credentials fail.
- MCP smoke tests should verify metadata discovery, bearer-token rejection for invalid tokens, and successful session resolution once a valid token path exists.
- Prior art includes the current CLI/server health and current-user slices, plus Better Auth reference tests for `bearer`, `mcp`, and `api-key` behavior.

## Out of Scope

- Full end-user Task creation, assignment, Workflow movement, Cycle planning, Template projection, or Saved Views.
- Custom church-specific Roles or token-scoped permission models beyond existing Church Membership and Role checks.
- A polished public CLI distribution process, package signing, installers, or shell completions.
- A complete web UI for token management, except for the minimum needed to create, inspect, or revoke CLI credentials if required by the chosen auth flow.
- Replacing Better Auth, Drizzle, Zero, or Effect with a custom platform layer.

## Further Notes

The OpenCode reference repositories should be treated as implementation guides, not as editable dependencies. The `better-auth` reference shows that Better Auth already has bearer, MCP OAuth/OIDC, and API-key token primitives. The `effect-smol`, `drizzle`, `zero`, and `preach-x` references should guide the CLI runtime and typed server operation layer.
