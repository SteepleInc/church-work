# Church Task

Church Task is the context for coordinating recurring and project-based work in a church. It covers the language of tasks, templates, teams, and church rhythms; real-time service execution is adjacent future language, not part of this context yet.

## Language

**Church Task Management**:
The bounded context for planning and tracking church work that needs to be assigned, scheduled, and completed. It includes recurring cadence-driven work and project-based work.
_Avoid_: Planning Center clone, Trello clone

**Church**:
The top-level tenant in Church Task, presented to users as the church they belong to. In code and technical integrations this same concept may be called an Org.
_Avoid_: Workspace, account

**Org**:
The technical synonym for Church used in code, authentication, and internal implementation language. It should not replace Church in user-facing domain language.
_Avoid_: Organization as a user-facing label

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
The weekly planning surface for work in a specific week, including past, current, and future weeks. Monthly, quarterly, yearly, and weekly template work flows into the relevant Cycle, and a Cycle may also include one-off work or week-specific adjustments.
_Avoid_: Sprint, task run, occurrence

**Cycle Adjustment**:
A week-specific change to Cycle work, such as moving, removing, or changing a task for that week. A Cycle Adjustment does not change the Source Template.
_Avoid_: Override, exception

**Template**:
A reusable set of tasks for work that repeats on a yearly, quarterly, monthly, or weekly cadence. A Church may have many active Templates, scoped to the whole Church or to a Team; applicable Template work flows into the relevant weekly Cycle. Template edits affect future Cycles by default and do not change existing Cycle tasks.
_Avoid_: Checklist, run sheet

**Template Task**:
A task definition inside a Template before it appears in a Cycle. A Template Task follows the same assignment rules as a Task and becomes a Task when its Scheduling Rule places it into a Cycle.
_Avoid_: Template card

**Scheduling Rule**:
The rule that determines when a Template Task appears in a Cycle. Scheduling Rules may be relative to a cadence, based on a recurring pattern such as the last Friday of a month, or fixed to a specific calendar date.
_Avoid_: Cron, recurrence expression

**Key Date**:
A named date with planning significance for a Church, such as Easter, Christmas, Mother's Day, Thanksgiving, or a church anniversary. Each Church owns its Key Dates, though the product may offer default Key Dates by locale or tradition; a Key Date may be used by Scheduling Rules to place Template Tasks into the relevant Cycle.
_Avoid_: Holiday, observed date, special day

**Source Template**:
The Template that caused a Cycle task to exist. A generated Task may show its Source Template, but editing the generated Task does not change the Template unless the user explicitly edits the Template.
_Avoid_: Origin, parent template

**Task**:
A unit of church work that can be assigned, scheduled, tracked, and completed. A Task may be assigned to one Team, one User, both, or neither; completion belongs to the Task, not to each assignee. A Task without a Source Template is still just a Task.
_Avoid_: Card when referring to the domain concept; one-off task, manual task

**Subtask**:
A Task that belongs to a parent Task. A Subtask may be presented in a checklist-like style, but its defining relationship is that it is subordinate to another Task; parent Task completion is independent from Subtask completion.
_Avoid_: Checklist item

**Due Date**:
The date by which a Task should be completed. Due Date is the only task date concept until the domain proves it needs separate scheduling and deadline language.
_Avoid_: Scheduled date, deadline

**Team**:
A group responsible for an area of church work, such as Production, Kids, or Events. Team assignment establishes responsibility and visibility for a Task.
_Avoid_: Department, ministry

**User**:
An individual who can be assigned to tasks within a Church. A User may belong to many Teams or no Teams; user assignment identifies who is expected to execute work, but the assigned Team remains the accountability boundary when present.
_Avoid_: Person

**Board**:
A saved view of Tasks used for planning and tracking. A Board may define filters, layout, grouping, and sorting, such as a user's tasks, selected Teams' tasks, or all Church tasks; Boards do not own Tasks.
_Avoid_: Project board as the default term, task container

**Board Column**:
A presentation lane on a Board derived from the Board's grouping. A Team may use its own Board Columns to move work through a team-specific workflow, but those columns still map back to the Task's canonical Task State.
_Avoid_: Board-owned status, Jira workflow status

**Workflow**:
The ordered set of columns a Task moves through. A Task assigned to a Team uses that Team's Workflow; a Task without a Team uses the Church default Workflow. The first Workflow column maps to To Do, the last maps to Done, and any middle columns map to In Progress.
_Avoid_: Board workflow

**Task State**:
The canonical workflow status of a Task: To Do, In Progress, or Done. A Task has one Task State regardless of which Boards display it, so leaders can understand whether work is moving or complete across Teams.
_Avoid_: Percent complete, story status

## Example Dialogue

**Pastor**: We need the Easter graphics work to show up every year in the Cycle that contains Easter.

**Product**: Add a Template Task to the yearly Template with a Scheduling Rule based on the Easter Key Date. When that Cycle is viewed, the generated Task will show the yearly Template as its Source Template.

**Pastor**: Production owns it, but Steve is doing it this year.

**Product**: Assign the Task to the Production Team and Steve as the User. Production remains the accountability boundary, and Steve is the expected executor.

**Pastor**: That week has a holiday, so can we move the due date from Monday to Tuesday without changing future years?

**Product**: Yes, make a Cycle Adjustment in that Cycle. The Source Template stays unchanged.

**Pastor**: I want to see just Production and Kids work together.

**Product**: Create a Board filtered to those Teams. It will display matching Tasks, but the Tasks still keep their own Team, Workflow, and Task State.
