import { describe, expect, test } from "bun:test";

import {
  buildPersistedTaskFieldTarget,
  buildProjectedTaskFieldTarget,
  labelsForTeam,
  type TaskFieldTargetLabel,
} from "./task-field-target";
import type { TaskBoardTask } from "./task-kanban-adapter";

const task = (overrides: Partial<TaskBoardTask> = {}): TaskBoardTask => ({
  id: "task-1",
  identifier: "CT-1",
  title: "Prepare service",
  workflowId: "workflow-1",
  workflowStatusId: "status-1",
  taskState: "todo",
  teamId: "team-1",
  assignedUserId: "user-1",
  dueDate: "2026-06-21",
  estimate: "m",
  priority: "high",
  labelIds: ["church", "team-1-label"],
  ...overrides,
});

const labels: readonly TaskFieldTargetLabel[] = [
  { id: "church", teamId: null },
  { id: "team-1-label", teamId: "team-1" },
  { id: "team-2-label", teamId: "team-2" },
];

describe("Task field target builders", () => {
  test("builds full persisted actions for a real Task", () => {
    const target = buildPersistedTaskFieldTarget({
      task: task(),
      targetTaskIds: ["task-1"],
      labelOptions: labels,
      onAssignTask: () => {},
      onChangeTaskStatus: () => {},
      onChangeTaskLabels: () => {},
      onChangeTaskEstimate: () => {},
      onChangeTaskDueDate: () => {},
      onChangeTaskTeam: () => {},
      onTransitionTask: () => {},
      onOpenTask: () => {},
      buildTaskUrl: (identifier) => `/tasks/${identifier}`,
    });

    expect(target.kind).toBe("persisted");
    expect(target.actions.open).toBeFunction();
    expect(target.actions.copyId).toBeFunction();
    expect(target.actions.copyLink).toBeFunction();
    expect(target.actions.copyTitle).toBeFunction();
    expect(target.actions.copyMarkdown).toBeFunction();
    expect(target.actions.transition).toBeFunction();
    expect(target.fields.team.set).toBeFunction();
  });

  test("omits persisted-only actions for a projected Template Task target", () => {
    const target = buildProjectedTaskFieldTarget({
      task: task({ isProjected: true }),
      labelOptions: labels,
      onAssignTask: () => {},
      onChangeTaskLabels: () => {},
      onChangeTaskEstimate: () => {},
      onChangeTaskDueDate: () => {},
      onChangeTaskTeam: () => {},
    });

    expect(target.kind).toBe("projected");
    expect(target.fields.status.set).toBeUndefined();
    expect(target.actions.open).toBeUndefined();
    expect(target.actions.copyId).toBeUndefined();
    expect(target.actions.copyLink).toBeUndefined();
    expect(target.actions.copyTitle?.()).toBe("Prepare service");
    expect(target.actions.copyMarkdown?.()).toBe("# Prepare service\n");
    expect(target.actions.transition).toBeUndefined();
    expect(target.fields.team.set).toBeFunction();
  });

  test("drops foreign Team Labels and keeps Church-wide Labels when Team changes", () => {
    expect(
      labelsForTeam(["church", "team-1-label", "team-2-label", "missing"], "team-2", labels),
    ).toEqual(["church", "team-2-label"]);
  });
});
