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

**Template**:
A reusable set of tasks for work that repeats on a cadence. A Template can be changed so future generated work follows the updated pattern.
_Avoid_: Checklist, run sheet

**Task**:
A unit of church work that can be assigned, scheduled, tracked, and completed. A Task may be assigned to one or more Teams, one or more People, or both.
_Avoid_: Card when referring to the domain concept

**Team**:
A group of people responsible for an area of church work, such as Production, Kids, or Events. A Team may have its own board containing the work it cares about.
_Avoid_: Department, ministry

**Person**:
An individual who can be assigned to tasks within a Church. A Person may belong to one or more Teams.
_Avoid_: User when referring to domain responsibility

**Board**:
A view of tasks for a Church or Team. Boards organize tasks for planning and tracking, but they do not define ownership by themselves.
_Avoid_: Project board as the default term
