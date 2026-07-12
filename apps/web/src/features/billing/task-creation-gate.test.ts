import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { taskLimitMessage } from "./task-creation-gate";

describe("Free Plan Task Limit copy", () => {
  it("points owners and admins at Church Billing, never members", () => {
    expect(taskLimitMessage(true)).toContain("Church Billing");
    expect(taskLimitMessage(false)).toContain("a Church owner or admin can upgrade");
    expect(taskLimitMessage(false)).not.toContain("Church Billing");
  });
});

describe("Task Usage card fidelity", () => {
  const cardSource = readFileSync(new URL("./task-usage-card.tsx", import.meta.url), "utf8");
  const appShellSource = readFileSync(
    new URL("../../components/app-shell.tsx", import.meta.url),
    "utf8",
  );

  it("mounts the card in the app shell", () => {
    expect(appShellSource).toContain("<TaskUsageCard />");
  });

  it("hides behind the shared policy and shows the real count, including overage", () => {
    expect(cardSource).toContain("if (!policy.church || !policy.showUsage) return null;");
    expect(cardSource).toContain("{policy.usage} of {policy.limit}");
    // The meter caps its width at 100% but the count stays actual above 300.
    expect(cardSource).toContain("Math.min(100, Math.round((policy.usage / policy.limit) * 100))");
  });

  it("gates the View Billing action on role — members see the card without an action", () => {
    expect(cardSource).toContain("canManageSubscription(policy.church.role)");
    expect(cardSource).toContain("{canManage ? (");
    expect(cardSource).toContain("View Billing");
  });
});

describe("Free Plan Task Limit control gating fidelity", () => {
  const openersSource = readFileSync(
    new URL("../quick-actions/quick-actions-state.tsx", import.meta.url),
    "utf8",
  );
  const createTaskSource = readFileSync(
    new URL("../quick-actions/create-task-quick-action.tsx", import.meta.url),
    "utf8",
  );
  const quickActionsSource = readFileSync(
    new URL("../quick-actions/quick-actions.tsx", import.meta.url),
    "utf8",
  );
  const topBarSource = readFileSync(
    new URL("../../components/tasks/task-view-top-bar.tsx", import.meta.url),
    "utf8",
  );
  const addTaskButtonSource = readFileSync(
    new URL("../../components/tasks/add-task-column-button.tsx", import.meta.url),
    "utf8",
  );
  const subTaskSource = readFileSync(
    new URL("../details-pane/sub-task-section.tsx", import.meta.url),
    "utf8",
  );
  const executionSurfaceSource = readFileSync(
    new URL("../../components/tasks/task-execution-surface.tsx", import.meta.url),
    "utf8",
  );

  it("raises the Sonner notification from every gated opener instead of creation UI", () => {
    for (const source of [openersSource, createTaskSource, subTaskSource]) {
      expect(source).toContain("taskCreationGate.blocked");
      expect(source).toContain("taskCreationGate.notify()");
    }
  });

  it("keeps the C shortcut on the gated opener so it notifies at the limit", () => {
    expect(quickActionsSource).toContain('useHotkey("C", () => openCreateTask()');
  });

  it("disables visible creation controls with role-aware tooltips", () => {
    for (const source of [topBarSource, addTaskButtonSource, subTaskSource, createTaskSource]) {
      expect(source).toContain("aria-disabled");
      expect(source).toContain("taskCreationGate.message");
    }
  });

  it("gates user-initiated projected Task materialization, not scheduled work", () => {
    expect(executionSurfaceSource).toContain("const requestMaterialize");
    expect(executionSurfaceSource).toContain("taskCreationGate.notify()");
  });
});
