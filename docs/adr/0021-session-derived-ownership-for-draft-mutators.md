# Session-derived ownership for Draft mutators

Draft mutators and the `tasks.create` draft-consumption path derive the owning User and active Church from the Zero session context (`ctx.user_id`, `ctx.active_church_id`) instead of accepting `church_id` / `actorUserId` from the client. The session context already carries both, and existing mutators only used the client-passed `church_id` as a value that was then verified against the session — so trusting the session directly is both simpler and secure-by-design for these new write paths.

## Considered Options

- **Keep the existing client-passed `church_id` + `requireActiveChurchAccess` pattern.** Rejected for the new draft paths: it is redundant with the session and keeps a client-supplied scope on the surface even though the session is the real source of truth.
- **Derive scope purely from the session.** Chosen for Draft mutators and the `tasks.create` draft path.

## Consequences

- Browser clients no longer pass `church_id` / `owner_user_id` for draft create/update/discard or for the draft-consuming task create; "my drafts" queries are user-scoped by the session, not by client-supplied ids.
- Non-interactive surfaces (CLI, MCP) have no ambient active Church, so they must still establish Church scope explicitly. Their Church-scoping mechanism (e.g. a session that carries `active_church_id`, or a still-explicit church argument on those surfaces) is in scope for the follow-on ticket below, not solved here.
- The broader migration of all other existing mutators away from client-passed `church_id` toward session-derived scope is deferred to a follow-on ticket. This ADR establishes the direction; Draft mutators are the first adopter.
