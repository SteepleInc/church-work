# Product Requirements Roadmap

This document lists the first high-level PRDs for Church Task and the current implementation state as of June 18, 2026. The original entries are intentionally compact; the `Implementation now` notes below are the current repo truth for what has landed versus what remains roadmap scope.

Current-truth architecture is defined by [PRD #164](https://github.com/SteepleInc/church-task/issues/164) and the ADRs in `docs/adr/`: Postgres/Drizzle is the source-of-truth data layer, Zero backs product data and Collections, Better Auth uses Postgres, TanStack Start owns the web/runtime shell, and Effect owns typed server/CLI/MCP/scheduled work. Earlier PRDs below may preserve historical scope language, but old-stack persistence/runtime, starter billing, and old package references are not implementation guidance for new work.

## 1. Agent CLI and MCP Foundation

Status: Implemented on the current Postgres/Zero/TanStack Start stack; migration follow-up [#179](https://github.com/SteepleInc/church-task/issues/179) is closed.

Implementation now: `packages/cli`, `packages/domain/src/agent-contracts.ts`, and `backend/server/src/agent-operations.ts` provide the CLI/agent operation spine, with tests in `packages/cli/src/cli.test.ts` and server tests. The foundation is real enough for health/current-user/church/task-oriented smoke paths, but the product-level MCP surface is still intentionally compact rather than a complete UI-equivalent automation API.

Agent CLI and MCP Foundation establishes the reusable agent-facing product interface before the user workflow PRDs depend on it. The implementation now uses Effect for CLI/runtime composition, typed server/domain contracts, Drizzle-backed server operations, and Better Auth token primitives for bearer, MCP OAuth/OIDC, and durable CLI credential handling instead of custom auth storage. It proves authenticated CLI/MCP access with health, current User, Active Church readiness, and minimal typed smoke-test operations, but does not include full Task, Team, Template, Cycle, or Board workflows.

## 2. Testing Foundation for Postgres/Zero-Backed UI

Status: Implemented and expanded for the new stack; high-fidelity E2E migration follow-up [#181](https://github.com/SteepleInc/church-task/issues/181) is closed.

Implementation now: the repo has Vitest coverage across db/auth/zero/server/web data helpers plus Playwright specs for onboarding, invitations, tasks/boards, teams/workflows, labels, auth OTP, app shell, admin collections, tracer, and legacy UI flows. The root scripts now expose focused E2E commands for onboarding, labels, tasks boards, teams workflows, and invitations.

Testing Foundation for Postgres/Zero-Backed UI establishes local-first confidence before Church Task moves beyond boilerplate into authenticated Church and Task workflows. It uses Playwright for browser workflow tests against the TanStack Start app, Testcontainers Postgres, Drizzle migrations/seeds, Better Auth, and Zero where needed; Vitest covers backend public-interface and package tests. It proves auth/dashboard and backend behavior without introducing React component tests as a default layer; production deployment and future Church/Task domain tests remain separate scope.

## 3. Church Onboarding and Membership

Status: Implemented on the new stack; migration follow-ups [#171](https://github.com/SteepleInc/church-task/issues/171) and [#178](https://github.com/SteepleInc/church-task/issues/178) are closed.

Implementation now: Better Auth organization membership/invitation flows are wired through the TanStack Start UI, onboarding routes, org switcher, settings/member surfaces, and app data helpers. Users can create/switch Churches, complete onboarding, invite members, and accept invitations; custom roles and billing remain out of scope.

Church Onboarding and Membership lets a new User create their first Church, accept a Church Invitation after authentication, and become productive only after they have a Church Membership. It models each Church as the top-level tenant with `owner`, `admin`, and `member` Roles, supports Users belonging to multiple Churches, and lets them choose their Active Church from the primary app navigation. It includes inviting members, accepting invitations, switching Churches, and creating another Church from the Church switcher; it does not include Teams, task assignment, billing rules, or custom church-specific Roles.

## 4. Core Work Data Model

Status: Implemented as the current schema foundation; migration follow-ups [#167](https://github.com/SteepleInc/church-task/issues/167), [#170](https://github.com/SteepleInc/church-task/issues/170), and [#175](https://github.com/SteepleInc/church-task/issues/175) are closed.

Implementation now: `packages/db/src/schema.ts` contains durable tables for teams, tasks, workflows, labels, cycles, templates, activities, and supporting auth/org data, with Zero schema/query/mutator support in `packages/zero`. Template projection and cycle behavior have package-level tests, and scheduled cycle maintenance has been ported to Effect-backed server code.

Core Work Data Model establishes the durable Postgres/Drizzle/Zero-backed domain model for Tasks, Subtasks, Cycles, Templates, Template Tasks, Scheduling Rules, Key Dates, Teams, Workflows, Workflow Statuses, Source Templates, Cycle Adjustments, Activities, and Church Time Zone before the product builds deeper workflows on top of them. It proves the full Template-to-Cycle-to-Task projection path in the data layer, makes explicit that every Task belongs to a Cycle, and ensures Cycle Adjustments can change a week's work without changing the Source Template. It includes Drizzle schema, invariants, typed read/write API boundaries, projection behavior, and MCP/CLI-safe operation foundations, but does not require full end-user UI for every concept yet.

## 5. Team and Workflow Setup

Status: Implemented for default setup, team/workflow management, navigation, and settings; migration follow-up [#172](https://github.com/SteepleInc/church-task/issues/172) is closed.

Implementation now: onboarding bootstraps default Teams/Workflows, the app has team routes and team navigation, settings pages cover team general/members surfaces, and the data layer has Teams/Workflows helpers. Later ADR work also made Team ownership mandatory for Tasks and added team-scoped Task Identifiers.

Team and Workflow Setup gives every new Church a useful starting set of default Teams and Workflows so leaders can begin organizing work without blank-slate configuration. Owners and admins can rename, add, archive, and reorder Teams, manage Team Memberships, and define the Workflow Statuses each Team's Tasks move through while still mapping to canonical Task States: To Do, In Progress, Done, and Canceled. It supports both web UI and MCP/CLI operations, uses Team Membership to determine visibility and relevance, and does not include team-level Roles, custom permission models, creating Tasks, or assigning Tasks to Users.

## 6. Task Execution and Assignment

Status: Implemented for the first real task execution surface; migration follow-up [#173](https://github.com/SteepleInc/church-task/issues/173) and original execution slices through [#71](https://github.com/SteepleInc/church-task/issues/71) are closed.

Implementation now: My Work, Our Work, and Team board routes use the shared task execution surface with create/update/batch update behavior, workflow movement, assignments, due dates, labels, details panes, quick actions, and E2E smoke coverage. Some newer card controls may still be local/stubbed until wired through the data model, so each field should be checked before treating it as fully persisted product semantics.

Task Execution and Assignment lets Users create, update, assign, move, and complete Tasks in the current weekly Cycle by default through both the web UI and MCP/CLI. The first web UI is a kanban-style Workflow view, using Team or Church default Workflow Statuses while preserving each Task's canonical Task State. It includes changing the Cycle when needed, optional Team/User assignment, batch-shaped operations, Subtasks, Due Dates, and Workflow movement, but does not include template authoring, saved views, or advanced weekly planning tools.

## 7. Weekly Cycle Planning

Status: Partially implemented. The Cycle data model, current-cycle-backed task defaults, due-date/cycle movement semantics, and scheduled cycle maintenance exist, but the dedicated week-by-week planning UI described here is not yet fully built.

Implementation now: cycle tables, app data helpers, template-to-cycle projection tests, and server scheduled work cover the backend foundation. Remaining work is the planning-specific web surface for reviewing past/current/future Cycles, day grouping, and first-class Cycle Adjustment UX.

Weekly Cycle Planning gives Churches a week-by-week planning surface for past, current, and future Cycles. Users can review the Tasks projected into a Cycle, add week-specific Tasks, view the week as days with Tasks grouped by Due Date, and make Cycle Adjustments such as moving, deleting, or changing Tasks for that week without changing the Source Template. It supports web UI and MCP/CLI operations, represents deletion of projected Tasks as skipped work under the hood, and does not include Template authoring, saved views, or live event execution.

## 8. Template Library and Scheduling

Status: Partially implemented. Template/key-date/cycle schema, projection logic, and app data helpers have landed via migration follow-up [#175](https://github.com/SteepleInc/church-task/issues/175), but the complete authoring library UI is still roadmap scope.

Implementation now: `packages/domain/src/template-projection.ts`, db schema, Zero integration tests, and web template data files provide the persistence/projection foundation. Remaining work is the end-user Template Library authoring and scheduling experience across all Focus Window cases.

Template Library and Scheduling lets Churches create reusable Templates organized around a Focus Window, such as a week, month, quarter, sermon series, event season, or single date. Template Tasks use Scheduling Rules relative to the Focus Window, an optional Anchor Date, a Key Date Occurrence, or a fixed date so work can appear in the right weekly Cycle before, during, or after the focused period. It supports web UI and MCP/CLI operations, includes Key Date and Key Date Occurrence management for scheduling, projects Template work into Cycle Tasks with a Source Template, and does not include live event execution or saved views.

## 9. Saved Views and Boards

Status: Partially implemented. Board/task routes and collection query/filter helpers exist, but reusable user-defined Saved Views are not implemented yet.

Implementation now: My Work, Our Work, Team boards, admin Collections, URL/query-state helpers, filters, sorting, and card/table-style collection infrastructure provide much of the view substrate. Remaining work is the domain model and UX for named personal/church/system Saved Views with persisted filters, grouping, sorting, layout, and visible fields.

Saved Views and Boards lets Users create reusable ways of seeing Tasks without changing Task ownership or workflow. A Saved View can be personal, Church-shared, or a permanent System Saved View such as My Work, a default Team view, or the all-Church view, and can define filters, grouping, sorting, layout, and visible fields across dimensions such as Team, User, Cycle, Due Date, Source Template, and Task State. It supports board/kanban presentation first, leaves room for calendar and other layouts later, supports web UI and MCP/CLI operations, and does not include Saved View-owned statuses, separate workflows, or Template authoring.

## 10. Subscription and Plan Management

Subscription and Plan Management is deferred. Billing and payment integration, including the earlier Polar-backed checkout concept, are outside the current Postgres/Zero migration and should not be treated as implemented architecture.
