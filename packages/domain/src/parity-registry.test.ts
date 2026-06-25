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
      "| Church | Resolve Active Church | read | covered | covered | covered | authenticated, Active Church, Church Membership | App shell and Work page resolve Active Church from session activeOrganizationId and membership-backed Church data |",
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
      "| Task | List Tasks | read | covered | covered | covered | authenticated, Active Church, Church Membership | Work page TaskExecutionSurface lists Tasks from useTasksCollection |",
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
      "| App Administration | Check App Administrator Access | read | covered | missing | missing | authenticated | InternalAccessGate renders App Administrator access required unless useIsAppAdmin and authenticated Zero context allow support surfaces |",
      "| App Administration | List Churches for Support | read | covered | missing | missing | authenticated | Admin Churches collection reads Zero-backed admin Church rows and shows App Administrator-only edit org row actions |",
      "| App Administration | List Users for Support | read | covered | missing | missing | authenticated | Admin Users collection reads Zero-backed admin User rows and shows App Administrator-only edit user and impersonate row actions |",
      "| App Administration | Start User Impersonation | write | covered | intentionally-ui-only | intentionally-ui-only | authenticated | Admin User actions call Better Auth admin.impersonateUser only after useIsAppAdmin gating |",
      "| App Administration | Edit Church Support Details | write | covered | missing | missing | authenticated | Admin Church details pane action opens the App Administrator-only edit Church quick action from OrgActions |",
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
      "| Team | Create Team | write | covered | missing | missing | authenticated, Active Church, Church Membership | Settings and sidebar Team creation use useCreateTeamMutation, which creates the Team, creator Team Membership, owned Workflow, and default Workflow Statuses |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Team Membership | Add Team Membership | write | covered | missing | missing | authenticated, Active Church, Church Membership | Team navigation membership action uses useAddTeamMemberMutation and de-duplicates existing Team Memberships |",
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
      "| Task | Complete Task | write | covered | covered | covered | authenticated, Active Church, Church Membership | Task status controls can move a Task to a completed Workflow Status |",
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
      "| Label | Create Label | write | covered | missing | missing | authenticated, Active Church, Church Membership | Label settings use useCreateLabelMutation for Church Labels; Zero label creation also supports Team Labels with same-name scoped uniqueness and deterministic default color |",
    );
    expect(generateAgentParityReport()).toContain(
      "| Label | Delete Label | write | covered | missing | missing | authenticated, Active Church, Church Membership | Label settings delete action uses useDeleteLabelMutation; deleting a Label removes it from every Task label_ids list |",
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
      "| Task | Move Task Between Weeks | write | covered | covered | covered | authenticated, Active Church, Church Membership | Task Week field and Board/List controls update cycleId while preserving the Team-derived Task Identifier |",
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
