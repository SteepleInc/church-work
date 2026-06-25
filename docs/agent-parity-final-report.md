# Church Work Agent Operation Parity Report

Coverage statuses: covered, partial, missing, generic-passthrough, intentionally-ui-only, not-applicable

| Domain Area                    | Operation                             | Kind  | UI      | MCP                   | CLI                   | Context                                         | Authorization                                                         | UI Behavior                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------- | ----- | ------- | --------------------- | --------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                           | Read Current User                     | read  | covered | covered               | covered               | anonymous                                       | Authenticated User                                                    | Shared useSession reads the current User and allows anonymous/null while auth resolves                                                                                                                                                                                                      |
| Church                         | Resolve Active Church                 | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | App shell and Work page resolve Active Church from session activeOrganizationId and membership-backed Church data                                                                                                                                                                           |
| Church Settings                | Update Church Profile Settings        | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Settings Workspace General saves Church profile fields through Better Auth organization.update, normalizes optional blank values, requires Church name and Church Time Zone, and disables edits for non-owner/admin Church Members                                                          |
| Church Time Zone               | Update Church Time Zone               | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Settings Workspace General saves Church Time Zone through Better Auth organization.update; the auth hook adjusts Cycle rows so past Cycles keep their old boundaries, the current Cycle keeps its start instant, and current/future Cycle end/start boundaries use the new Church Time Zone |
| Rolling Materialization Window | Update Rolling Materialization Window | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Settings Workspace Scheduling clamps the Rolling Materialization Window to 1-52 Weeks, confirms before expansion because additional scheduled Template work may become real Tasks, and documents that narrowing never deletes already materialized Tasks                                    |
| Onboarding                     | Create Church Profile                 | write | covered | intentionally-ui-only | intentionally-ui-only | authenticated                                   | Authenticated User                                                    | Church profile onboarding step creates a Better Auth organization, persists completedOnboarding=false, selects it as Active Church, and advances from live Active Church state                                                                                                              |
| Onboarding                     | Review Starter Teams                  | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Initial Teams onboarding step lists seeded Starter Teams by sort order, opens Team create/edit quick actions, allows removal, and disables continue until at least one Team remains                                                                                                         |
| Onboarding                     | Review Starter Key Dates              | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Finished onboarding step reviews seeded Starter Key Dates, sorts by next occurrence, shows editable-later copy, and lets Users remove unwanted Key Dates before entering Church Work                                                                                                        |
| Onboarding                     | Complete Onboarding                   | write | covered | intentionally-ui-only | intentionally-ui-only | authenticated, Active Church, Church Membership | Church Membership                                                     | Finished onboarding step calls Better Auth completeOnboarding, refetches the session, and relies on redirectIfOnboarded once the Active Church reflects Completed Onboarding                                                                                                                |
| Task                           | List Tasks                            | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Work page TaskExecutionSurface lists Tasks from useTasksCollection                                                                                                                                                                                                                          |
| Work View                      | Read My Work                          | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | My Work reads cross-Team Tasks assigned to the current User by default, supports the Created View Tab, and carries View Tab, View Options, filters, and Insights state in the URL                                                                                                           |
| Work View                      | Read Our Work                         | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Our Work reads all visible Church Tasks by default, applies All, Active, and Done View Tabs, and carries View Tab, View Options, filters, and Insights state in the URL                                                                                                                     |
| Work View                      | Read Team View                        | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Team views read a Team's real Tasks, optionally scoped by Week/Cycle on Team Week board routes, and apply All, Active, and Done View Tabs without showing projected Template Tasks until materialized                                                                                       |
| View Tab                       | Apply View Tab                        | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | View Tabs compile to Task read filters: My Work Assigned/Created, and Our Work or Team All/Active/Done; the tab is URL state separate from ad-hoc filters and View Options                                                                                                                  |
| View Options                   | Apply Presentation View Options       | read  | covered | not-applicable        | not-applicable        | authenticated, Active Church, Church Membership | Church Membership                                                     | View Options change URL-carried presentation settings for mode, grouping, ordering, subtask visibility, empty columns, and display properties; only ordering and subtask visibility affect agent-readable Task list filters                                                                 |
| Board                          | Read Board Presentation               | read  | covered | not-applicable        | not-applicable        | authenticated, Active Church, Church Membership | Church Membership                                                     | Board and list modes render the same active Work View Task set as cards or rows; Board Columns are derived from grouping or Task State and do not own Task State                                                                                                                            |
| Insights                       | Read Task Insights                    | read  | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Insights reads the current Work View Task set and summarizes Task count by Slice and optional Segment, with show-canceled controlled by URL state                                                                                                                                           |
| App Administration             | Check App Administrator Access        | read  | covered | missing               | missing               | authenticated                                   | App Administrator                                                     | InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces                                                                                                                                                     |
| App Administration             | List Churches for Support             | read  | covered | missing               | missing               | authenticated                                   | App Administrator                                                     | Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions                                                                                                                                                                         |
| App Administration             | List Users for Support                | read  | covered | missing               | missing               | authenticated                                   | App Administrator                                                     | Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions                                                                                                                                                             |
| App Administration             | Edit Church Support Details           | write | covered | missing               | missing               | authenticated                                   | App Administrator                                                     | Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions                                                                                                                                                                                  |
| App Administration             | Edit User Support Details             | write | covered | missing               | missing               | authenticated                                   | App Administrator                                                     | Admin User details pane action opens the App Administrator-only edit User quick action from UserActions                                                                                                                                                                                     |
| App Administration             | Start User Impersonation              | write | covered | intentionally-ui-only | intentionally-ui-only | authenticated                                   | App Administrator                                                     | Admin User actions call Better Auth admin.impersonateUser only after useIsAppAdmin gating                                                                                                                                                                                                   |
| Team                           | Create Team                           | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses                                                                                                                                |
| Team                           | Rename Team                           | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Team settings use useRenameTeamMutation and trim blank Team names                                                                                                                                                                                                                           |
| Team                           | Change Team Identifier                | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Team settings use useSetTeamIdentifierMutation, normalize to uppercase, reject invalid or duplicate identifiers, and preserve previous identifiers                                                                                                                                          |
| Team                           | Delete Team                           | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Team settings use useDeleteTeamMutation after confirmation and remove Team Memberships for that Team                                                                                                                                                                                        |
| Team                           | Reorder Teams                         | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Settings Team list uses useReorderTeamsMutation to persist Team order per Church                                                                                                                                                                                                            |
| Team Membership                | Add Team Membership                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships                                                                                                                                                                                 |
| Team Membership                | Remove Team Membership                | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator                      | Team navigation membership action uses useRemoveTeamMemberMutation                                                                                                                                                                                                                          |
| Label                          | Create Label                          | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color                                                                                                                 |
| Label                          | Update Label                          | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Label settings inline name form and color picker use useUpdateLabelMutation; invalid stored colors fall back to deterministic name-derived Label colors in the UI                                                                                                                           |
| Label                          | Delete Label                          | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list                                                                                                                                                                        |
| Task                           | Get Task                              | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task details pane opens a Task by its selected collection row/identifier                                                                                                                                                                                                                    |
| Task                           | Create Task                           | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Create Task flow requires a Team, Workflow Status, title, and Due Date before creating work                                                                                                                                                                                                 |
| Task                           | Update Task                           | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task field controls persist title, Team, Workflow Status, assignee, priority, parent, Week/Cycle, and Due Date edits                                                                                                                                                                        |
| Task                           | Assign or Clear Subtask Parent        | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task parent field assigns a parent Task or clears parentTaskId to return the Task to top-level work                                                                                                                                                                                         |
| Task                           | Move Task Between Weeks               | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task Week field and Board/List controls update cycleId while preserving the Team-derived Task Identifier                                                                                                                                                                                    |
| Week/Cycle                     | List Weeks                            | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Team Week board and Week picker list active persisted Weeks, classify them as current/upcoming/completed from today's date, show custom Cycle Name when present, and surface Cycle Description for planning details                                                                         |
| Week/Cycle                     | Update Week Details                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Week planning details can persist Cycle Name and Cycle Description through the UI Zero mutator; no focused MCP or named CLI seam exists yet                                                                                                                                                 |
| Week Progress                  | Read Week Progress                    | read  | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Week tooltip and Week Progress pane read non-canceled Task totals, completed counts, and completion percentage for a selected Week                                                                                                                                                          |
| Week Breakdown                 | Read Week Breakdown                   | read  | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Team Week board reads per-Week Task breakdowns from Zero queries for planning; no focused MCP or named CLI read exists yet beyond generic Task listing filters                                                                                                                              |
| Task                           | Complete Task                         | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task status controls can move a Task to a completed Workflow Status                                                                                                                                                                                                                         |
| Task                           | Cancel Task                           | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task status controls can move a Task to a canceled Workflow Status                                                                                                                                                                                                                          |
| Task                           | Reopen Task                           | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task status controls can reopen finished or canceled Tasks into active work                                                                                                                                                                                                                 |
| Task Comment                   | Create Task Comment                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task Activity Feed composer creates a root Task Comment after requiring an Active Church and non-empty body                                                                                                                                                                                 |
| Task Comment                   | Reply to Task Comment                 | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator                                                                                                                                                        |
| Task Comment                   | Edit Task Comment                     | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Task Comment author, Church owner, Church admin, or App Administrator | Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator                                                                                                                                                                         |
| Task Comment                   | Delete Task Comment                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Task Comment author, Church owner, Church admin, or App Administrator | Task Comment and reply action menus expose confirmed Delete only to the author, Church owner/admin, or App Administrator and leave a tombstone                                                                                                                                              |
| Comment Thread                 | Subscribe to Comment Thread           | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User                                                                                                                                                         |
| Comment Thread                 | Unsubscribe from Comment Thread       | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership                                                     | Root Task Comment action menu can unsubscribe the current User from the Comment Thread and removes the subscribed indicator                                                                                                                                                                 |
| Activity                       | Read Activity Feed                    | read  | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Task Details Pane shows reverse-chronological Task Activity rows for task lifecycle, field, label, and comment events; other UI Activity entity types are queryable for agent history, but non-task entity events are not rendered by describeActivity yet                                  |
| Notification Inbox             | Mark Notification Read                | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Opening an Inbox notification or pressing Mark notification read marks only the current recipient's non-deleted Notification as read                                                                                                                                                        |
| Notification Inbox             | Mark Notification Unread              | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Inbox notification row Mark notification unread returns only the current recipient's Notification to unread                                                                                                                                                                                 |
| Notification Inbox             | Mark All Notifications Read           | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Inbox Mark all read action marks the current recipient's unread Notifications read and leaves other recipients' Notifications untouched                                                                                                                                                     |
| Notification Inbox             | Delete Notification                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Inbox notification row Delete action soft-deletes only the current recipient's Notification                                                                                                                                                                                                 |
| Notification Inbox             | Delete Read Notifications             | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Inbox bulk Delete read confirmation soft-deletes read Notifications for the current recipient only                                                                                                                                                                                          |
| Notification Inbox             | Snooze Notification                   | write | covered | missing               | missing               | authenticated, Active Church, Church Membership | Church Membership recipient                                           | Inbox notification row Snooze menu hides the current recipient's notification until a future preset time and invalid or past snooze inputs are rejected/no-op by the Zero mutator                                                                                                           |
| Template                       | List Templates                        | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template Library lists non-deleted Templates through useTemplatesCollection                                                                                                                                                                                                                 |
| Template                       | Get Template                          | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template detail opens a selected Template with its Template Tasks and Template Schedules                                                                                                                                                                                                    |
| Template                       | Create Weekly Service Template        | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template creation flow creates weekly-service Templates through mutators.templates.create                                                                                                                                                                                                   |
| Template                       | Update Template                       | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template detail persists Template field changes through Template update actions                                                                                                                                                                                                             |
| Template                       | Delete Template                       | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template Library and Template detail soft-delete a Template through useTemplateSoftDeleteActions.deleteTemplate                                                                                                                                                                             |
| Template                       | Restore Template                      | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template deleted-item controls restore a Template through useTemplateSoftDeleteActions.restoreTemplate                                                                                                                                                                                      |
| Template                       | Duplicate Template                    | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template detail duplicates a Template through useDuplicateTemplateAction                                                                                                                                                                                                                    |
| Template Schedule              | Create Template Schedule              | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template authoring creates Template Schedules through mutators.templates.create and key-date Template setup writes a Key Date anchored Template Schedule                                                                                                                                    |
| Template Schedule              | Update Template Schedule              | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template schedule controls persist schedule edits through Template Schedule update mutations while preserving Church scope                                                                                                                                                                  |
| Template Schedule              | Delete Template Schedule              | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template schedule delete controls soft-delete a Template Schedule without deleting the parent Template                                                                                                                                                                                      |
| Template Schedule              | Restore Template Schedule             | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template schedule restore controls make a soft-deleted Template Schedule active again                                                                                                                                                                                                       |
| Key Date                       | List Key Dates                        | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Dates settings and Template setup list active Key Dates through useKeyDatesCollection                                                                                                                                                                                                   |
| Key Date                       | Create Key Date                       | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Date quick action and Template setup create Key Dates through useCreateKeyDate with schedule validation                                                                                                                                                                                 |
| Key Date                       | Update Key Date                       | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Date table inline rename and edit flows persist changes through useUpdateKeyDate                                                                                                                                                                                                        |
| Key Date                       | Delete Key Date                       | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Date row actions soft-delete a Key Date through useDeleteKeyDate                                                                                                                                                                                                                        |
| Key Date                       | Restore Key Date                      | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Date deleted-item controls restore a soft-deleted Key Date                                                                                                                                                                                                                              |
| Key Date                       | Preview Key Date Occurrences          | read  | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Key Date forms preview computed yearly, fixed yearly, and one-time local-date occurrences with calculateKeyDateOccurrence before save                                                                                                                                                       |
| Template Task                  | Create Template Task                  | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Template editor creates Template Tasks from selected Team, assignee, priority, estimate, placement, labels, and optional parent Template Task fields                                                                                                                                        |
| Template Task                  | Add Template Task at Placement        | write | covered | covered               | covered               | authenticated, Active Church, Church Membership | Church Membership                                                     | Template editor Add Template Task inserts a draft into the selected placement before persistence                                                                                                                                                                                            |
| Template Task                  | Update Template Task                  | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Template editor Task fields update assignment, priority, estimate, placement, labels, parent Template Task, and Team mapping through Template Task mutation seams                                                                                                                           |
| Template Task                  | Delete Template Task                  | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Template deleted-item controls soft-delete Template Tasks through useTemplateSoftDeleteActions.deleteTemplateTask                                                                                                                                                                           |
| Template Task                  | Restore Template Task                 | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Template deleted-item controls restore Template Tasks through useTemplateSoftDeleteActions.restoreTemplateTask                                                                                                                                                                              |
| Template Team                  | Resolve Template Team Mapping         | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Template editor derives Template Teams from selected Teams and Template Task creation reuses or creates the matching Template Team mapping                                                                                                                                                  |
| Projected Template Task        | Adjust Projected Template Task        | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Projected Template Task fields persist skip, move, and changed planning values as Cycle Adjustments for the selected Template Schedule occurrence                                                                                                                                           |
| Projected Template Task        | Materialize Projected Template Task   | write | covered | covered               | generic-passthrough   | authenticated, Active Church, Church Membership | Church Membership                                                     | Projected Template Task actions materialize the selected occurrence into one real Task, deduping by Template Schedule, Template Task, and occurrence while preserving Cycle context                                                                                                         |

