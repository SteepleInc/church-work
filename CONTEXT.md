# Church Task

Church Task is the context for coordinating recurring and project-based work in a church. It covers the language of tasks, templates, teams, and church rhythms; real-time service execution is adjacent future language, not part of this context yet.

## Language

**Church Task Management**:
The bounded context for planning and tracking church work that needs to be assigned, scheduled, and completed. It includes recurring cadence-driven work and project-based work.
_Avoid_: Planning Center clone, Trello clone

**Church**:
The user-facing label for an Org, presented to users as the church they belong to.
_Avoid_: Workspace, account, Org in user-facing product copy

**Church Time Zone**:
The local time zone used to determine a Church's weekly Cycle boundaries. It is collected during Church onboarding and may be changed by an owner or admin.
_Avoid_: User time zone, browser time zone

**Org**:
The top-level tenant domain model in Church Task. An Org is presented to users as a Church, but code, authentication, internal implementation language, and route structure may use Org.
_Avoid_: Organization as a user-facing label, Workspace, account

**Live Event Execution**:
Future-adjacent language for tracking time-sensitive work during an active service or event. It is not part of the initial task management context.
_Avoid_: Service mode, real-time tasks

**Event**:
A dated church occurrence that may have work associated with it. A worship service is a type of Event, but Event is not the central organizing concept for initial task management.
_Avoid_: Service as the general occurrence term

**Cadence**:
A repeating rhythm that causes church work to recur, such as weekly, monthly, or quarterly. The weekly cadence is the primary initial cadence.
_Avoid_: Cycle, schedule pattern

**Cycle**:
The Monday-to-Sunday weekly planning surface for work in a specific Church week, using the Church Time Zone. Every Task belongs to one Cycle; monthly, quarterly, yearly, and weekly template work flows into the relevant Cycle, and a Cycle may also include one-off work or week-specific adjustments.
_Avoid_: Sprint, task run, occurrence

**Cycle Adjustment**:
A week-specific change to Cycle work, such as moving, skipping, or changing a task for that week. A Cycle Adjustment does not change the Source Template; deleting a projected Task from a Cycle is represented as skipping it for that Cycle.
_Avoid_: Override, exception, hard delete of projected work

**Template**:
A reusable set of tasks organized around a Focus Window. A Church may have many active Templates, scoped to the whole Church or to a Team; applicable Template work flows into the relevant weekly Cycle. Template edits affect future Cycles by default and do not change existing Cycle tasks.
_Avoid_: Checklist, run sheet

**Focus Window**:
The period a Template is centered on, such as a week, month, quarter, sermon series, event season, or a single date. Template Tasks may be scheduled before, during, or after the Focus Window.
_Avoid_: Planning period, template period

**Anchor Date**:
An optional date inside a Focus Window that a Template can use as a scheduling reference, such as Easter, the first Sunday of a sermon series, or a specific weekly service date. Not every Template has an Anchor Date.
_Avoid_: End date, target date

**Template Task**:
A task definition inside a Template before it appears in a Cycle. A Template Task follows the same assignment rules as a Task and becomes a Task when its Scheduling Rule places it into a Cycle.
_Avoid_: Template card

**Scheduling Rule**:
The rule that determines when a Template Task appears in a Cycle. Scheduling Rules may be relative to a Focus Window, relative to an Anchor Date when one exists, or fixed to a specific date.
_Avoid_: Cron, recurrence expression

**Key Date**:
A named date with planning significance for a Church, such as Easter, Christmas, Mother's Day, Thanksgiving, or a church anniversary. Each Church owns its Key Dates, though the product may offer default Key Dates by locale or tradition; a Key Date may be used by Scheduling Rules to place Template Tasks into the relevant Cycle.
_Avoid_: Holiday, observed date, special day

**Source Template**:
The Template that caused a Cycle task to exist. A generated Task may show its Source Template, but editing the generated Task does not change the Template unless the user explicitly edits the Template.
_Avoid_: Origin, parent template

**Task**:
A unit of church work inside a Cycle that can be assigned, scheduled, tracked, and completed. A Task may be assigned to one Team, one User, both, or neither; User assignment means one expected executor, while Team assignment remains the accountability boundary. A Task without a Source Template is still just a Task.
_Avoid_: Card when referring to the domain concept; one-off task, manual task

**Subtask**:
A Task that belongs to a parent Task. A Subtask may belong to a different Cycle than its parent Task; parent Task completion is independent from Subtask completion.
_Avoid_: Checklist item

