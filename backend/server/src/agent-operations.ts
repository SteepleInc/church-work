import {
  activeChurchResponse,
  currentUserResponse,
  formatTaskIdentifier,
  noActiveChurchResponse,
  notChurchMemberResponse,
  parseTaskIdentifier,
  TaskStatus,
  calculateKeyDateOccurrence,
  type KeyDateRule,
  type ActiveChurchResponse,
  type CoreWorkBatchReadResponse,
  type CoreWorkBatchWriteResponse,
  type CurrentUserResponse,
} from "@church-task/domain";
import {
  getActivityId,
  getCycleAdjustmentId,
  getKeyDateId,
  getTaskId,
  getTemplateId,
  getTemplateScheduleId,
  getTemplateTaskId,
  getTemplateTeamId,
} from "@church-task/shared/get-ids";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { Effect } from "effect";

import {
  activities,
  cycle_adjustments,
  cycles,
  key_dates,
  member,
  organization,
  tasks,
  template_schedules,
  template_tasks,
  template_teams,
  templates,
  team_memberships,
  teams,
  user,
  workflow_statuses,
  workflows,
} from "@church-task/db/schema";
import type { ChurchTaskAuth } from "@church-task/auth";
import type { ChurchTaskDb } from "@church-task/db";

type AuthSession = Awaited<ReturnType<ChurchTaskAuth["api"]["getSession"]>>;
type AuthenticatedSession = NonNullable<AuthSession>;

type AgentServices = {
  readonly auth: ChurchTaskAuth;
  readonly db: ChurchTaskDb;
};

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

const readBody = (request: Request) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: async () => (await request.json()) as Record<string, unknown>,
  });

const getAuthSession = ({ auth }: AgentServices, request: Request) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: () => auth.api.getSession({ headers: request.headers }),
  });

const requireAuthSession = (services: AgentServices, request: Request) =>
  Effect.flatMap(getAuthSession(services, request), (session) =>
    session ? Effect.succeed(session) : Effect.fail(new Error("Authentication required.")),
  );

const getRequestedChurchId = (body: Record<string, unknown>) => {
  const churchId = body.churchId ?? body.church_id;
  return typeof churchId === "string" && churchId.trim() ? churchId.trim() : null;
};

const ensureChurchMembership = (
  db: ChurchTaskDb,
  session: AuthenticatedSession,
  churchId: string,
) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: async () => {
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.userId, session.user.id), eq(member.organizationId, churchId)))
        .limit(1);

      if (!membership)
        throw new Error("User does not have Church Membership for requested Church.");
      return membership;
    },
  });

const toTaskDto = (
  task: typeof tasks.$inferSelect,
  team?: Pick<typeof teams.$inferSelect, "identifier">,
) => ({
  assignedUserId: task.assigned_user_id,
  boardOrder: task.board_order,
  churchId: task.church_id,
  cycleId: task.cycle_id,
  dueDate: task.due_date,
  priority: task.priority,
  finishedAt: task.finished_at?.toISOString() ?? null,
  id: task.id,
  identifier: team ? formatTaskIdentifier(team.identifier, task.number) : undefined,
  number: task.number,
  parentTaskId: task.parent_task_id,
  taskState: task.task_state,
  teamId: task.team_id,
  title: task.title,
  workflowId: task.workflow_id,
  workflowStatusId: task.workflow_status_id,
});

const recordTaskActivity = (
  db: ChurchTaskDb,
  args: {
    readonly actorId: string;
    readonly churchId: string;
    readonly entityId: string;
    readonly eventType: string;
  },
) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      db.insert(activities).values({
        _tag: "activity",
        actor_id: args.actorId,
        actor_type: "user",
        church_id: args.churchId,
        created_by: args.actorId,
        entity_id: args.entityId,
        entity_type: "task",
        event_type: args.eventType,
        id: getActivityId(),
        occurred_at: new Date(),
        updated_by: args.actorId,
      }),
  });

const resolveTask = (db: ChurchTaskDb, body: Record<string, unknown>) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: async () => {
      const churchId = getRequestedChurchId(body);
      if (!churchId) throw new Error("churchId is required.");

      const taskId = typeof body.taskId === "string" ? body.taskId : null;
      if (taskId) {
        const [task] = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.church_id, churchId), eq(tasks.id, taskId), isNull(tasks.deleted_at)))
          .limit(1);
        if (!task) throw new Error("Task not found.");
        return task;
      }

      const identifier =
        typeof body.taskIdentifier === "string" ? parseTaskIdentifier(body.taskIdentifier) : null;
      if (!identifier) throw new Error("taskId or taskIdentifier is required.");

      const [team] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.church_id, churchId),
            eq(teams.identifier, identifier.teamIdentifier),
            isNull(teams.deleted_at),
          ),
        )
        .limit(1);
      if (!team) throw new Error("Task not found.");

      const [task] = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.church_id, churchId),
            eq(tasks.team_id, team.id),
            eq(tasks.number, identifier.taskNumber),
            isNull(tasks.deleted_at),
          ),
        )
        .limit(1);
      if (!task) throw new Error("Task not found.");
      return task;
    },
  });