---

# Agent Parity Follow-up Backlog

Each item is intended to become an independent follow-up issue with a first failing public-interface test.

## Missing focused MCP/API operation

### Add focused MCP/API coverage for Church Settings: Update Church Profile Settings

- Operation: `church.settings.profile.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace General saves Church profile fields through Better Auth organization.update, normalizes optional blank values, requires Church name and Church Time Zone, and disables edits for non-owner/admin Church Members
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Church Time Zone: Update Church Time Zone

- Operation: `church.settings.time-zone.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace General saves Church Time Zone through Better Auth organization.update; the auth hook adjusts Cycle rows so past Cycles keep their old boundaries, the current Cycle keeps its start instant, and current/future Cycle end/start boundaries use the new Church Time Zone
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Rolling Materialization Window: Update Rolling Materialization Window

- Operation: `church.settings.materialization-window.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace Scheduling clamps the Rolling Materialization Window to 1-52 Weeks, confirms before expansion because additional scheduled Template work may become real Tasks, and documents that narrowing never deletes already materialized Tasks
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Onboarding: Review Starter Teams

- Operation: `onboarding.starter-teams.review`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Initial Teams onboarding step lists seeded Starter Teams by sort order, opens Team create/edit quick actions, allows removal, and disables continue until at least one Team remains
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Insights: Read Task Insights

- Operation: `insights.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Insights reads the current Work View Task set and summarizes Task count by Slice and optional Segment, with show-canceled controlled by URL state
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for App Administration: Check App Administrator Access

