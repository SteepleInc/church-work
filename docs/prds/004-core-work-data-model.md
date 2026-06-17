# Core Work Data Model

> Historical PRD note: this PRD predated the Postgres/Drizzle/Zero migration in PRD #164. Keep its Church Task domain decisions, invariants, and workflow language, but implement persistence and operations through the current Postgres/Drizzle/Zero/Better Auth/Effect architecture. Old-stack references below are historical context, not current implementation guidance.

## Problem Statement

Church Task has Church onboarding and agent-facing foundations, but it does not yet have the durable work model that the rest of the product can safely build on. Without a precise model for Cycles, Tasks, Templates, Scheduling Rules, Key Dates, Workflows, Activities, and Team membership, later UI and agent workflows would each invent their own semantics for recurring work, unfinished rollover, cancellation, and week-specific changes. Church leaders need the product to treat church weeks, recurring preparation, team workflows, and audit history consistently before deeper task execution, weekly planning, template authoring, and saved boards are built.

## Solution

Build the Postgres/Drizzle/Zero-backed Core Work Data Model and prove it with tests. The solution establishes Church Time Zone, Monday-to-Sunday Cycles, rolling Cycle maintenance, Task rollover, Activity history, Better Auth Team integration, Workflows and Workflow Statuses, Template projection, sparse Cycle Adjustments, and Key Date scheduling. This PRD is a backend/data-model PRD: it includes schema, invariants, scheduled-work behavior, batch-shaped operation contracts, and enough smoke-test operations to prove the model, but it does not include polished end-user UI for managing every concept.

## User Stories