**Due Date**:
The date by which a Task should be completed. Due Date is the only task date concept until the domain proves it needs separate scheduling and deadline language.
_Avoid_: Scheduled date, deadline

**Team**:
A group responsible for an area of church work, such as Production, Kids, or Events. Team assignment establishes responsibility and visibility for a Task.
_Avoid_: Department, ministry

_Note_: There is no global Active Team; Teams are used contextually for filtering, visibility, workflow, and assignment inside the Active Church.

**Team Color**:
The color assigned to a Team from a fixed product palette, shown wherever the Team is represented visually (such as its avatar). A Team Color is assigned automatically when the Team is created, derived from its name, and is stored with the Team so it can later be changed by Users.
_Avoid_: Arbitrary hex colors, avatar color as a separate concept

**Team Membership**:
The relationship between a User and a Team inside a Church. Team Membership determines which Team's work is naturally visible and relevant to that User.
_Avoid_: Department membership, ministry membership

**User**:
An individual who can be assigned to tasks within a Church. A User may belong to many Teams or no Teams; user assignment identifies who is expected to execute work, but the assigned Team remains the accountability boundary when present.
_Avoid_: Person

**Church Membership**:
The relationship between a User and a Church. A Church Membership has one access Role and determines whether the User can see and participate in that Church's work.
_Avoid_: Account membership, workspace membership

**Active Church**:
The Church currently selected for a User's session. Church Task shows work, Teams, Templates, and Boards inside the Active Church by default. On login, the Active Church is restored from the User's previous session when possible; a User with Churches but no restorable selection gets their most recently joined Church, and a User with no Churches has no Active Church and is taken to Onboarding.
_Avoid_: Current org, selected workspace

**Onboarding**:
The flow a User completes to set up a new Church before entering the product. Onboarding has three steps — Church Profile, Initial Teams, and Finished — and a Church is created as soon as the Church Profile step is submitted, before Onboarding is complete.
_Avoid_: Setup wizard, signup flow

**Onboarding Step**:
One screen of Onboarding: Church Profile (tell us about your Church), Initial Teams (review starting Teams), or Finished (enter the product). The current step is derived from Church and session state, not stored as its own record.
_Avoid_: Page, screen number

**Starter Teams**:
The default Teams every new Church begins with: Worship, Production, Kids, Experience, Facilities, and Social Media. Starter Teams are seeded when the Church is created and may be renamed or removed during Onboarding's Initial Teams step.
_Avoid_: Default initial teams, suggested teams as a separate concept

**Completed Onboarding**:
The Church-level fact that Onboarding has finished. A Church that exists but has not Completed Onboarding sends its Users back into Onboarding rather than the product.
_Avoid_: Per-step completion flags, user-level onboarding state

**Church Invitation**:
An invitation for a User to join a Church with a specific Role. A Church Invitation may be accepted after authentication and creates a Church Membership.
_Avoid_: Org invite, workspace invite

**Role**:
The access level a Church Membership grants within a Church. The initial Roles are owner, admin, and member; custom church-specific Roles are not part of the initial language.
_Avoid_: Permission set, title

**Saved View**:
A reusable way of seeing Tasks for planning and tracking. A Saved View may define filters, layout, grouping, and sorting, such as a user's tasks, selected Teams' tasks, or all Church tasks; Saved Views do not own Tasks.
_Avoid_: Project board as the default term, task container

**Board**:
A kanban-style presentation of a Saved View. A Board groups Tasks into columns, but it does not own Tasks or define their canonical Task State.
_Avoid_: Board as the general saved-view concept

**System Board**:
A built-in Board presentation of a System Saved View, such as My Work, a default Team view, or Our Work for all visible Church work. A System Board is permanent in product navigation and cannot be deleted by Users.
_Avoid_: Hard-coded page, special board

**System Saved View**:
A built-in Saved View created or maintained by Church Task, such as My Work, a default Team view, or Our Work for all visible Church work. A System Saved View behaves like a Saved View but is permanent in product navigation and cannot be deleted by Users.
_Avoid_: Hard-coded view, special view

**Board Column**:
A presentation lane on a Board derived from the Board's grouping or status mapping. A Board Column does not own Task state; it presents Tasks based on their underlying Workflow Status or other grouping field.
_Avoid_: Task status, Workflow Status