- Operation: `app-administration.access.check`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for App Administration: List Churches for Support

- Operation: `app-administration.church.collection`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for App Administration: List Users for Support

- Operation: `app-administration.user.collection`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for App Administration: Edit Church Support Details

- Operation: `app-administration.church.edit-support-action`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for App Administration: Edit User Support Details

- Operation: `app-administration.user.edit-support-action`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin User details pane action opens the App Administrator-only edit User quick action from UserActions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team: Create Team

- Operation: `team.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team: Rename Team

- Operation: `team.rename`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useRenameTeamMutation and trim blank Team names
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team: Change Team Identifier

- Operation: `team.identifier.change`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useSetTeamIdentifierMutation, normalize to uppercase, reject invalid or duplicate identifiers, and preserve previous identifiers
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team: Delete Team

- Operation: `team.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useDeleteTeamMutation after confirmation and remove Team Memberships for that Team
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team: Reorder Teams

- Operation: `team.reorder`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Team list uses useReorderTeamsMutation to persist Team order per Church
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team Membership: Add Team Membership

- Operation: `team.membership.add`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Team Membership: Remove Team Membership

- Operation: `team.membership.remove`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team navigation membership action uses useRemoveTeamMemberMutation
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Label: Create Label

- Operation: `label.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Label: Update Label

- Operation: `label.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings inline name form and color picker use useUpdateLabelMutation; invalid stored colors fall back to deterministic name-derived Label colors in the UI
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Label: Delete Label