1. As a Church owner, I want my Church to have a confirmed Church Time Zone, so that weekly planning boundaries match our local week.
2. As a Church owner, I want the Church Time Zone collected during onboarding, so that Cycles can be created reliably from the start.
3. As a Church owner, I want changing the Church Time Zone to affect only future Cycles, so that historical weeks do not change meaning.
4. As a Church leader, I want each Cycle to represent a Monday-to-Sunday Church-local week, so that weekly planning matches how our team works.
5. As a Church leader, I want Cycle dates to remain stable even when the Church Time Zone changes later, so that past planning history remains understandable.
6. As a Church leader, I want the system to maintain current and upcoming Cycles automatically, so that future work can be prepared before the week starts.
7. As a Church leader, I want a Sunday maintenance process to prepare upcoming Cycles, so that Monday rollover is not dependent on a last-second job.
8. As a Church leader, I want Cycle status such as past, current, and future to be derived from time, so that status does not drift from reality.
9. As a Church leader, I want incomplete Tasks to roll over into the next Cycle, so that unfinished work is still visible when a new week starts.
10. As a Church leader, I want rollover to move the Task instead of copying it, so that there is one current Task for unfinished work.
11. As a Church leader, I want completed and canceled Tasks to stay in the closing Cycle, so that finished history remains attached to the week where it ended.
12. As a Church leader, I want rolled-over Tasks to retain traceability to their previous Cycle, so that I can understand what carried forward.
13. As a Church leader, I want newly projected weekly Template work to appear even if last week's same work rolled over, so that unfinished old work and new recurring work are distinct.
14. As a Church leader, I want Tasks created directly in future Cycles to become current naturally when their Cycle becomes current, so that future planning does not need conversion.
15. As a Church leader, I want every Task to belong to exactly one Cycle at a time, so that work is always planned inside one week.
16. As a Church leader, I want long-running work to be broken into Tasks or Subtasks across Cycles, so that multi-week work remains clear.
17. As a Church leader, I want Subtasks to be Tasks that can live in different Cycles than their parent, so that larger work can be broken across weeks.
18. As a Church leader, I want parent Task completion to be independent from Subtask completion, so that parent and child work can be managed deliberately.
19. As a Church leader, I want Tasks to have one Due Date, so that scheduling stays simple.
20. As a Church leader, I want Due Date to determine the Task's Cycle, so that work appears in the week where it should be completed.
21. As a Church leader, I want Workflows with customizable Workflow Statuses, so that Teams can describe their actual process.
22. As a Church leader, I want fixed Task States of To Do, In Progress, Done, and Canceled, so that reporting stays simple across Teams.
23. As a Church leader, I want multiple Workflow Statuses to map to In Progress, so that Teams can add practical middle columns without changing the canonical Task State model.
24. As a Church leader, I want cancellation to be a menu action rather than a visible Workflow Status column, so that canceled work does not clutter normal workflow movement.
25. As a Church leader, I want canceled Tasks to move into a Done Workflow Status while rendering as canceled, so that board placement stays simple.
26. As a Church leader, I want reopened canceled Tasks to return to their previous Workflow Status, so that accidental cancellation can be corrected.
27. As a Church leader, I want Task movement between Teams to remap Workflow Status safely, so that a Task keeps its general state when it moves to another Team's Workflow.
28. As a Church leader, I want Workflow Statuses with active Tasks to be archived only after affected Tasks are moved, so that Tasks are not stranded in missing statuses.
29. As a Church leader, I want default Church Workflow Statuses of To Do, In Progress, and Done, so that every new Church can create valid Tasks immediately.
30. As a Church leader, I want Better Auth Teams to be the Team membership substrate, so that Church Task does not duplicate membership infrastructure unnecessarily.
31. As a Church leader, I want Team product fields such as archive state, ordering, and default Workflow to live on the Better Auth Team model, so that Team settings are reactive and not shadowed elsewhere.
32. As a Church leader, I want Better Auth Team membership changes to create product Activity where practical, so that Team history appears in Church Task.
33. As a Church leader, I want Church Task domain updates to use Zero mutators or typed Drizzle-backed server operations, so that product settings do not need to go through non-reactive Better Auth APIs when no hard auth mutation is required.
34. As a Church leader, I want Activities for important changes, so that I can see what happened to Tasks, Templates, Cycles, Teams, and Workflows.
35. As a Church leader, I want Activity history to be visible wherever I can see the underlying entity, so that history follows permissions.
36. As a Church leader, I want Activities to support targeted restore for cancellation, so that reopening can return work to its prior status without cluttering Task rows with extra fields.
37. As a developer, I want a typed Activity registry, so that Activity event metadata is consistent and validated.
38. As a developer, I want Activity writes from domain mutations to happen in the same mutation transaction where possible, so that state and history do not drift.
39. As a developer, I want Better Auth hook Activity writes to be best-effort and observable, so that an Activity failure does not corrupt or pretend to roll back auth state.
40. As a Church leader, I want Templates to define reusable church work, so that recurring preparation can be scheduled automatically.
41. As a Church leader, I want Template Tasks to project into Tasks, so that reusable definitions become actionable weekly work.
42. As a Church leader, I want Template Tasks to support parent-child relationships, so that projected Subtasks can be generated with their parent relationship preserved.
43. As a Church leader, I want child Template Tasks to schedule into different Cycles than their parent when needed, so that preparation can span weeks without one multi-week Task.
44. As a Church leader, I want Scheduling Rules to resolve to a Due Date, so that the Cycle is derived from the week containing that date.
45. As a Church leader, I want Scheduling Rules relative to Focus Windows, Anchor Dates, Key Dates, and fixed dates, so that annual, seasonal, monthly, and weekly work can be modeled.
46. As a Church leader, I want Template recurrence to support weekly, monthly, quarterly, yearly, and one-off Templates, so that recurring and single-season work both fit.
47. As a Church leader, I want Template edits to update unadjusted future projected Tasks, so that buffer Cycles stay aligned with the Template.
48. As a Church leader, I want current and past materialized Tasks to avoid automatic Template edits, so that already-active work is not unexpectedly changed.
49. As a Church leader, I want week-specific Task changes to override Template fields only for that Cycle, so that vacation coverage or one-time changes do not alter the source Template.
50. As a Church leader, I want unmodified fields on future adjusted Tasks to continue receiving Template updates, so that only the intentionally changed fields stay different.
51. As a Church leader, I want skipped projected work to be represented as a Cycle Adjustment, so that deleting a projected Task for one week does not delete the Template Task.
52. As a Church leader, I want rolled-over projected Tasks to stop syncing from the Source Template for their new Cycle, so that unfinished prior work is not confused with the new Template occurrence.
53. As a Church leader, I want rolled-over projected Tasks to retain Source Template traceability, so that I can see where the work originally came from.
54. As a Church leader, I want Key Dates such as Easter and Christmas to exist for my Church, so that Templates can schedule relative to meaningful church dates.
55. As a Church leader, I want starter Key Dates copied into my Church on creation, so that I do not begin from a blank calendar.
56. As a Church leader, I want starter Key Dates to become fully Church-owned records, so that I can rename, edit, archive, or delete them for my context.
57. As a Church leader, I want Key Date Occurrences for irregular events like Summer Fest, so that reusable planning can anchor to known dates without pretending the event is predictable.
58. As a Church leader, I want Templates to anchor to a Key Date definition and resolve through occurrences, so that one planning Template can work across years.
59. As a developer, I want batch-shaped typed operation contracts, so that web, CLI, MCP, and tests use the same typed boundaries.
60. As a developer, I want the Core Work Data Model proven with tests before UI PRDs build on it, so that later product work rests on stable invariants.

