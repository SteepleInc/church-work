import { describe, expect, test } from "vitest";

import { AGENT_OPERATION_REGISTRY, generateAgentParityReport } from "./parity-registry";

describe("Agent Operation parity registry", () => {
  test("reports UI-led current User and Active Church auth/session parity", () => {
    expect(AGENT_OPERATION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user.current",
          domainArea: "User",
          operation: "Read Current User",
          surfaces: expect.objectContaining({
            cli: { command: "church-work current-user", status: "covered" },
            mcp: { status: "covered", tool: "GET /api/agent/current-user" },
            ui: expect.objectContaining({ status: "covered" }),
          }),
        }),
        expect.objectContaining({
          id: "church.active.resolve",
          domainArea: "Church",
          operation: "Resolve Active Church",
          context: {
            requiresActiveChurch: true,
            requiresChurchMembership: true,
            session: "authenticated",
          },
          outputContract:
            "Active Church, Church Membership role, noActiveChurch state, or structured authentication/membership error",
          surfaces: expect.objectContaining({
            cli: { command: "church-work active-church", status: "covered" },
            mcp: { status: "covered", tool: "POST /api/agent/active-church" },
            ui: expect.objectContaining({ status: "covered" }),
          }),
        }),
      ]),
    );

    expect(generateAgentParityReport()).toContain(
      "| Church | Resolve Active Church | read | covered | covered | covered | authenticated, Active Church, Church Membership | Church Membership | App shell and Work page resolve Active Church from session activeOrganizationId and membership-backed Church data |",
    );
  });

  test("reports the UI-led Task list tracer bullet across UI, MCP, and CLI surfaces", () => {
    const taskList = AGENT_OPERATION_REGISTRY.find((operation) => operation.id === "task.list");

    expect(taskList).toMatchObject({
      id: "task.list",
      domainArea: "Task",
      operation: "List Tasks",
      kind: "read",
      uiBehavior: "Work page TaskExecutionSurface lists Tasks from useTasksCollection",
      context: {
        requiresActiveChurch: true,
        requiresChurchMembership: true,
        session: "authenticated",
      },
      authorization: "Church Membership",
      surfaces: {
        ui: { status: "covered" },
        mcp: { status: "covered", tool: "list-tasks" },
        cli: { command: "church-work task list", status: "covered" },
      },
    });

    expect(generateAgentParityReport()).toContain(
      "| Task | List Tasks | read | covered | covered | covered | authenticated, Active Church, Church Membership | Church Membership | Work page TaskExecutionSurface lists Tasks from useTasksCollection |",
    );
    expect(generateAgentParityReport()).toContain(
      "Coverage statuses: covered, partial, missing, generic-passthrough",
    );
  });

  test("reports UI-led App Administration and impersonation support decisions", () => {
    const appAdministratorContext = {
      requiresActiveChurch: false,
      requiresChurchMembership: false,
      session: "authenticated",
    } as const;
    const appAdministrationOperations = AGENT_OPERATION_REGISTRY.filter(
      (operation) => operation.domainArea === "App Administration",
    );
    const report = generateAgentParityReport();

    expect(appAdministrationOperations).toHaveLength(6);
    expect(appAdministrationOperations).toEqual(
      expect.arrayContaining(
        [
          "app-administration.access.check",
          "app-administration.church.collection",
          "app-administration.user.collection",
          "app-administration.church.edit-support-action",
          "app-administration.user.edit-support-action",
          "app-administration.user.impersonate",
        ].map((id) => expect.objectContaining({ id })),
      ),
    );
    expect(appAdministrationOperations).toEqual(
      appAdministrationOperations.map(() =>
        expect.objectContaining({
          authorization: "App Administrator",
          context: appAdministratorContext,
          surfaces: expect.objectContaining({
            ui: expect.objectContaining({ status: "covered" }),
          }),
        }),
      ),
    );

    expect(AGENT_OPERATION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "app-administration.access.check",
          domainArea: "App Administration",
          operation: "Check App Administrator Access",
          authorization: "App Administrator",
          context: appAdministratorContext,
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "missing" }),
            cli: expect.objectContaining({ status: "missing" }),
          },
        }),
        expect.objectContaining({
          id: "app-administration.church.collection",
          domainArea: "App Administration",
          operation: "List Churches for Support",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "missing" }),
            cli: expect.objectContaining({ status: "missing" }),
          },
        }),
        expect.objectContaining({
          id: "app-administration.user.collection",
          domainArea: "App Administration",
          operation: "List Users for Support",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "missing" }),
            cli: expect.objectContaining({ status: "missing" }),
          },
        }),
        expect.objectContaining({
          id: "app-administration.church.edit-support-action",
          domainArea: "App Administration",
          operation: "Edit Church Support Details",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "missing" }),
            cli: expect.objectContaining({ status: "missing" }),
          },
        }),
        expect.objectContaining({
          id: "app-administration.user.edit-support-action",
          domainArea: "App Administration",
          operation: "Edit User Support Details",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "missing" }),
            cli: expect.objectContaining({ status: "missing" }),
          },
        }),
        expect.objectContaining({
          id: "app-administration.user.impersonate",
          domainArea: "App Administration",
          operation: "Start User Impersonation",
          authorization: "App Administrator",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: expect.objectContaining({ status: "intentionally-ui-only" }),
            cli: expect.objectContaining({ status: "intentionally-ui-only" }),
          },
        }),
      ]),
    );

    [
      "| App Administration | Check App Administrator Access | read | covered | missing | missing | authenticated | App Administrator | InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces |",
      "| App Administration | List Churches for Support | read | covered | missing | missing | authenticated | App Administrator | Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions |",
      "| App Administration | List Users for Support | read | covered | missing | missing | authenticated | App Administrator | Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions |",
      "| App Administration | Start User Impersonation | write | covered | intentionally-ui-only | intentionally-ui-only | authenticated | App Administrator | Admin User actions call Better Auth admin.impersonateUser only after useIsAppAdmin gating |",
      "| App Administration | Edit Church Support Details | write | covered | missing | missing | authenticated | App Administrator | Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions |",
    ].forEach((expectedReportRow) => expect(report).toContain(expectedReportRow));
    expect(report).toContain(
      "Coverage statuses: covered, partial, missing, generic-passthrough, intentionally-ui-only",
    );
  });

  test("reports UI-led Team and Team Membership behavior with agent coverage decisions", () => {
    const byId = new Map(AGENT_OPERATION_REGISTRY.map((entry) => [entry.id, entry]));

    expect(byId.get("team.create")).toMatchObject({
      id: "team.create",
      authorization: "Church owner, Church admin, or App Administrator",
      surfaces: {
        ui: { status: "covered" },
        mcp: { status: "missing" },
        cli: { status: "missing" },
      },
    });
    for (const id of [
      "team.rename",
      "team.identifier.change",
      "team.delete",
      "team.reorder",
      "team.membership.add",
      "team.membership.remove",
    ]) {
      expect(byId.get(id)).toMatchObject({
        authorization: "Church owner, Church admin, or App Administrator",
      });
    }

    expect(generateAgentParityReport()).toContain(
      "| Team | Create Team | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator | Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Team Membership | Add Team Membership | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church owner, Church admin, or App Administrator | Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships |",
    );
  });

  test("reports UI-led Task get/create/update/status operations across MCP and CLI", () => {
    expect(AGENT_OPERATION_REGISTRY).toEqual(
      expect.arrayContaining(
        [
          ["task.get", "Get Task", "get-task", "church-work task get"],
          ["task.create", "Create Task", "create-task", "church-work task create"],
          ["task.update", "Update Task", "update-task", "church-work task update"],
          ["task.complete", "Complete Task", "complete-task", "church-work task complete"],
          ["task.cancel", "Cancel Task", "cancel-task", "church-work task cancel"],
          ["task.reopen", "Reopen Task", "reopen-task", "church-work task reopen"],
        ].map(([id, operation, tool, command]) =>
          expect.objectContaining({
            id,
            domainArea: "Task",
            operation,
            context: {
              requiresActiveChurch: true,
              requiresChurchMembership: true,
              session: "authenticated",
            },
            surfaces: {
              ui: expect.objectContaining({ status: "covered" }),
              mcp: { status: "covered", tool },
              cli: { command, status: "covered" },
            },
          }),
        ),
      ),
    );

    expect(generateAgentParityReport()).toContain(
      "| Task | Complete Task | write | covered | covered | covered | authenticated, Active Church, Church Membership | Church Membership | Task status controls can move a Task to a completed Workflow Status |",
    );
  });

  test("reports UI-led Task Comment and Comment Thread behavior with intentional agent gaps", () => {
    const byId = new Map(AGENT_OPERATION_REGISTRY.map((entry) => [entry.id, entry]));

    for (const [id, operation] of [
      ["task.comment.create", "Create Task Comment"],
      ["task.comment.reply", "Reply to Task Comment"],
      ["task.comment.update", "Edit Task Comment"],
      ["task.comment.delete", "Delete Task Comment"],
      ["task.comment.thread.subscribe", "Subscribe to Comment Thread"],
      ["task.comment.thread.unsubscribe", "Unsubscribe from Comment Thread"],
    ]) {
      expect(byId.get(id)).toMatchObject({
        domainArea: id.includes("thread") ? "Comment Thread" : "Task Comment",
        operation,
        context: {
          requiresActiveChurch: true,
          requiresChurchMembership: true,
          session: "authenticated",
        },
        surfaces: {
          ui: { status: "covered" },
          mcp: { status: "missing" },
          cli: { status: "missing" },
        },
      });
    }

    expect(byId.get("task.comment.update")?.authorization).toBe(
      "Task Comment author, Church owner, Church admin, or App Administrator",
    );
    expect(byId.get("task.comment.delete")?.authorization).toBe(
      "Task Comment author, Church owner, Church admin, or App Administrator",
    );
    expect(byId.get("task.comment.reply")?.inputContract).toContain(
      "root parent Task Comment only; replies are one level deep",
    );
    expect(byId.get("task.comment.create")?.outputContract).toContain(
      "comment_created Activity Feed item",
    );
    expect(byId.get("task.comment.delete")?.outputContract).toContain(
      "soft-deleted Task Comment tombstone",
    );
    expect(byId.get("task.comment.thread.unsubscribe")?.outputContract).toContain(
      "soft-deleted current-User Comment Thread subscription",
    );

    expect(generateAgentParityReport()).toContain(
      "| Task Comment | Reply to Task Comment | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church Membership | Task Activity Feed Reply composer creates a one-level reply under a root Task Comment and rejects nested replies in the Zero mutator |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Task Comment | Edit Task Comment | write | covered | missing | missing | authenticated, Active Church, Church Membership | Task Comment author, Church owner, Church admin, or App Administrator | Task Comment and reply action menus expose inline Edit only to the author, Church owner/admin, or App Administrator |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Comment Thread | Subscribe to Comment Thread | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church Membership | Root Task Comment action menu toggles a persisted Comment Thread subscription and shows a subscribed indicator for the current User |",
    );
  });

  test("reports UI-led Template Library lifecycle parity across MCP and CLI", () => {
    const templateOperations = [
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-list",
        id: "template.list",
        kind: "read",
        operation: "List Templates",
        tool: "template-list",
      },
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-get",
        id: "template.get",
        kind: "read",
        operation: "Get Template",
        tool: "template-get",
      },
      {
        cliStatus: "covered",
        command: "church-work template create-weekly-service",
        id: "template.create.weekly-service",
        kind: "write",
        operation: "Create Weekly Service Template",
        tool: "template-create-weekly-service",
      },
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-update",
        id: "template.update",
        kind: "write",
        operation: "Update Template",
        tool: "template-update",
      },
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-delete",
        id: "template.delete",
        kind: "write",
        operation: "Delete Template",
        tool: "template-delete",
      },
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-restore",
        id: "template.restore",
        kind: "write",
        operation: "Restore Template",
        tool: "template-restore",
      },
      {
        cliStatus: "generic-passthrough",
        command: "church-work mcp call template-duplicate",
        id: "template.duplicate",
        kind: "write",
        operation: "Duplicate Template",
        tool: "template-duplicate",
      },
    ] as const;

    expect(AGENT_OPERATION_REGISTRY).toEqual(
      expect.arrayContaining(
        templateOperations.map(({ cliStatus, command, id, kind, operation, tool }) =>
          expect.objectContaining({
            id,
            authorization: "Church Membership",
            context: {
              requiresActiveChurch: true,
              requiresChurchMembership: true,
              session: "authenticated",
            },
            domainArea: "Template",
            kind,
            operation,
            surfaces: {
              ui: expect.objectContaining({ status: "covered" }),
              mcp: { status: "covered", tool },
              cli: expect.objectContaining({ command, status: cliStatus }),
            },
          }),
        ),
      ),
    );

    expect(generateAgentParityReport()).toContain(
      "| Template | Delete Template | write | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Template Library and Template detail soft-delete a Template through useTemplateSoftDeleteActions.deleteTemplate |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Template | Restore Template | write | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Template deleted-item controls restore a Template through useTemplateSoftDeleteActions.restoreTemplate |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Template | Duplicate Template | write | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Template detail duplicates a Template through useDuplicateTemplateAction |",
    );
  });

  test("reports UI-led Template Task and Template Team mapping parity", () => {
    const byId = new Map(AGENT_OPERATION_REGISTRY.map((entry) => [entry.id, entry]));

    expect(byId.get("template-task.create")).toMatchObject({
      id: "template-task.create",
      domainArea: "Template Task",
      operation: "Create Template Task",
      inputContract:
        "churchId, templateId, Team mapping, title, assignment, priority, estimate, placement, labels, and optional parent Template Task",
      surfaces: {
        ui: expect.objectContaining({ status: "covered" }),
        mcp: { status: "covered", tool: "template-task-create" },
        cli: expect.objectContaining({
          command: "church-work mcp call template-task-create",
          status: "generic-passthrough",
        }),
      },
    });
    expect(byId.get("template-task.add-at-placement")).toMatchObject({
      id: "template-task.add-at-placement",
      surfaces: {
        ui: expect.objectContaining({ status: "covered" }),
        mcp: { status: "covered", tool: "template-task-add-at-placement" },
        cli: { command: "church-work template-task add-at-placement", status: "covered" },
      },
    });
    for (const [id, tool] of [
      ["template-task.update", "template-task-update"],
      ["template-task.delete", "template-task-delete"],
      ["template-task.restore", "template-task-restore"],
    ] as const) {
      expect(byId.get(id)).toMatchObject({
        authorization: "Church Membership",
        context: {
          requiresActiveChurch: true,
          requiresChurchMembership: true,
          session: "authenticated",
        },
        surfaces: {
          ui: expect.objectContaining({ status: "covered" }),
          mcp: { status: "covered", tool },
          cli: expect.objectContaining({
            command: `church-work mcp call ${tool}`,
            status: "generic-passthrough",
          }),
        },
      });
    }
    expect(byId.get("template-team.mapping.resolve")).toMatchObject({
      id: "template-team.mapping.resolve",
      domainArea: "Template Team",
      operation: "Resolve Template Team Mapping",
      inputContract: "churchId, templateId, and mapped Team selected in the Template editor",
      outputContract: "active Template Team mapping reused or created for the selected Team",
      surfaces: {
        ui: expect.objectContaining({ status: "covered" }),
        mcp: { status: "covered", tool: "template-task-create/template-task-add-at-placement" },
        cli: expect.objectContaining({ status: "generic-passthrough" }),
      },
    });

    expect(generateAgentParityReport()).toContain(
      "| Template Task | Update Template Task | write | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Template editor Task fields update assignment, priority, estimate, placement, labels, parent Template Task, and Team mapping through Template Task mutation seams |",
    );
  });

  test("reports UI-led Church and Team Label behavior with agent coverage decisions", () => {
    const byId = new Map(AGENT_OPERATION_REGISTRY.map((entry) => [entry.id, entry]));

    expect(byId.get("label.create")).toMatchObject({
      id: "label.create",
      authorization: "Church Membership",
      domainArea: "Label",
      inputContract: "churchId, Label name, and optional teamId for a Team Label",
      outputContract:
        "created Church Label or Team Label with deterministic default Label color and scoped uniqueness",
      surfaces: {
        ui: { status: "covered" },
        mcp: { status: "missing" },
        cli: { status: "missing" },
      },
    });
    expect(byId.get("label.update")).toMatchObject({
      id: "label.update",
      authorization: "Church Membership",
      domainArea: "Label",
      inputContract: "churchId, labelId, optional Label name, and optional Label color",
      outputContract: "updated Label name and/or Label color",
    });
    expect(byId.get("label.delete")).toMatchObject({
      id: "label.delete",
      authorization: "Church Membership",
      domainArea: "Label",
      inputContract: "churchId and labelId",
      outputContract: "deleted Label and Task label_ids cleaned of the deleted Label",
    });

    expect(generateAgentParityReport()).toContain(
      "| Label | Create Label | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church Membership | Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Label | Delete Label | write | covered | missing | missing | authenticated, Active Church, Church Membership | Church Membership | Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list |",
    );
  });

  test("reports UI-led Template Schedule and Key Date behavior across MCP and CLI", () => {
    const byId = new Map(AGENT_OPERATION_REGISTRY.map((entry) => [entry.id, entry]));

    for (const [id, operation, tool] of [
      ["template-schedule.create", "Create Template Schedule", "template-schedule-create"],
      ["template-schedule.update", "Update Template Schedule", "template-schedule-update"],
      ["template-schedule.delete", "Delete Template Schedule", "template-schedule-delete"],
      ["template-schedule.restore", "Restore Template Schedule", "template-schedule-restore"],
    ] as const) {
      expect(byId.get(id)).toMatchObject({
        authorization: "Church Membership",
        context: {
          requiresActiveChurch: true,
          requiresChurchMembership: true,
          session: "authenticated",
        },
        domainArea: "Template Schedule",
        operation,
        surfaces: {
          ui: { status: "covered" },
          mcp: { status: "covered", tool },
          cli: { command: `church-work mcp call ${tool}`, status: "generic-passthrough" },
        },
      });
    }

    for (const [id, operation, kind, tool] of [
      ["key-date.list", "List Key Dates", "read", "key-date-list"],
      ["key-date.create", "Create Key Date", "write", "key-date-create"],
      ["key-date.update", "Update Key Date", "write", "key-date-update"],
      ["key-date.delete", "Delete Key Date", "write", "key-date-delete"],
      ["key-date.restore", "Restore Key Date", "write", "key-date-restore"],
      [
        "key-date.occurrence.preview",
        "Preview Key Date Occurrences",
        "read",
        "key-date-preview-occurrences",
      ],
    ] as const) {
      expect(byId.get(id)).toMatchObject({
        authorization: "Church Membership",
        context: {
          requiresActiveChurch: true,
          requiresChurchMembership: true,
          session: "authenticated",
        },
        domainArea: "Key Date",
        kind,
        operation,
        surfaces: {
          ui: { status: "covered" },
          mcp: { status: "covered", tool },
          cli: { command: `church-work mcp call ${tool}`, status: "generic-passthrough" },
        },
      });
    }

    expect(generateAgentParityReport()).toContain(
      "| Template Schedule | Create Template Schedule | write | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Template authoring creates Template Schedules through mutators.templates.create and key-date Template setup writes a Key Date anchored Template Schedule |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Key Date | Preview Key Date Occurrences | read | covered | covered | generic-passthrough | authenticated, Active Church, Church Membership | Church Membership | Key Date forms preview computed yearly, fixed yearly, and one-time local-date occurrences with calculateKeyDateOccurrence before save |",
    );
  });

  test("reports UI-led Subtask parent changes and Task Cycle Move parity", () => {
    expect(AGENT_OPERATION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task.subtask.parent.change",
          operation: "Assign or Clear Subtask Parent",
          inputContract:
            "churchId plus taskId or Task Identifier and parentTaskId, or clear parent with null",
          outputContract:
            "updated Task preserving Task Identifier and setting or clearing parent Task within the same Church",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: { status: "covered", tool: "update-task" },
            cli: {
              command: "church-work task update --parent-task-id/--clear-parent",
              status: "covered",
            },
          },
        }),
        expect.objectContaining({
          id: "task.cycle.move",
          operation: "Move Task Between Weeks",
          inputContract: "churchId plus taskId or Task Identifier and cycleId",
          outputContract:
            "updated Task preserving Task Identifier and moving to the requested Week/Cycle in the same Church",
          surfaces: {
            ui: expect.objectContaining({ status: "covered" }),
            mcp: { status: "covered", tool: "update-task" },
            cli: { command: "church-work task update --cycle-id", status: "covered" },
          },
        }),
      ]),
    );

    expect(generateAgentParityReport()).toContain(
      "| Task | Move Task Between Weeks | write | covered | covered | covered | authenticated, Active Church, Church Membership | Church Membership | Task Week field and Board/List controls update cycleId while preserving the Team-derived Task Identifier |",
    );
  });

  test("escapes Markdown table delimiters in registry text", () => {
    expect(
      generateAgentParityReport([
        {
          ...AGENT_OPERATION_REGISTRY[0],
          domainArea: "Task | Planning",
          operation: "List \\ Tasks",
        },
      ]),
    ).toContain("| Task \\| Planning | List \\\\ Tasks |");
  });
});