const listTeams = (db: ChurchTaskDb, churchId: string) =>
  db
    .select()
    .from(teams)
    .where(and(eq(teams.church_id, churchId), isNull(teams.deleted_at)))
    .orderBy(asc(teams.sort_order));

const listWorkflowStatuses = (db: ChurchTaskDb, churchId: string, workflowId?: string) =>
  db
    .select()
    .from(workflow_statuses)
    .where(
      and(
        eq(workflow_statuses.church_id, churchId),
        workflowId ? eq(workflow_statuses.workflow_id, workflowId) : undefined,
        isNull(workflow_statuses.deleted_at),
      ),
    )
    .orderBy(asc(workflow_statuses.sort_order));

const slugKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";

const parseJsonText = (value: string | null | undefined, fallback: unknown) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
};

const maybeString = (body: Record<string, unknown>, key: string) =>
  typeof body[key] === "string" ? body[key] : undefined;

const maybeNumber = (body: Record<string, unknown>, key: string) =>
  typeof body[key] === "number" ? body[key] : undefined;

const isKeyDateRule = (value: unknown): value is KeyDateRule => {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  switch (rule.kind) {
    case "fixedYearly":
      return typeof rule.month === "number" && typeof rule.day === "number";
    case "computedYearly":
      return typeof rule.rule === "string";
    case "oneTime":
      return typeof rule.localDate === "string";
    default:
      return false;
  }
};

const templateSoftDeleteTarget = (tool: string) => {
  if (tool.startsWith("template-task")) {
    return { idField: "templateTaskId", table: template_tasks } as const;
  }
  if (tool.startsWith("template-schedule")) {
    return { idField: "templateScheduleId", table: template_schedules } as const;
  }
  return { idField: "templateId", table: templates } as const;
};