## Implementation Decisions

- Build this as a backend/data-model PRD. It includes schema, invariants, operation contracts, internal scheduling, and tests, not polished end-user UI.
- Extend Church onboarding enough to collect and persist Church Time Zone because Cycle creation depends on it.
- Store Church Time Zone as an IANA time zone string on the Better Auth Organization row through Better Auth organization additional fields.
- Use browser detection as the onboarding default when available, but require the user to confirm or change the Church Time Zone.
- Changing Church Time Zone affects only future Cycle boundary calculations. Existing Cycles keep their stored local dates and UTC instants.
- Follow the local date and UTC instant time model from ADR 0004. Church-calendar concepts are local-date-first; UTC instants are stored for clock comparisons and scheduled jobs.
- A Cycle is identified by the Church-local Monday `startDate` it represents. It also stores `endDate`, `startsAt`, and `endsAt`, where UTC instants are derived from Church Time Zone.
- Schema comments should explain paired local date and UTC instant fields anywhere they appear.
- Do not persist Cycle status such as past, current, or future. Derive it from `startsAt`, `endsAt`, and current UTC time.
- Maintain a rolling Cycle window per Church with the current Cycle, next Cycle, and temporarily the following Cycle when needed for Sunday preparation.
- Use a weekly Sunday backend cron/internal mutation for Cycle maintenance rather than one exact per-Church local-midnight cron.
- Implement Cycle maintenance as an idempotent internal mutation that can be retried safely.
- Cycle maintenance ensures upcoming Cycles exist, rolls over unfinished Tasks at the appropriate Church-local boundary, materializes scheduled Template work, and writes Activities.
- At rollover, move unfinished Tasks into the next Cycle instead of copying them.
- Unfinished means Task State is `todo` or `in_progress`.
- Completed and canceled Tasks remain in the closing Cycle.
- Rollover writes `task.rolled_over` Activity with `fromCycleId`, `toCycleId`, previous Task State, and Workflow Status metadata.
- A Task belongs to exactly one Cycle at a time.
- A Task has one Due Date, and the Due Date determines the Cycle containing it.
- Long-running work should be represented by multiple Tasks or Subtasks across Cycles, not by one multi-Cycle Task.
- A Subtask is a Task with a parent Task. It may belong to a different Cycle than its parent Task.
- Parent Task completion remains independent from Subtask completion.
- Enable Better Auth Teams for Team identity and Team Membership rather than duplicating Team membership tables.
- Do not rely on Better Auth Teams for product workflow semantics, task visibility semantics, or team-specific roles.
- Extend the Better Auth Team schema with Church Task product fields such as `archivedAt`, `sortOrder`, `defaultWorkflowId`, and any minimal descriptive field needed soon.
- Keep Better Auth as the authority for auth-sensitive operations: create Church, accept/reject/cancel invitations, add/remove Church Members, update Church Member Role, create Team identity, add/remove Team Members, and invitation-to-Team behavior.
- Use Church Task Zero mutators and typed Drizzle-backed domain operations for product updates such as Team archive, Team ordering, Team default Workflow, Workflow changes, Task changes, Template changes, Key Date changes, and Activity writes.
- Allow direct domain updates to explicitly approved Better Auth additional fields and display/product fields, but do not directly patch membership rows, roles, invitations, sessions, credentials, or auth plugin internal invariants.
- Use Better Auth `organizationHooks` to emit best-effort Activities for Better Auth-owned lifecycle changes such as organization, member, invitation, team, and team-member changes.
- Better Auth hook Activity failures should be logged/observable but should not intentionally fail user-facing auth/team operations.
- Add a Church-scoped `activities` table consistent with ADR 0005.
- Activities are audit history, not event sourcing. Current state lives on domain tables and should not require replaying Activities.
- Specific Activity types may store structured before/after metadata for targeted restore flows, such as reopening a canceled Task to its previous Workflow Status.
- Define an Activity registry in the domain layer using Effect-compatible schemas where useful.
- Activity event definitions own their metadata schemas and construction helpers.
- Avoid ad hoc direct Activity inserts outside the Activity module/helpers.
- Activity records include Church scope, entity type, entity id, event type, actor type, optional actor id, occurred-at timestamp, optional Cycle scope, and typed metadata.
- Activity visibility is permissioned by visibility of the underlying entity. Do not expose auth secrets, raw tokens, or sensitive session data in Activities.
- Model Workflows as Church-scoped ordered sets of Workflow Statuses.
- Use Workflow Status as the domain term for a specific process position. Do not use Workflow Column for Task state.
- Reserve Board Column for later presentation lanes in Saved Views/Boards.
- Task stores `workflowStatusId` and `taskState`.
- Fixed initial Task States are `todo`, `in_progress`, `done`, and `canceled`. Custom Church-defined Task States are out of scope but should not be made impossible.
- Workflow Statuses map to Task States. Normal moves set Task State from the destination Workflow Status.
- A valid Workflow must have at least one active `todo` Workflow Status, one active `in_progress` Workflow Status, and one active `done` Workflow Status.
- `canceled` is special and does not require a visible Workflow Status.
- Canceling a Task records previous state/status in Activity, moves the Task to the Workflow's default or first Done Workflow Status, and sets Task State to `canceled`.
- Completing a Task moves it to a Done Workflow Status and sets Task State to `done`.
- Reopening a canceled Task uses Activity metadata to restore its previous Task State and Workflow Status.
- A mutation must not leave a Task pointing to a non-Done Workflow Status while Task State is `done` or `canceled`.
- Workflow Statuses have explicit ordering. Active Workflow Status names should be unique within a Workflow.
- A Workflow Status with Tasks cannot be hard-deleted. Archive/delete flows must move affected Tasks first or be blocked.
- Each new Church gets a minimum default Workflow with To Do, In Progress, and Done Workflow Statuses.
- When a Task changes Team and therefore effective Workflow, remap to a destination Workflow Status by same Task State and same name when possible, otherwise the first destination Workflow Status with the same Task State.
- Reject Team changes that cannot preserve a valid Task State in the destination Workflow.
- Store Source Template metadata on projected Tasks so users and agents can trace generated work.
- Template Tasks can have child Template Tasks. Projection preserves parent-child relationships even when parent and child land in different Cycles.
- Projected Task materialization is idempotent using occurrence identity based on Church, Template Task, and Cycle.
- Scheduling Rules resolve to one Church-local Due Date. The Cycle is the week containing that Due Date.
- Supported Scheduling Rule families include cycle offset, relative to Anchor Date or Key Date, fixed date, and relative to Focus Window start/end.
- Focus Window stores type, local start date, local end date where applicable, optional Anchor Date, and optional Key Date reference.
- Templates support recurrence of none, weekly, monthly, quarterly, and yearly.
- Materialized projected Tasks store effective merged field values on the Task row for fast reads and normal Task execution behavior.
- Future Template edits sync into future materialized projected Tasks for fields that have not been adjusted.
- Current and past materialized Tasks do not automatically change from Template edits by default.
- Model Cycle Adjustments for projected Task occurrences as typed sparse field overrides keyed by Cycle and Template Task.
- Field absence in Cycle Adjustment overrides means inherit from the Template Task.
- Field presence with `null` means intentionally override to empty/null.
- Skipping projected work for a Cycle is represented by a Cycle Adjustment lifecycle flag.
- Centralize Template Task plus Cycle Adjustment merge logic in one projection module using Effect-compatible types.
- The merge module validates base Template Task fields, validates sparse overrides, distinguishes absent override from explicit null, and returns the effective Task shape.
- Rolled-over projected Tasks keep Source Template traceability but stop syncing from Template changes in the destination Cycle.
- Hand-added future Tasks are normal Tasks immediately. They have no Source Template and are not synchronized from Templates.
- Add Church-owned Key Dates and Key Date Occurrences.
- On Church creation, copy starter Key Dates into the Church. After copying, they are normal Church-owned records.
- Starter Key Dates include Christmas, Easter, Palm Sunday, Pentecost, Mother's Day, and Father's Day.
- Key Dates support fixed yearly, computed yearly, manual occurrences, and one-time usage.
- A Key Date definition represents the named planning concept. Key Date Occurrences represent the known Church-local dates.
- Templates anchor to Key Date definitions and resolve through known occurrences.
- Irregular events such as Summer Fest use manual occurrences. Projection only occurs for known occurrences.
- Polished Key Date and Key Date Occurrence management UI belongs in Template Library and Scheduling, not this PRD.
- Permission baseline: operations require authenticated User plus Active Church unless they are system/internal operations.
- Owners/admins can manage Church Time Zone, Teams, Workflows, Templates, Key Dates, and scheduling defaults.
- Members can read visible work needed for execution; mature day-to-day Task mutation permissions are finalized by later Task Execution PRDs.
- System cron/internal operations can materialize Cycles, roll over Tasks, and write Activities without user auth.
- Build batch-shaped typed operation contracts for the model and smoke-test operations needed to prove it.
- Keep web, CLI, MCP, and tests aligned on the same typed operation boundaries.