- Operation: `label.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Week/Cycle: Update Week Details

- Operation: `cycle.details.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Week planning details can persist Cycle Name and Cycle Description through the UI Zero mutator; no focused MCP or named CLI seam exists yet
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Week Progress: Read Week Progress

- Operation: `week.progress.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Week tooltip and Week Progress pane read non-canceled Task totals, completed counts, and completion percentage for a selected Week
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Week Breakdown: Read Week Breakdown

- Operation: `week.breakdown.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team Week board reads per-Week Task breakdowns from Zero queries for planning; no focused MCP or named CLI read exists yet beyond generic Task listing filters
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Task Comment: Create Task Comment

- Operation: `task.comment.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Activity Feed composer creates a root Task Comment after requiring an Active Church and non-empty body
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Task Comment: Reply to Task Comment

- Operation: `task.comment.reply`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Task Comment: Edit Task Comment

- Operation: `task.comment.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator
- Context: authenticated, Active Church, Church Membership
- Authorization: Task Comment author, Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Task Comment: Delete Task Comment

- Operation: `task.comment.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Comment and reply action menus expose confirmed Delete only to the author, Church owner/admin, or App Administrator and leave a tombstone
- Context: authenticated, Active Church, Church Membership
- Authorization: Task Comment author, Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Comment Thread: Subscribe to Comment Thread

- Operation: `task.comment.thread.subscribe`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Comment Thread: Unsubscribe from Comment Thread

- Operation: `task.comment.thread.unsubscribe`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Root Task Comment action menu can unsubscribe the current User from the Comment Thread and removes the subscribed indicator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Mark Notification Read

- Operation: `notification.mark-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Opening an Inbox notification or pressing Mark notification read marks only the current recipient's non-deleted Notification as read
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Mark Notification Unread