const requireString = (body: Record<string, unknown>, key: string) => {
  const value = maybeString(body, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const recordActivity = (
  db: ChurchTaskDb,
  args: {
    readonly actorId: string;
    readonly churchId: string;
    readonly entityId: string;
    readonly entityType: string;
    readonly eventType: string;
  },
) =>
  Effect.promise(() =>
    db.insert(activities).values({
      _tag: "activity",
      actor_id: args.actorId,
      actor_type: "user",
      church_id: args.churchId,
      created_by: args.actorId,
      entity_id: args.entityId,
      entity_type: args.entityType,
      event_type: args.eventType,
      id: getActivityId(),
      occurred_at: new Date(),
      updated_by: args.actorId,
    }),
  );

const runBatchReadOperation = (
  services: AgentServices,
  operation: string,
  input: Record<string, unknown>,
) =>
  Effect.tryPromise({
    catch: (cause) => cause,
    try: async () => {
      const churchId = getRequestedChurchId(input);
      if (!churchId) throw new Error("churchId is required.");

      switch (operation) {
        case "listTeams":
          return { ok: true, operation, data: { teams: await listTeams(services.db, churchId) } };
        case "listTeamMemberships":
          return {
            ok: true,
            operation,
            data: {
              teamMemberships: await services.db
                .select()
                .from(team_memberships)
                .where(eq(team_memberships.church_id, churchId)),
            },
          };
        case "readWorkDefaults":
          return {
            ok: true,
            operation,
            data: {
              keyDates: await services.db
                .select()
                .from(key_dates)
                .where(eq(key_dates.church_id, churchId)),
              workflowStatuses: await listWorkflowStatuses(services.db, churchId),
              workflows: await services.db
                .select()
                .from(workflows)
                .where(eq(workflows.church_id, churchId)),
            },
          };
        case "readChurchSettings": {
          const [church] = await services.db
            .select({ churchTimeZone: organization.churchTimeZone, id: organization.id })
            .from(organization)
            .where(eq(organization.id, churchId))
            .limit(1);
          return { ok: true, operation, data: { church } };
        }
        default:
          return {
            ok: false,
            operation,
            error: {
              code: "obsolete_operation",
              message: "Operation is not implemented on the new agent API.",
            },
          };
      }
    },
  });

const runTaskTool = (
  services: AgentServices,
  session: AuthenticatedSession,
  tool: string,
  body: Record<string, unknown>,
) =>
  Effect.gen(function* () {
    const churchId = getRequestedChurchId(body);
    if (!churchId)
      return json(
        { ok: false, error: { code: "missing_church", message: "churchId is required." } },
        { status: 400 },
      );
    yield* ensureChurchMembership(services.db, session, churchId);

    switch (tool) {
      case "list-users": {
        const users = yield* Effect.tryPromise({
          catch: (cause) => cause,
          try: () =>
            services.db
              .select({ email: user.email, id: user.id, name: user.name, role: member.role })
              .from(member)
              .innerJoin(user, eq(user.id, member.userId))
              .where(eq(member.organizationId, churchId)),
        });
        return json({ ok: true, tool, users });
      }
      case "list-teams":
        return json({
          ok: true,
          teams: yield* Effect.promise(() => listTeams(services.db, churchId)),
          tool,
        });
      case "list-cycles":
        return json({
          cycles: yield* Effect.promise(() =>
            services.db
              .select()
              .from(cycles)
              .where(and(eq(cycles.church_id, churchId), isNull(cycles.deleted_at)))
              .orderBy(desc(cycles.start_date)),
          ),
          ok: true,
          tool,
        });
      case "list-workflow-statuses": {
        const workflowId = typeof body.workflowId === "string" ? body.workflowId : undefined;
        return json({
          ok: true,
          tool,
          workflowStatuses: yield* Effect.promise(() =>
            listWorkflowStatuses(services.db, churchId, workflowId),
          ),
        });
      }
      case "list-tasks": {
        const priorityValues = Array.isArray(body.priority)
          ? body.priority.filter(
              (value): value is string | null => value === null || typeof value === "string",
            )
          : body.priority !== undefined
            ? [body.priority].filter(
                (value): value is string | null => value === null || typeof value === "string",
              )
            : [];
        const priorityStrings = priorityValues.filter((value): value is string => value !== null);
        const rows = yield* Effect.tryPromise({
          catch: (cause) => cause,
          try: () =>
            services.db
              .select({ task: tasks, team: { identifier: teams.identifier } })
              .from(tasks)
              .innerJoin(teams, eq(teams.id, tasks.team_id))
              .where(
                and(
                  eq(tasks.church_id, churchId),
                  isNull(tasks.deleted_at),
                  priorityValues.length > 0
                    ? or(
                        priorityStrings.length > 0
                          ? inArray(tasks.priority, priorityStrings)
                          : undefined,
                        priorityValues.includes(null) ? isNull(tasks.priority) : undefined,
                      )
                    : undefined,
                ),
              )
              .orderBy(asc(tasks.board_order)),
        });
        return json({ ok: true, tasks: rows.map((row) => toTaskDto(row.task, row.team)), tool });
      }
      case "get-task": {
        const task = yield* resolveTask(services.db, body);
        const [team] = yield* Effect.promise(() =>
          services.db
            .select({ identifier: teams.identifier })
            .from(teams)
            .where(eq(teams.id, task.team_id))
            .limit(1),
        );
        return json({ ok: true, task: toTaskDto(task, team), tool });
      }
      case "create-task": {
        const teamId = typeof body.teamId === "string" ? body.teamId : null;
        const statusId = typeof body.workflowStatusId === "string" ? body.workflowStatusId : null;
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!teamId || !statusId || !title)
          throw new Error("teamId, workflowStatusId, and title are required.");

        const [team] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(teams)
            .where(and(eq(teams.id, teamId), eq(teams.church_id, churchId)))
            .limit(1),
        );
        const [status] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(workflow_statuses)
            .where(
              and(eq(workflow_statuses.id, statusId), eq(workflow_statuses.church_id, churchId)),
            )
            .limit(1),
        );
        if (!team || !status) throw new Error("Team or Workflow Status not found.");

        const task = {
          _tag: "task",
          assigned_user_id: typeof body.assignedUserId === "string" ? body.assignedUserId : null,
          board_order: String(Date.now()),
          church_id: churchId,
          created_by: session.user.id,
          created_by_user_id: session.user.id,
          cycle_id: null,
          due_date: typeof body.dueDate === "string" ? body.dueDate : null,
          priority: maybeString(body, "priority") ?? null,
          id: getTaskId(),
          number: team.next_task_number,
          parent_task_id: typeof body.parentTaskId === "string" ? body.parentTaskId : null,
          task_state: status.task_state,
          team_id: team.id,
          title,
          updated_by: session.user.id,
          workflow_id: status.workflow_id,
          workflow_status_id: status.id,
        } satisfies typeof tasks.$inferInsert;

        const [inserted] = yield* Effect.promise(() =>
          services.db.insert(tasks).values(task).returning(),
        );
        yield* Effect.promise(() =>
          services.db
            .update(teams)
            .set({ next_task_number: team.next_task_number + 1 })
            .where(eq(teams.id, team.id)),
        );
        yield* recordTaskActivity(services.db, {
          actorId: session.user.id,
          churchId,
          entityId: task.id,
          eventType: "task.created",
        });
        return json({
          ok: true,
          task: toTaskDto(inserted!, team),
          tool,
        });
      }
      case "update-task":
      case "complete-task":
      case "cancel-task":
      case "reopen-task": {
        const existing = yield* resolveTask(services.db, body);
        const patch: Partial<typeof tasks.$inferInsert> = { updated_by: session.user.id };
        let eventType = "task.updated";

        if (tool === "update-task") {
          if (typeof body.title === "string") patch.title = body.title;
          if (typeof body.dueDate === "string" || body.dueDate === null)
            patch.due_date = body.dueDate;
          if (typeof body.cycleId === "string" || body.cycleId === null)
            patch.cycle_id = body.cycleId;
          if (typeof body.assignedUserId === "string" || body.assignedUserId === null)
            patch.assigned_user_id = body.assignedUserId;
          if (typeof body.parentTaskId === "string" || body.parentTaskId === null)
            patch.parent_task_id = body.parentTaskId;
          if (typeof body.priority === "string" || body.priority === null)
            patch.priority = body.priority;
          if (typeof body.teamId === "string") patch.team_id = body.teamId;
          if (typeof body.workflowStatusId === "string") {
            const [status] = yield* Effect.promise(() =>
              services.db
                .select()
                .from(workflow_statuses)
                .where(
                  and(
                    eq(workflow_statuses.id, body.workflowStatusId as string),
                    eq(workflow_statuses.church_id, churchId),
                  ),
                )
                .limit(1),
            );
            if (!status) throw new Error("Workflow Status not found.");
            patch.workflow_id = status.workflow_id;
            patch.workflow_status_id = status.id;
            patch.task_state = status.task_state;
            eventType = "task.status_moved";
          }
        } else {
          const targetState =
            tool === "complete-task"
              ? TaskStatus.done
              : tool === "cancel-task"
                ? TaskStatus.canceled
                : TaskStatus.todo;
          patch.task_state = targetState;
          patch.finished_at = targetState === TaskStatus.todo ? null : new Date();
          eventType =
            tool === "complete-task"
              ? "task.completed"
              : tool === "cancel-task"
                ? "task.canceled"
                : "task.reopened";
        }

        const [updated] = yield* Effect.promise(() =>
          services.db.update(tasks).set(patch).where(eq(tasks.id, existing.id)).returning(),
        );
        yield* recordTaskActivity(services.db, {
          actorId: session.user.id,
          churchId,
          entityId: existing.id,
          eventType,
        });
        return json({ ok: true, task: toTaskDto(updated ?? existing), tool });
      }
      case "template-create-weekly-service": {
        const name = requireString(body, "name");
        const teamId = requireString(body, "teamId");
        const startDate = requireString(body, "startDate");
        const weekday = maybeNumber(body, "weekday") ?? 6;
        const now = new Date();
        const templateId = getTemplateId();
        const templateTeamId = getTemplateTeamId();
        const scheduleId = getTemplateScheduleId();
        const key = maybeString(body, "key") ?? slugKey(name);
        const [team] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(teams)
            .where(and(eq(teams.id, teamId), eq(teams.church_id, churchId)))
            .limit(1),
        );
        if (!team) throw new Error("Team not found.");
        yield* Effect.promise(() =>
          services.db.insert(templates).values({
            _tag: "template",
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            id: templateId,
            key,
            name,
            placement_shape: "weeklyService",
            recurrence: "weekly",
            updated_at: now,
            updated_by: session.user.id,
          }),
        );
        yield* Effect.promise(() =>
          services.db.insert(template_teams).values({
            _tag: "templateteam",
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            id: templateTeamId,
            key: "primary",
            mapped_team_id: teamId,
            name: team.name,
            template_id: templateId,
            updated_at: now,
            updated_by: session.user.id,
          }),
        );
        yield* Effect.promise(() =>
          services.db.insert(template_schedules).values({
            _tag: "templateschedule",
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            end_date: null,
            id: scheduleId,
            key: `${key}-weekly`,
            kind: "weekly",
            name: maybeString(body, "scheduleName") ?? `${name} Weekly`,
            recurrence: "repeating",
            rule: JSON.stringify({ kind: "weekly", weekdays: [weekday] }),
            start_date: startDate,
            template_id: templateId,
            updated_at: now,
            updated_by: session.user.id,
          }),
        );
        yield* recordActivity(services.db, {
          actorId: session.user.id,
          churchId,
          entityId: templateId,
          entityType: "template",
          eventType: "template.created",
        });
        return json({
          ok: true,
          tool,
          template: { id: templateId, key, name },
          templateTeam: { id: templateTeamId },
          templateSchedule: { id: scheduleId },
        });
      }
      case "template-task-add-at-placement":
      case "template-task-create": {
        const now = new Date();
        const templateId = requireString(body, "templateId");
        const teamId = requireString(body, "teamId");
        let [templateTeam] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_teams)
            .where(
              and(
                eq(template_teams.template_id, templateId),
                eq(template_teams.mapped_team_id, teamId),
                isNull(template_teams.deleted_at),
              ),
            )
            .limit(1),
        );
        if (!templateTeam) {
          const [team] = yield* Effect.promise(() =>
            services.db
              .select()
              .from(teams)
              .where(and(eq(teams.id, teamId), eq(teams.church_id, churchId)))
              .limit(1),
          );
          if (!team) throw new Error("Team not found.");
          templateTeam = {
            _tag: "templateteam",
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            deleted_at: null,
            deleted_by: null,
            id: getTemplateTeamId(),
            key: slugKey(team.name),
            mapped_team_id: teamId,
            name: team.name,
            template_id: templateId,
            updated_at: now,
            updated_by: session.user.id,
          };
          const newTemplateTeam = templateTeam;
          yield* Effect.promise(() => services.db.insert(template_teams).values(newTemplateTeam));
        }
        if (!templateTeam) throw new Error("Template Team not found.");
        const id = getTemplateTaskId();
        const title = requireString(body, "title");
        yield* Effect.promise(() =>
          services.db.insert(template_tasks).values({
            _tag: "templatetask",
            assigned_user_id: maybeString(body, "assignedUserId") ?? null,
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            description: maybeString(body, "description") ?? null,
            estimate: maybeString(body, "estimate") ?? null,
            priority: maybeString(body, "priority") ?? null,
            id,
            key: maybeString(body, "key") ?? slugKey(title),
            label_ids: JSON.stringify(Array.isArray(body.labelIds) ? body.labelIds : []),
            parent_template_task_id: maybeString(body, "parentTemplateTaskId") ?? null,
            placement_cycle_offset:
              maybeNumber(body, "cycleOffset") ?? maybeNumber(body, "placementCycleOffset") ?? 0,
            placement_weekday:
              maybeNumber(body, "weekday") ?? maybeNumber(body, "placementWeekday") ?? 6,
            scheduling_rule: JSON.stringify(
              body.schedulingRule ?? {
                kind: "cycleOffset",
                offsetCycles: maybeNumber(body, "cycleOffset") ?? 0,
                dayOffset: maybeNumber(body, "weekday") ?? 6,
              },
            ),
            template_id: templateId,
            template_team_id: templateTeam.id,
            title,
            updated_at: now,
            updated_by: session.user.id,
          }),
        );
        yield* recordActivity(services.db, {
          actorId: session.user.id,
          churchId,
          entityId: id,
          entityType: "template_task",
          eventType: "template_task.created",
        });
        return json({ ok: true, tool, templateTask: { id, title, templateId } });
      }
      case "template-list":
        return json({
          ok: true,
          tool,
          templates: yield* Effect.promise(() =>
            services.db
              .select()
              .from(templates)
              .where(and(eq(templates.church_id, churchId), isNull(templates.deleted_at))),
          ),
        });
      case "template-get": {
        const templateId = requireString(body, "templateId");
        const [template] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(templates)
            .where(and(eq(templates.id, templateId), eq(templates.church_id, churchId)))
            .limit(1),
        );
        const templateTasks = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_tasks)
            .where(
              and(
                eq(template_tasks.template_id, templateId),
                eq(template_tasks.church_id, churchId),
                isNull(template_tasks.deleted_at),
              ),
            ),
        );
        const schedules = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_schedules)
            .where(
              and(
                eq(template_schedules.template_id, templateId),
                eq(template_schedules.church_id, churchId),
                isNull(template_schedules.deleted_at),
              ),
            ),
        );
        return json({ ok: true, tool, template, templateTasks, schedules });
      }
      case "template-update": {
        const templateId = requireString(body, "templateId");
        const patch: Partial<typeof templates.$inferInsert> = {
          updated_at: new Date(),
          updated_by: session.user.id,
        };
        if (typeof body.name === "string") patch.name = body.name;
        if (typeof body.recurrence === "string") patch.recurrence = body.recurrence;
        if (typeof body.placementShape === "string") patch.placement_shape = body.placementShape;
        const [template] = yield* Effect.promise(() =>
          services.db
            .update(templates)
            .set(patch)
            .where(and(eq(templates.id, templateId), eq(templates.church_id, churchId)))
            .returning(),
        );
        yield* recordActivity(services.db, {
          actorId: session.user.id,
          churchId,
          entityId: templateId,
          entityType: "template",
          eventType: "template.updated",
        });
        return json({ ok: true, tool, template });
      }
      case "template-delete":
      case "template-restore":
      case "template-task-delete":
      case "template-task-restore":
      case "template-schedule-delete":
      case "template-schedule-restore": {
        const isRestore = tool.endsWith("restore");
        const { idField, table } = templateSoftDeleteTarget(tool);
        const id = requireString(body, idField);
        const now = new Date();
        const patch = isRestore
          ? { deleted_at: null, deleted_by: null, updated_at: now, updated_by: session.user.id }
          : {
              deleted_at: now,
              deleted_by: session.user.id,
              updated_at: now,
              updated_by: session.user.id,
            };
        const [entity] = yield* Effect.promise(() =>
          services.db
            .update(table)
            .set(patch)
            .where(and(eq(table.id, id), eq(table.church_id, churchId)))
            .returning(),
        );
        return json({ ok: true, tool, entity });
      }
      case "template-schedule-create": {
        const now = new Date();
        const templateId = requireString(body, "templateId");
        const kind = requireString(body, "kind");
        const id = getTemplateScheduleId();
        yield* Effect.promise(() =>
          services.db.insert(template_schedules).values({
            _tag: "templateschedule",
            church_id: churchId,
            created_at: now,
            created_by: session.user.id,
            end_date: maybeString(body, "endDate") ?? null,
            id,
            key: maybeString(body, "key") ?? `${kind}-${id.slice(-8)}`,
            kind,
            name: maybeString(body, "name") ?? `${kind} schedule`,
            recurrence: maybeString(body, "recurrence") ?? "repeating",
            rule: JSON.stringify(
              body.rule ?? { kind, repeat: kind === "weekly" ? undefined : kind },
            ),
            start_date: requireString(body, "startDate"),
            template_id: templateId,
            updated_at: now,
            updated_by: session.user.id,
          }),
        );
        return json({ ok: true, tool, templateSchedule: { id, templateId, kind } });
      }
      case "template-schedule-update":
      case "template-task-update": {
        const isTask = tool.startsWith("template-task");
        const id = requireString(body, isTask ? "templateTaskId" : "templateScheduleId");
        const patch: Record<string, unknown> = {
          updated_at: new Date(),
          updated_by: session.user.id,
        };
        for (const [inputKey, column] of Object.entries(
          isTask
            ? {
                title: "title",
                description: "description",
                assignedUserId: "assigned_user_id",
                estimate: "estimate",
                priority: "priority",
                cycleOffset: "placement_cycle_offset",
                weekday: "placement_weekday",
              }
            : {
                name: "name",
                recurrence: "recurrence",
                startDate: "start_date",
                endDate: "end_date",
                kind: "kind",
              },
        ))
          if (body[inputKey] !== undefined) patch[column] = body[inputKey];
        if (isTask && body.labelIds !== undefined) patch.label_ids = JSON.stringify(body.labelIds);
        if (isTask && body.schedulingRule !== undefined)
          patch.scheduling_rule = JSON.stringify(body.schedulingRule);
        if (!isTask && body.rule !== undefined) patch.rule = JSON.stringify(body.rule);
        const table = isTask ? template_tasks : template_schedules;
        const [entity] = yield* Effect.promise(() =>
          services.db
            .update(table)
            .set(patch)
            .where(and(eq(table.id, id), eq(table.church_id, churchId)))
            .returning(),
        );
        return json({ ok: true, tool, entity });
      }
      case "key-date-create":
      case "key-date-update":
      case "key-date-delete":
      case "key-date-restore":
      case "key-date-list":
      case "key-date-preview-occurrences": {
        if (tool === "key-date-list")
          return json({
            ok: true,
            tool,
            keyDates: yield* Effect.promise(() =>
              services.db
                .select()
                .from(key_dates)
                .where(and(eq(key_dates.church_id, churchId), isNull(key_dates.deleted_at))),
            ),
          });
        if (tool === "key-date-preview-occurrences") {
          const schedule = body.schedule ?? parseJsonText(maybeString(body, "scheduleJson"), null);
          if (!isKeyDateRule(schedule)) throw new Error("A valid Key Date schedule is required.");
          const startYear = maybeNumber(body, "startYear") ?? new Date().getUTCFullYear();
          const endYear = maybeNumber(body, "endYear") ?? startYear;
          const occurrences = Array.from(
            { length: endYear - startYear + 1 },
            (_, index) => startYear + index,
          )
            .map((year) => ({
              year,
              localDate: calculateKeyDateOccurrence(schedule, year),
            }))
            .filter((o) => o.localDate);
          return json({ ok: true, tool, occurrences });
        }
        const now = new Date();
        if (tool === "key-date-create") {
          const id = getKeyDateId();
          yield* Effect.promise(() =>
            services.db.insert(key_dates).values({
              _tag: "keydate",
              church_id: churchId,
              created_at: now,
              created_by: session.user.id,
              id,
              key: requireString(body, "key"),
              name: requireString(body, "name"),
              schedule: JSON.stringify(body.schedule),
              updated_at: now,
              updated_by: session.user.id,
            }),
          );
          return json({ ok: true, tool, keyDate: { id } });
        }
        const id = requireString(body, "keyDateId");
        const patch =
          tool === "key-date-delete"
            ? {
                deleted_at: now,
                deleted_by: session.user.id,
                updated_at: now,
                updated_by: session.user.id,
              }
            : tool === "key-date-restore"
              ? { deleted_at: null, deleted_by: null, updated_at: now, updated_by: session.user.id }
              : {
                  key: requireString(body, "key"),
                  name: requireString(body, "name"),
                  schedule: JSON.stringify(body.schedule),
                  updated_at: now,
                  updated_by: session.user.id,
                };
        const [keyDate] = yield* Effect.promise(() =>
          services.db
            .update(key_dates)
            .set(patch)
            .where(and(eq(key_dates.id, id), eq(key_dates.church_id, churchId)))
            .returning(),
        );
        return json({ ok: true, tool, keyDate });
      }
      case "projected-template-task-adjust": {
        const now = new Date();
        const id = getCycleAdjustmentId();
        yield* Effect.promise(() =>
          services.db
            .insert(cycle_adjustments)
            .values({
              _tag: "cycleadjustment",
              church_id: churchId,
              created_at: now,
              created_by: session.user.id,
              cycle_id: requireString(body, "cycleId"),
              id,
              lifecycle: maybeString(body, "lifecycle") ?? "active",
              overrides: JSON.stringify(body.overrides ?? []),
              source_template_occurrence_key: requireString(body, "occurrenceKey"),
              source_template_schedule_id: requireString(body, "templateScheduleId"),
              template_task_id: requireString(body, "templateTaskId"),
              updated_at: now,
              updated_by: session.user.id,
            })
            .onConflictDoUpdate({
              target: [
                cycle_adjustments.cycle_id,
                cycle_adjustments.source_template_schedule_id,
                cycle_adjustments.template_task_id,
                cycle_adjustments.source_template_occurrence_key,
              ],
              set: {
                lifecycle: maybeString(body, "lifecycle") ?? "active",
                overrides: JSON.stringify(body.overrides ?? []),
                updated_at: now,
                updated_by: session.user.id,
              },
            }),
        );
        return json({ ok: true, tool, cycleAdjustment: { id } });
      }
      case "template-duplicate": {
        const sourceId = requireString(body, "templateId");
        const [source] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(templates)
            .where(
              and(
                eq(templates.id, sourceId),
                eq(templates.church_id, churchId),
                isNull(templates.deleted_at),
              ),
            )
            .limit(1),
        );
        if (!source) throw new Error("Template not found.");
        const now = new Date();
        const id = getTemplateId();
        yield* Effect.promise(() =>
          services.db.insert(templates).values({
            ...source,
            id,
            key: `${source.key}-copy-${id.slice(-8)}`,
            name: maybeString(body, "name") ?? `${source.name} Copy`,
            created_at: now,
            created_by: session.user.id,
            updated_at: now,
            updated_by: session.user.id,
            deleted_at: null,
            deleted_by: null,
          }),
        );
        const sourceTeams = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_teams)
            .where(
              and(eq(template_teams.template_id, sourceId), isNull(template_teams.deleted_at)),
            ),
        );
        const teamMap = new Map<string, string>();
        for (const sourceTeam of sourceTeams) {
          const teamId = getTemplateTeamId();
          teamMap.set(sourceTeam.id, teamId);
          yield* Effect.promise(() =>
            services.db.insert(template_teams).values({
              ...sourceTeam,
              id: teamId,
              template_id: id,
              created_at: now,
              created_by: session.user.id,
              updated_at: now,
              updated_by: session.user.id,
              deleted_at: null,
              deleted_by: null,
            }),
          );
        }
        const sourceTasks = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_tasks)
            .where(
              and(eq(template_tasks.template_id, sourceId), isNull(template_tasks.deleted_at)),
            ),
        );
        const taskMap = new Map<string, string>();
        for (const sourceTask of sourceTasks) taskMap.set(sourceTask.id, getTemplateTaskId());
        for (const sourceTask of sourceTasks)
          yield* Effect.promise(() =>
            services.db.insert(template_tasks).values({
              ...sourceTask,
              id: taskMap.get(sourceTask.id)!,
              template_id: id,
              template_team_id: teamMap.get(sourceTask.template_team_id)!,
              parent_template_task_id: sourceTask.parent_template_task_id
                ? (taskMap.get(sourceTask.parent_template_task_id) ?? null)
                : null,
              created_at: now,
              created_by: session.user.id,
              updated_at: now,
              updated_by: session.user.id,
              deleted_at: null,
              deleted_by: null,
            }),
          );
        const sourceSchedules = yield* Effect.promise(() =>
          services.db
            .select()
            .from(template_schedules)
            .where(
              and(
                eq(template_schedules.template_id, sourceId),
                isNull(template_schedules.deleted_at),
              ),
            ),
        );
        for (const sourceSchedule of sourceSchedules)
          yield* Effect.promise(() =>
            services.db.insert(template_schedules).values({
              ...sourceSchedule,
              id: getTemplateScheduleId(),
              key: `${sourceSchedule.key}-copy-${id.slice(-8)}`,
              template_id: id,
              created_at: now,
              created_by: session.user.id,
              updated_at: now,
              updated_by: session.user.id,
              deleted_at: null,
              deleted_by: null,
            }),
          );
        return json({ ok: true, tool, template: { id } });
      }
      case "template-projection-preview":
        return json({
          ok: true,
          tool,
          projections: [],
          note: "Use schedule/task reads to calculate client-side projection preview.",
        });
      case "projected-template-task-materialize": {
        const scheduleId = requireString(body, "templateScheduleId");
        const templateTaskId = requireString(body, "templateTaskId");
        const occurrenceKey = requireString(body, "occurrenceKey");
        const [existing] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(tasks)
            .where(
              and(
                eq(tasks.church_id, churchId),
                eq(tasks.source_template_schedule_id, scheduleId),
                eq(tasks.source_template_task_id, templateTaskId),
                eq(tasks.source_template_occurrence_key, occurrenceKey),
                isNull(tasks.deleted_at),
              ),
            )
            .limit(1),
        );
        if (existing) return json({ ok: true, tool, deduped: true, task: toTaskDto(existing) });
        const teamId = requireString(body, "teamId");
        const statusId = requireString(body, "workflowStatusId");
        const [team] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(teams)
            .where(and(eq(teams.id, teamId), eq(teams.church_id, churchId)))
            .limit(1),
        );
        const [status] = yield* Effect.promise(() =>
          services.db
            .select()
            .from(workflow_statuses)
            .where(
              and(eq(workflow_statuses.id, statusId), eq(workflow_statuses.church_id, churchId)),
            )
            .limit(1),
        );
        if (!team || !status) throw new Error("Team or Workflow Status not found.");
        const id = getTaskId();
        const now = new Date();
        const row = {
          _tag: "task",
          assigned_user_id: maybeString(body, "assignedUserId") ?? null,
          board_order: String(Date.now()),
          church_id: churchId,
          created_at: now,
          created_by: session.user.id,
          created_by_user_id: session.user.id,
          cycle_id: requireString(body, "cycleId"),
          deleted_at: null,
          deleted_by: null,
          description: maybeString(body, "description") ?? null,
          due_date: maybeString(body, "dueDate") ?? null,
          estimate: maybeString(body, "estimate") ?? null,
          priority: maybeString(body, "priority") ?? null,
          finished_at: null,
          id,
          label_ids: JSON.stringify(Array.isArray(body.labelIds) ? body.labelIds : []),
          number: team.next_task_number,
          parent_task_id: null,
          previous_identifiers: "[]",
          source_template_cycle_id: null,
          source_template_id: requireString(body, "templateId"),
          source_template_occurrence_key: occurrenceKey,
          source_template_schedule_id: scheduleId,
          source_template_sync_enabled: false,
          source_template_task_id: templateTaskId,
          task_state: status.task_state,
          team_id: teamId,
          title: requireString(body, "title"),
          updated_at: now,
          updated_by: session.user.id,
          workflow_id: status.workflow_id,
          workflow_status_id: status.id,
        } satisfies typeof tasks.$inferInsert;
        yield* Effect.promise(() => services.db.insert(tasks).values(row));
        yield* Effect.promise(() =>
          services.db
            .update(teams)
            .set({ next_task_number: team.next_task_number + 1 })
            .where(eq(teams.id, teamId)),
        );
        return json({ ok: true, tool, deduped: false, task: toTaskDto(row, team) });
      }
      default:
        return json(
          { ok: false, error: { code: "unknown_tool", message: "Unknown MCP tool." } },
          { status: 404 },
        );
    }
  });