## Testing Decisions

- Tests should prove externally visible behavior and invariants, not private implementation details.
- Time/Cycle tests should cover Church Time Zone validation, Monday-to-Sunday local boundaries, UTC instant derivation, daylight saving boundaries, and future-only behavior when Church Time Zone changes.
- Cycle maintenance tests should prove idempotency, rolling current/next/following Cycle creation, Sunday preparation, rollover behavior, and safe duplicate prevention.
- Rollover tests should prove `todo` and `in_progress` Tasks move, `done` and `canceled` Tasks remain, Activities are written, and projected duplicate weekly work is expected.
- Activity tests should prove registry validation, metadata shape, entity scoping, targeted restore metadata, and rejection of invalid Activity metadata.
- Better Auth hook tests should cover Activity emission behavior where practical, while acknowledging hook writes are best-effort and should be observable on failure.
- Workflow tests should cover required statuses, Task State synchronization, cancellation moving to Done status, reopen from Activity metadata, Team change status remapping, and blocked deletion/archive of statuses with active Tasks.
- Template projection tests should cover Scheduling Rule resolution, Focus Window and Anchor Date behavior, Key Date occurrence resolution, parent-child Template Task projection, idempotent materialization, and Source Template metadata.
- Cycle Adjustment merge tests should cover sparse override semantics, explicit null overrides, skipped occurrences, and future Template edits syncing only unadjusted fields.
- Future sync tests should prove past/current Tasks are not changed by Template edits while buffer/future unadjusted projected Tasks are updated.
- Key Date tests should cover starter copy on Church creation, fixed/computed/manual occurrence resolution, irregular known-occurrence behavior, and Template anchors to Key Date definitions.
- Operation contract tests should use typed server/domain boundaries where practical, with batch-shaped inputs/outputs and MCP/CLI-safe error behavior.
- Prior art includes the current agent operation tests, Drizzle-backed app tests, Testcontainers patterns from the migration, and the ADRs for local date/UTC instant modeling and domain Activity logging.