- Operation: `notification.mark-unread`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Mark notification unread returns only the current recipient's Notification to unread
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Mark All Notifications Read

- Operation: `notification.mark-all-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox Mark all read action marks the current recipient's unread Notifications read and leaves other recipients' Notifications untouched
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Delete Notification

- Operation: `notification.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Delete action soft-deletes only the current recipient's Notification
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Delete Read Notifications

- Operation: `notification.delete-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox bulk Delete read confirmation soft-deletes read Notifications for the current recipient only
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add focused MCP/API coverage for Notification Inbox: Snooze Notification

- Operation: `notification.snooze`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Snooze menu hides the current recipient's notification until a future preset time and invalid or past snooze inputs are rejected/no-op by the Zero mutator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

## Missing named CLI command

### Add named CLI coverage for Church Settings: Update Church Profile Settings

- Operation: `church.settings.profile.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace General saves Church profile fields through Better Auth organization.update, normalizes optional blank values, requires Church name and Church Time Zone, and disables edits for non-owner/admin Church Members
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Church Time Zone: Update Church Time Zone

- Operation: `church.settings.time-zone.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace General saves Church Time Zone through Better Auth organization.update; the auth hook adjusts Cycle rows so past Cycles keep their old boundaries, the current Cycle keeps its start instant, and current/future Cycle end/start boundaries use the new Church Time Zone
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Rolling Materialization Window: Update Rolling Materialization Window

- Operation: `church.settings.materialization-window.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Workspace Scheduling clamps the Rolling Materialization Window to 1-52 Weeks, confirms before expansion because additional scheduled Template work may become real Tasks, and documents that narrowing never deletes already materialized Tasks
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Onboarding: Review Starter Teams

