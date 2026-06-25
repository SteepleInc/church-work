import { describe, expect, test } from "vitest";

import { AGENT_OPERATION_REGISTRY, generateAgentParityReport } from "./parity-registry";

describe("Agent Operation parity registry", () => {
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