## Out of Scope

- Full end-user UI for Task creation, assignment, movement, completion, cancellation, or Workflow boards.
- Full Team and Workflow setup UI beyond any minimal data required to seed/prove defaults.
- Full Template authoring UI, Key Date management UI, or scheduling library UI.
- Saved Views, Boards, Board Columns, and per-Board status mappings.
- Custom Church-defined Task States beyond preserving room for them later.
- Team-level Roles or custom permission models beyond Church Membership Role plus Team Membership visibility.
- Billing, subscription gating, read-only lapsed Church behavior, and plan management.
- Live Event Execution.
- Full event sourcing or rebuilding entity state by replaying Activities.
- Polished CLI/MCP command UX for all work operations; this PRD only establishes safe operation foundations and smoke tests.

## Further Notes

This PRD depends on the agent-first product interface and testing foundation already specified in prior PRDs. It should respect the domain glossary in `CONTEXT.md`, especially the distinction between Workflow Status, Task State, Board Column, Cycle, Cycle Adjustment, Template, Key Date, Source Template, and Activity. The most important deep modules are Church Time/Cycle Calendar, Cycle Maintenance, Activity Registry, Workflow Model, Template Projection, Cycle Adjustment Merge, Key Date Scheduling, Better Auth Church/Team Extensions, and Core Work Operation Contracts.