- Operation: `onboarding.starter-teams.review`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Initial Teams onboarding step lists seeded Starter Teams by sort order, opens Team create/edit quick actions, allows removal, and disables continue until at least one Team remains
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Insights: Read Task Insights

- Operation: `insights.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Insights reads the current Work View Task set and summarizes Task count by Slice and optional Segment, with show-canceled controlled by URL state
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for App Administration: Check App Administrator Access

- Operation: `app-administration.access.check`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for App Administration: List Churches for Support

- Operation: `app-administration.church.collection`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for App Administration: List Users for Support

- Operation: `app-administration.user.collection`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for App Administration: Edit Church Support Details

- Operation: `app-administration.church.edit-support-action`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for App Administration: Edit User Support Details

- Operation: `app-administration.user.edit-support-action`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Admin User details pane action opens the App Administrator-only edit User quick action from UserActions
- Context: authenticated
- Authorization: App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team: Create Team

- Operation: `team.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team: Rename Team

- Operation: `team.rename`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useRenameTeamMutation and trim blank Team names
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team: Change Team Identifier

- Operation: `team.identifier.change`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useSetTeamIdentifierMutation, normalize to uppercase, reject invalid or duplicate identifiers, and preserve previous identifiers
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team: Delete Team

- Operation: `team.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team settings use useDeleteTeamMutation after confirmation and remove Team Memberships for that Team
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team: Reorder Teams

- Operation: `team.reorder`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Settings Team list uses useReorderTeamsMutation to persist Team order per Church
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team Membership: Add Team Membership

- Operation: `team.membership.add`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Team Membership: Remove Team Membership

- Operation: `team.membership.remove`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team navigation membership action uses useRemoveTeamMemberMutation
- Context: authenticated, Active Church, Church Membership
- Authorization: Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Label: Create Label

- Operation: `label.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Label: Update Label

- Operation: `label.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings inline name form and color picker use useUpdateLabelMutation; invalid stored colors fall back to deterministic name-derived Label colors in the UI
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Label: Delete Label

- Operation: `label.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Week/Cycle: Update Week Details

- Operation: `cycle.details.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Week planning details can persist Cycle Name and Cycle Description through the UI Zero mutator; no focused MCP or named CLI seam exists yet
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Week Progress: Read Week Progress

- Operation: `week.progress.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Week tooltip and Week Progress pane read non-canceled Task totals, completed counts, and completion percentage for a selected Week
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Week Breakdown: Read Week Breakdown

- Operation: `week.breakdown.read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Team Week board reads per-Week Task breakdowns from Zero queries for planning; no focused MCP or named CLI read exists yet beyond generic Task listing filters
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Task Comment: Create Task Comment

- Operation: `task.comment.create`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Activity Feed composer creates a root Task Comment after requiring an Active Church and non-empty body
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Task Comment: Reply to Task Comment

- Operation: `task.comment.reply`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Task Comment: Edit Task Comment

- Operation: `task.comment.update`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator
- Context: authenticated, Active Church, Church Membership
- Authorization: Task Comment author, Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Task Comment: Delete Task Comment

- Operation: `task.comment.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Task Comment and reply action menus expose confirmed Delete only to the author, Church owner/admin, or App Administrator and leave a tombstone
- Context: authenticated, Active Church, Church Membership
- Authorization: Task Comment author, Church owner, Church admin, or App Administrator
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Comment Thread: Subscribe to Comment Thread

