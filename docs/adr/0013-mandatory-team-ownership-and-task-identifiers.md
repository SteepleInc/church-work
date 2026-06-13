# Mandatory team ownership and team-scoped task identifiers

Team-less tasks made human-readable task references impossible and forced fallback machinery everywhere (a Church default Workflow, "No Team" board lanes, null branches in every task path). We decided every Task belongs to exactly one Team, and Tasks get Linear-style identifiers — a Team Identifier prefix plus a per-team sequence number (`PRD-48`) — which replace Convex ids as the user-facing reference in URLs and product surfaces. Since there are no production users yet, the schema goes strict from day one (`teamId` non-null, task number required, team identifier required) with no migration, per the ADR 0012 precedent.

The supporting invariants:

- **Every Church has at least one Team.** Onboarding cannot complete with zero teams, and the last remaining Team cannot be deleted or archived.
- **Per-team numbering, renumber + remember.** Moving a Task to another Team draws the next number from the destination's sequence; previous Task Identifiers are kept and remain resolvable so shared links survive. Changing a Team Identifier (user-editable, max 7 chars, unique per church, 3-letter default generated from the name) re-renders identifiers computed as `team.identifier + task.number`, and the old Team Identifier stays resolvable. On alias collisions, current identifiers always win; aliases resolve only when nothing current matches.
- **Every Team owns its Workflow.** Teams are seeded a To Do / In Progress / Done Workflow at creation; the Church default Workflow concept is removed entirely rather than demoted to a team-level fallback.
- **Template Tasks bind to Template Teams, not Teams.** A Template references named team slots mapped to real Teams, so Templates outlive the Teams they were written against. Deleting or archiving a Team eagerly forces remap-or-abandon of its Template Team mappings, so mappings never dangle and automatic Cycle generation never blocks on a missing team.

## Considered Options

- **Church-global sequence with team prefix** — rejected: identifiers never collide on team moves, but numbers grow large and gap within a team; per-team numbering matches the Linear model users pattern-match against.
- **Immutable identifier across team moves** — rejected: the prefix would lie about the task's current team, defeating the readability goal.
- **Church default Workflow as team-level fallback** — rejected: keeping the fallback was cheaper, but one workflow per team is one less concept for users to think about and removes the dual-path machinery.
- **Lazy repair of dangling template-team mappings** — rejected: held-back work in a needs-attention queue is invisible work; deletion time always has a human present to make the remap decision.
- **Reserving retired Team Identifiers forever** — rejected: permanent reservations confuse users more than the near-theoretical alias collision they prevent.
- **Dedicated `/task/PRD-48` path routes** — deferred: identifiers slot into the existing details-pane URL state and the `/team/$identifier` route; a permalink route can be added later without changing the model.

## Consequences

- Task creation everywhere (quick actions, MCP/agent args per ADR 0002, template projection) requires a team; creation surfaces need a team picker with context-aware defaults, and subtasks inherit their parent's team by default.
- Every team-to-team move runs the workflow status remap between two distinct team Workflows — the null branches (`effectiveWorkflowId`, "No Team" lanes, nullable team filters) are deleted, not deprecated.
- Identifier resolution is case-insensitive (canonical form uppercase) and must check current identifiers before previous-identifier aliases.
- Task numbers are drawn at creation/projection time, so a Template Task's identifier does not exist until it lands in a Cycle.
