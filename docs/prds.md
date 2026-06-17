# Product Requirements Roadmap

This document lists the first high-level PRDs for Church Task. Each entry is intentionally limited to a title and three-sentence description; deeper PRDs and GitHub Projects can expand from these once the roadmap shape is stable.

Current-truth architecture is defined by [PRD #164](https://github.com/SteepleInc/church-task/issues/164) and the ADRs in `docs/adr/`: Postgres/Drizzle is the source-of-truth data layer, Zero backs product data and Collections, Better Auth uses Postgres, TanStack Start owns the web/runtime shell, and Effect owns typed server/CLI/MCP/scheduled work. Earlier PRDs below may preserve historical scope language, but old-stack persistence/runtime, starter billing, and old package references are not implementation guidance for new work.

## 1. Agent CLI and MCP Foundation

Status: Speced in [GitHub issue #11](https://github.com/SteepleInc/church-task/issues/11), with TDD implementation slices in child issues #12-#20.

Agent CLI and MCP Foundation establishes the reusable agent-facing product interface before the user workflow PRDs depend on it. The implementation now uses Effect for CLI/runtime composition, typed server/domain contracts, Drizzle-backed server operations, and Better Auth token primitives for bearer, MCP OAuth/OIDC, and durable CLI credential handling instead of custom auth storage. It proves authenticated CLI/MCP access with health, current User, Active Church readiness, and minimal typed smoke-test operations, but does not include full Task, Team, Template, Cycle, or Board workflows.

## 2. Testing Foundation for Postgres/Zero-Backed UI

Status: Speced in [GitHub issue #21](https://github.com/SteepleInc/church-task/issues/21), with implementation slices in child issues #22-#29.

Testing Foundation for Postgres/Zero-Backed UI establishes local-first confidence before Church Task moves beyond boilerplate into authenticated Church and Task workflows. It uses Playwright for browser workflow tests against the TanStack Start app, Testcontainers Postgres, Drizzle migrations/seeds, Better Auth, and Zero where needed; Vitest covers backend public-interface and package tests. It proves auth/dashboard and backend behavior without introducing React component tests as a default layer; production deployment and future Church/Task domain tests remain separate scope.

## 3. Church Onboarding and Membership

Status: Speced in [GitHub issue #1](https://github.com/SteepleInc/church-task/issues/1), with implementation slices in child issues #2-#10.

Church Onboarding and Membership lets a new User create their first Church, accept a Church Invitation after authentication, and become productive only after they have a Church Membership. It models each Church as the top-level tenant with `owner`, `admin`, and `member` Roles, supports Users belonging to multiple Churches, and lets them choose their Active Church from the primary app navigation. It includes inviting members, accepting invitations, switching Churches, and creating another Church from the Church switcher; it does not include Teams, task assignment, billing rules, or custom church-specific Roles.

## 4. Core Work Data Model

Status: PRD completed in [GitHub issue #30](https://github.com/SteepleInc/church-task/issues/30).

Core Work Data Model establishes the durable Postgres/Drizzle/Zero-backed domain model for Tasks, Subtasks, Cycles, Templates, Template Tasks, Scheduling Rules, Key Dates, Teams, Workflows, Workflow Statuses, Source Templates, Cycle Adjustments, Activities, and Church Time Zone before the product builds deeper workflows on top of them. It proves the full Template-to-Cycle-to-Task projection path in the data layer, makes explicit that every Task belongs to a Cycle, and ensures Cycle Adjustments can change a week's work without changing the Source Template. It includes Drizzle schema, invariants, typed read/write API boundaries, projection behavior, and MCP/CLI-safe operation foundations, but does not require full end-user UI for every concept yet.

## 5. Team and Workflow Setup

Status: Speced in [GitHub issue #47](https://github.com/SteepleInc/church-task/issues/47).

Team and Workflow Setup gives every new Church a useful starting set of default Teams and Workflows so leaders can begin organizing work without blank-slate configuration. Owners and admins can rename, add, archive, and reorder Teams, manage Team Memberships, and define the Workflow Statuses each Team's Tasks move through while still mapping to canonical Task States: To Do, In Progress, Done, and Canceled. It supports both web UI and MCP/CLI operations, uses Team Membership to determine visibility and relevance, and does not include team-level Roles, custom permission models, creating Tasks, or assigning Tasks to Users.

## 6. Task Execution and Assignment

Status: Speced in [GitHub issue #60](https://github.com/SteepleInc/church-task/issues/60).

Task Execution and Assignment lets Users create, update, assign, move, and complete Tasks in the current weekly Cycle by default through both the web UI and MCP/CLI. The first web UI is a kanban-style Workflow view, using Team or Church default Workflow Statuses while preserving each Task's canonical Task State. It includes changing the Cycle when needed, optional Team/User assignment, batch-shaped operations, Subtasks, Due Dates, and Workflow movement, but does not include template authoring, saved views, or advanced weekly planning tools.

## 7. Weekly Cycle Planning

Weekly Cycle Planning gives Churches a week-by-week planning surface for past, current, and future Cycles. Users can review the Tasks projected into a Cycle, add week-specific Tasks, view the week as days with Tasks grouped by Due Date, and make Cycle Adjustments such as moving, deleting, or changing Tasks for that week without changing the Source Template. It supports web UI and MCP/CLI operations, represents deletion of projected Tasks as skipped work under the hood, and does not include Template authoring, saved views, or live event execution.

## 8. Template Library and Scheduling

Template Library and Scheduling lets Churches create reusable Templates organized around a Focus Window, such as a week, month, quarter, sermon series, event season, or single date. Template Tasks use Scheduling Rules relative to the Focus Window, an optional Anchor Date, a Key Date Occurrence, or a fixed date so work can appear in the right weekly Cycle before, during, or after the focused period. It supports web UI and MCP/CLI operations, includes Key Date and Key Date Occurrence management for scheduling, projects Template work into Cycle Tasks with a Source Template, and does not include live event execution or saved views.

## 9. Saved Views and Boards

Saved Views and Boards lets Users create reusable ways of seeing Tasks without changing Task ownership or workflow. A Saved View can be personal, Church-shared, or a permanent System Saved View such as My Work, a default Team view, or the all-Church view, and can define filters, grouping, sorting, layout, and visible fields across dimensions such as Team, User, Cycle, Due Date, Source Template, and Task State. It supports board/kanban presentation first, leaves room for calendar and other layouts later, supports web UI and MCP/CLI operations, and does not include Saved View-owned statuses, separate workflows, or Template authoring.

## 10. Subscription and Plan Management

Subscription and Plan Management is deferred. Billing and payment integration, including the earlier Polar-backed checkout concept, are outside the current Postgres/Zero migration and should not be treated as implemented architecture.