- Operation: `task.comment.thread.subscribe`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Comment Thread: Unsubscribe from Comment Thread

- Operation: `task.comment.thread.unsubscribe`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Root Task Comment action menu can unsubscribe the current User from the Comment Thread and removes the subscribed indicator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Mark Notification Read

- Operation: `notification.mark-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Opening an Inbox notification or pressing Mark notification read marks only the current recipient's non-deleted Notification as read
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Mark Notification Unread

- Operation: `notification.mark-unread`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Mark notification unread returns only the current recipient's Notification to unread
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Mark All Notifications Read

- Operation: `notification.mark-all-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox Mark all read action marks the current recipient's unread Notifications read and leaves other recipients' Notifications untouched
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Delete Notification

- Operation: `notification.delete`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Delete action soft-deletes only the current recipient's Notification
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Delete Read Notifications

- Operation: `notification.delete-read`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox bulk Delete read confirmation soft-deletes read Notifications for the current recipient only
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Notification Inbox: Snooze Notification

- Operation: `notification.snooze`
- Current status: UI `covered`, MCP `missing`, CLI `missing`
- UI behavior to match: Inbox notification row Snooze menu hides the current recipient's notification until a future preset time and invalid or past snooze inputs are rejected/no-op by the Zero mutator
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership recipient
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

## Generic CLI MCP passthrough only

### Add named CLI coverage for Onboarding: Review Starter Key Dates

- Operation: `onboarding.starter-key-dates.review`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Finished onboarding step reviews seeded Starter Key Dates, sorts by next occurrence, shows editable-later copy, and lets Users remove unwanted Key Dates before entering Church Work
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Activity: Read Activity Feed

- Operation: `activity.feed.read`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Task Details Pane shows reverse-chronological Task Activity rows for task lifecycle, field, label, and comment events; other UI Activity entity types are queryable for agent history, but non-task entity events are not rendered by describeActivity yet
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Template Task: Create Template Task

- Operation: `template-task.create`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Template editor creates Template Tasks from selected Team, assignee, priority, estimate, placement, labels, and optional parent Template Task fields
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Template Task: Update Template Task

- Operation: `template-task.update`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Template editor Task fields update assignment, priority, estimate, placement, labels, parent Template Task, and Team mapping through Template Task mutation seams
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Template Task: Delete Template Task

- Operation: `template-task.delete`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Template deleted-item controls soft-delete Template Tasks through useTemplateSoftDeleteActions.deleteTemplateTask
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Template Task: Restore Template Task

- Operation: `template-task.restore`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Template deleted-item controls restore Template Tasks through useTemplateSoftDeleteActions.restoreTemplateTask
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Template Team: Resolve Template Team Mapping

- Operation: `template-team.mapping.resolve`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Template editor derives Template Teams from selected Teams and Template Task creation reuses or creates the matching Template Team mapping
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Projected Template Task: Adjust Projected Template Task

- Operation: `projected-template-task.adjust`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Projected Template Task fields persist skip, move, and changed planning values as Cycle Adjustments for the selected Template Schedule occurrence
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

### Add named CLI coverage for Projected Template Task: Materialize Projected Template Task

- Operation: `projected-template-task.materialize`
- Current status: UI `covered`, MCP `covered`, CLI `generic-passthrough`
- UI behavior to match: Projected Template Task actions materialize the selected occurrence into one real Task, deduping by Template Schedule, Template Task, and occurrence while preserving Cycle context
- Context: authenticated, Active Church, Church Membership
- Authorization: Church Membership
- First failing test: add a public MCP/API or CLI parity test that matches this UI behavior.

## Explicit UI-only or non-applicable decisions

- Onboarding: Create Church Profile (`onboarding.church-profile.create`) remains intentionally-ui-only for MCP and intentionally-ui-only for CLI.
- Onboarding: Complete Onboarding (`onboarding.complete`) remains intentionally-ui-only for MCP and intentionally-ui-only for CLI.
- View Options: Apply Presentation View Options (`view-options.presentation.apply`) remains not-applicable for MCP and not-applicable for CLI.
- Board: Read Board Presentation (`board.presentation.read`) remains not-applicable for MCP and not-applicable for CLI.
- App Administration: Start User Impersonation (`app-administration.user.impersonate`) remains intentionally-ui-only for MCP and intentionally-ui-only for CLI.