export const handleAgentRequest = (services: AgentServices, request: Request) => {
  const url = new URL(request.url);

  const effect = Effect.gen(function* () {
    if (url.pathname === "/api/agent/current-user" && request.method === "GET") {
      const session = yield* getAuthSession(services, request);
      const response: CurrentUserResponse = currentUserResponse(
        session
          ? {
              email: session.user.email ?? null,
              id: session.user.id,
              name: session.user.name ?? null,
            }
          : null,
      );
      return json(response);
    }

    if (url.pathname === "/api/agent/active-church" && request.method === "POST") {
      const session = yield* requireAuthSession(services, request);
      const body = yield* readBody(request);
      const churchId =
        getRequestedChurchId(body) ??
        (session.session.activeOrganizationId as string | null | undefined) ??
        null;
      if (!churchId) return json(noActiveChurchResponse());

      const [membership] = yield* Effect.promise(() =>
        services.db
          .select({ role: member.role })
          .from(member)
          .where(and(eq(member.userId, session.user.id), eq(member.organizationId, churchId)))
          .limit(1),
      );
      if (!membership) return json(notChurchMemberResponse(), { status: 403 });

      const [church] = yield* Effect.promise(() =>
        services.db
          .select({
            churchTimeZone: organization.churchTimeZone,
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          })
          .from(organization)
          .where(eq(organization.id, churchId))
          .limit(1),
      );
      const response: ActiveChurchResponse = church
        ? activeChurchResponse({ church, membership })
        : noActiveChurchResponse();
      return json(response, response.ok ? undefined : { status: 403 });
    }

    if (url.pathname === "/api/agent/core-work/batch-read" && request.method === "POST") {
      const session = yield* requireAuthSession(services, request);
      const body = yield* readBody(request);
      const operations = Array.isArray(body.operations) ? body.operations : [];
      const results = yield* Effect.forEach(operations, (raw) => {
        const operation = raw as { id?: unknown; input?: unknown; operation?: unknown };
        const input =
          operation.input && typeof operation.input === "object"
            ? (operation.input as Record<string, unknown>)
            : {};
        const churchId = getRequestedChurchId(input);
        return Effect.gen(function* () {
          if (churchId) yield* ensureChurchMembership(services.db, session, churchId);
          return {
            id: typeof operation.id === "string" ? operation.id : "unknown",
            operation: typeof operation.operation === "string" ? operation.operation : "unknown",
            result: yield* runBatchReadOperation(
              services,
              typeof operation.operation === "string" ? operation.operation : "unknown",
              input,
            ),
          };
        });
      });
      const response: CoreWorkBatchReadResponse = {
        ok: true,
        operation: "coreWorkBatchRead",
        results,
      };
      return json(response);
    }

    if (url.pathname === "/api/agent/core-work/batch-write" && request.method === "POST") {
      yield* requireAuthSession(services, request);
      const body = yield* readBody(request);
      const operations = Array.isArray(body.operations) ? body.operations : [];
      const response: CoreWorkBatchWriteResponse = {
        ok: true,
        operation: "coreWorkBatchWrite",
        results: operations.map((raw) => {
          const operation = raw as { id?: unknown; operation?: unknown };
          return {
            id: typeof operation.id === "string" ? operation.id : "unknown",
            operation: typeof operation.operation === "string" ? operation.operation : "unknown",
            result: {
              ok: false,
              error: {
                code: "obsolete_operation",
                message: "Use focused MCP/API operations on the new Drizzle service layer.",
              },
            },
          };
        }),
      };
      return json(response);
    }

    if (url.pathname.startsWith("/api/mcp/tools/") && request.method === "POST") {
      const session = yield* requireAuthSession(services, request);
      const body = yield* readBody(request);
      return yield* runTaskTool(services, session, url.pathname.split("/").at(-1) ?? "", body);
    }

    return null;
  });

  return Effect.runPromise(effect).catch((cause) =>
    json(
      { error: cause instanceof Error ? cause.message : "Agent operation failed." },
      { status: 500 },
    ),
  );
};
