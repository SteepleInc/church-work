# Session-derived Church and User scope for mutators

Draft mutators and the `tasks.create` draft-consumption path derive the owning User and active Church from the Zero session context (`ctx.user_id`, `ctx.active_church_id`) instead of accepting `church_id` / `actorUserId` from the client. The session context already carries both, and existing mutators only used the client-passed `church_id` as a value that was then verified against the session — so trusting the session directly is both simpler and secure-by-design for these new write paths.

## Considered Options

- **Keep the existing client-passed `church_id` + `requireActiveChurchAccess` pattern.** Rejected for the new draft paths: it is redundant with the session and keeps a client-supplied scope on the surface even though the session is the real source of truth.
- **Derive scope purely from the session.** Chosen for Draft mutators and the `tasks.create` draft path.

## Consequences

- Browser clients no longer pass `church_id` / `owner_user_id` for draft create/update/discard or for the draft-consuming task create; "my drafts" queries are user-scoped by the session, not by client-supplied ids.
- Non-interactive surfaces (CLI, MCP) have no ambient active Church, so they must still establish Church scope explicitly. Their Church-scoping mechanism (e.g. a session that carries `active_church_id`, or a still-explicit church argument on those surfaces) is in scope for the follow-on ticket below, not solved here.
- All browser-facing Zero mutators derive Church scope from `ctx.active_church_id` and acting User scope from `ctx.user_id`; their public argument schemas do not accept `church_id` or an actor User id. Entity lookups and writes continue to include the derived Church id, so ids from another Church are not mutable through the active session.

## Non-interactive Church scope

CLI and MCP operations keep the required `churchId` selector at their transport boundary. `backend/server/src/agent-operations.ts` authenticates the caller and verifies Membership in that Church before dispatching the operation. These server-authoritative operations use Effect/Drizzle directly, so the verified selector remains explicit in their service inputs rather than becoming a client-controlled Zero mutator argument.

When a server route invokes a Zero mutator, it must instead establish that verified scope in `ZeroSessionContext`. The tracer task-import endpoint is the reference implementation for this path: it resolves the Better Auth active Church and Membership into the mutator context, then calls `tasks.create` without `church_id`. Both mechanisms keep the public Zero mutator contract session-derived.