**Board Order**:
The manual, user-defined ordering of Tasks within a Board Column, changed by dragging a card and persisted so every viewer of the Board sees the same order. Board Order is the only card ordering concept; Tasks do not have a priority.
_Avoid_: Priority, rank as a user-facing term, sort order of creation

**Workflow**:
The ordered set of Workflow Statuses a Task moves through. A Task assigned to a Team uses that Team's Workflow; a Task without a Team uses the Church default Workflow.
_Avoid_: Board workflow

**Workflow Status**:
A specific position in a Workflow, such as To Do, Waiting on Assets, Needs Review, or Done. Each Workflow Status maps to one Task State.
_Avoid_: Workflow Column, Board Column

**Task State**:
The canonical category of a Task's Workflow Status: To Do, In Progress, Done, or Canceled. Initial Task States are fixed, though future product versions may allow Churches to define their own Task States.
_Avoid_: Percent complete, story status

**App Administration**:
The cross-Church support surface for operating Church Task itself, reached under the `/admin` route. App Administration lists every Church and every User across all tenants, unlike normal product surfaces which are scoped to the Active Church.
_Avoid_: Internal tools as the canonical name, super admin area, back office

**App Administrator**:
A User granted an application-level admin role that is independent of any Church Membership Role. App Administrator status is what authorizes the App Administration surface and User impersonation; being an owner or admin of one's own Church does not make a User an App Administrator.
_Avoid_: Super admin, owner, staff, global admin

**Impersonation**:
An App Administrator action that starts a session acting as another User for support purposes. Impersonation is gated to App Administrators and is distinct from any Church Membership.
_Avoid_: Login as, sudo, masquerade

**Collection**:
The reusable presentation of a list of domain records as either a sortable, filterable table or a card grid, with a toolbar, row actions, and an optional Details Pane. A Collection is the standard way App Administration and product surfaces render Churches, Users, and similar lists.
_Avoid_: Data table as the canonical name, grid, list view

**Details Pane**:
The side panel that opens when a record in a Collection is selected, showing that record's header, tabs, actions, and detail sections without leaving the list. A Details Pane keeps a history stack so navigating between related records can be reversed.
_Avoid_: Drawer, sidebar, inspector

**Action Loading**:
The sanctioned loading treatment for an in-flight async action the user just triggered: an overlay spinner on the triggering control (Button, menu item) with dimmed content and no layout shift. Action Loading is the only place a spinner may appear.
_Avoid_: Page spinner, full-screen loader, "Loading..." text

**Skeleton**:
A shaped, non-animated-spinner placeholder rendered in a data region while its data has not yet arrived, matching the layout the real content will occupy. Skeletons are the only acceptable placeholder for absent data; they never block surrounding chrome from rendering.
_Avoid_: Spinner, loader, "Loading X..." text placeholders

**Render Gate**:
A forbidden pattern where rendering of a route, layout, or shell is blocked until async state (auth, session, Active Church, data) resolves. Chrome must render immediately; absent data is handled by Skeletons or omission, and redirects happen after the fact.
_Avoid_: Full-screen loader, AuthLoading gate, route pending component

**Optimistic Shell**:
Rendering the app chrome (sidebar, header, page structure) immediately on load, before auth or Active Church state has resolved, trusting the session cookie for the fast path. If the optimism proves wrong, the user is redirected after the fact rather than gated up front.
_Avoid_: Auth gate, loading screen

**Empty State**:
The content a Collection or surface shows when its data has finished loading and is genuinely empty. Loading suppresses the Empty State; it must never flash while data is still arriving.
_Avoid_: "No results" flash, "Loading X..." text

## Example Dialogue

**Pastor**: We need the Easter graphics work to show up every year in the Cycle that contains Easter.

**Product**: Add a Template Task to the yearly Template with a Scheduling Rule based on the Easter Key Date. When that Cycle is viewed, the generated Task will show the yearly Template as its Source Template.

**Pastor**: Production owns it, but Steve is doing it this year.

**Product**: Assign the Task to the Production Team and Steve as the User. Production remains the accountability boundary, and Steve is the expected executor.

**Pastor**: That week has a holiday, so can we move the due date from Monday to Tuesday without changing future years?

**Product**: Yes, make a Cycle Adjustment in that Cycle. The Source Template stays unchanged.

**Pastor**: I want to see just Production and Kids work together.

**Product**: Create a Board filtered to those Teams. It will display matching Tasks, but the Tasks still keep their own Team, Workflow, and Task State.
