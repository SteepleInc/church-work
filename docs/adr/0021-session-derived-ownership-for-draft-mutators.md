# Session-derived Church and User scope for mutators

Browser-facing Zero mutators derive the acting User and active Church from the Zero session context (`ctx.user_id`, `ctx.active_church_id`) instead of accepting `church_id` or an actor User id from the client. The session context already carries both, so using it directly is simpler and keeps client-controlled ownership scope out of write contracts.

## Considered Options

- **Keep the client-passed `church_id` + `requireActiveChurchAccess` pattern.** Rejected: it is redundant with the session and keeps a client-supplied scope on the surface even though the session is the real source of truth.
- **Derive browser mutator scope from the session.** Chosen for all browser-facing Zero mutators.

## Consequences

- Browser clients no longer pass `church_id`, `owner_user_id`, or another actor User id to Zero mutators. "My drafts" queries remain user-scoped by the session, not by client-supplied ids.
- Non-interactive surfaces (CLI, MCP) have no ambient active Church, so they establish Church scope explicitly through the server-verified mechanism below.
- All browser-facing Zero mutators derive Church scope from `ctx.active_church_id` and acting User scope from `ctx.user_id`; their public argument schemas do not accept `church_id` or an actor User id. Entity lookups and writes continue to include the derived Church id, so ids from another Church are not mutable through the active session.

## Non-interactive Church scope

CLI and MCP operations keep the required `churchId` selector at their transport boundary. `backend/server/src/agent-operations.ts` authenticates the caller and verifies Membership in that Church before dispatching the operation. These server-authoritative operations use Effect/Drizzle directly, so the verified selector remains explicit in their service inputs rather than becoming a client-controlled Zero mutator argument.

When a server route invokes a Zero mutator, it must instead establish that verified scope in `ZeroSessionContext`. The tracer task-import endpoint is the reference implementation for this path: it resolves the Better Auth active Church and Membership into the mutator context, then calls `tasks.create` without `church_id`. Both mechanisms keep the public Zero mutator contract session-derived.
