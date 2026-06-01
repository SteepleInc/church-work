import { describe, expect, test } from "bun:test";

import {
  buildTaskExecutionSmokeSummary,
  formatTaskExecutionSmokeMarkdown,
  getTaskExecutionSmokeExitCode,
  type TaskExecutionSmokeStepResult,
} from "./task-execution-smoke-summary";

describe("Task execution smoke summary", () => {
  const passedResult: TaskExecutionSmokeStepResult = {
    name: "backend public-boundary smoke",
    command: "bun --filter @church-task/backend test:backend",
    covers: ["Backend public contracts execute the Task lifecycle."],
    exitCode: 0,
    durationMs: 1234,
    status: "passed",
  };
  const e2eRequirements = {
    envFile: ".env.e2e or CI process environment",
    requiredEnvNames: ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"],
    ciSecretNames: ["E2E_CONVEX_URL", "E2E_CONVEX_SITE_URL"],
  };
  const issueLinks = {
    prdIssue: "https://github.com/SteepleInc/church-task/issues/60",
    taskIssue: "https://github.com/SteepleInc/church-task/issues/71",
  };

  test("marks the smoke path passed when every step passes", () => {
    const summary = buildTaskExecutionSmokeSummary({
      generatedAt: "2026-06-01T00:00:00.000Z",
      e2eReady: true,
      e2eSkipReason: null,
      e2eRequirements,
      issueLinks,
      results: [passedResult],
    });

    expect(summary.status).toBe("passed");
    expect(summary.closureGate).toEqual({
      ready: true,
      fullVerificationCommand: "bun run test:task-execution-smoke:full",
      blockingSteps: [],
      blockingStepDetails: [],
    });
  });

  test("keeps skipped browser verification visible in the aggregate status", () => {
    const summary = buildTaskExecutionSmokeSummary({
      generatedAt: "2026-06-01T00:00:00.000Z",
      e2eReady: false,
      e2eSkipReason: "Missing .env.e2e.",
      e2eRequirements,
      issueLinks,
      results: [
        passedResult,
        {
          name: "browser execution smoke",
          command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
          covers: ["Browser workflows prove persisted web behavior."],
          exitCode: 0,
          durationMs: 4321,
          status: "skipped",
          skipReason: "Missing .env.e2e.",
        },
      ],
    });

    expect(summary.status).toBe("passed_with_skips");
    expect(summary.closureGate).toEqual({
      ready: false,
      fullVerificationCommand: "bun run test:task-execution-smoke:full",
      blockingSteps: ["browser execution smoke was skipped: Missing .env.e2e."],
      blockingStepDetails: [
        {
          name: "browser execution smoke",
          command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
          reason: "skipped: Missing .env.e2e.",
        },
      ],
    });
  });

  test("maps smoke steps to #71 acceptance criteria with blocking coverage", () => {
    const summary = buildTaskExecutionSmokeSummary({
      generatedAt: "2026-06-01T00:00:00.000Z",
      e2eReady: false,
      e2eSkipReason: "Missing .env.e2e.",
      e2eRequirements,
      issueLinks,
      results: [
        {
          ...passedResult,
          acceptanceCriteria: ["cross_surface_lifecycle", "activity_history"],
        },
        {
          name: "browser execution smoke",
          command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
          covers: ["Browser workflows prove persisted web behavior."],
          exitCode: 0,
          durationMs: 4321,
          status: "skipped",
          skipReason: "Missing .env.e2e.",
          acceptanceCriteria: ["web_reflects_contract_changes", "kanban_persists_movement"],
        },
      ],
    });

    expect(summary.acceptanceCriteriaCoverage).toContainEqual({
      key: "cross_surface_lifecycle",
      text: "A Task can be created, assigned, moved, completed, canceled, and reopened through the implemented execution surfaces.",
      status: "passed",
      coveredBy: ["backend public-boundary smoke"],
    });
    expect(summary.acceptanceCriteriaCoverage).toContainEqual({
      key: "web_reflects_contract_changes",
      text: "Web routes reflect changes made through backend/MCP/CLI contracts.",
      status: "blocked",
      coveredBy: ["browser execution smoke"],
    });
  });

  test("keeps unrun planned smoke steps visible as blocked coverage", () => {
    const summary = buildTaskExecutionSmokeSummary({
      generatedAt: "2026-06-01T00:00:00.000Z",
      e2eReady: true,
      e2eSkipReason: null,
      e2eRequirements,
      issueLinks,
      plannedSteps: [
        {
          name: "backend public-boundary smoke",
          acceptanceCriteria: ["cross_surface_lifecycle"],
        },
        {
          name: "browser execution smoke",
          acceptanceCriteria: ["web_reflects_contract_changes", "kanban_persists_movement"],
        },
      ],
      results: [
        {
          ...passedResult,
          exitCode: 1,
          status: "failed",
          acceptanceCriteria: ["cross_surface_lifecycle"],
        },
      ],
    });

    expect(summary.acceptanceCriteriaCoverage).toContainEqual({
      key: "web_reflects_contract_changes",
      text: "Web routes reflect changes made through backend/MCP/CLI contracts.",
      status: "blocked",
      coveredBy: ["browser execution smoke (not run)"],
    });
    expect(summary.acceptanceCriteriaCoverage).toContainEqual({
      key: "kanban_persists_movement",
      text: "The ReUI Kanban board persists drag/drop movement through backend state.",
      status: "blocked",
      coveredBy: ["browser execution smoke (not run)"],
    });
  });

  test("marks the smoke path failed when any step fails", () => {
    const summary = buildTaskExecutionSmokeSummary({
      generatedAt: "2026-06-01T00:00:00.000Z",
      e2eReady: true,
      e2eSkipReason: null,
      e2eRequirements,
      issueLinks,
      results: [
        passedResult,
        {
          name: "CLI public smoke",
          command: "bun --filter @church-task/cli test:cli",
          covers: ["CLI commands use the public Task execution contract."],
          exitCode: 1,
          durationMs: 9876,
          status: "failed",
        },
      ],
    });

    expect(summary.status).toBe("failed");
    expect(summary.closureGate).toEqual({
      ready: false,
      fullVerificationCommand: "bun run test:task-execution-smoke:full",
      blockingSteps: ["CLI public smoke failed with exit code 1"],
      blockingStepDetails: [
        {
          name: "CLI public smoke",
          command: "bun --filter @church-task/cli test:cli",
          reason: "failed with exit code 1",
        },
      ],
    });
  });

  test("allows local smoke runs to pass with skips by default", () => {
    expect(
      getTaskExecutionSmokeExitCode(
        buildTaskExecutionSmokeSummary({
          generatedAt: "2026-06-01T00:00:00.000Z",
          e2eReady: false,
          e2eSkipReason: "Missing .env.e2e.",
          e2eRequirements,
          issueLinks,
          results: [
            passedResult,
            {
              name: "browser execution smoke",
              command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
              covers: ["Browser workflows prove persisted web behavior."],
              exitCode: 0,
              durationMs: 4321,
              status: "skipped",
              skipReason: "Missing .env.e2e.",
            },
          ],
        }),
        { requireFull: false },
      ),
    ).toBe(0);
  });

  test("fails full smoke runs when browser verification is skipped", () => {
    expect(
      getTaskExecutionSmokeExitCode(
        buildTaskExecutionSmokeSummary({
          generatedAt: "2026-06-01T00:00:00.000Z",
          e2eReady: false,
          e2eSkipReason: "Missing .env.e2e.",
          e2eRequirements,
          issueLinks,
          results: [
            passedResult,
            {
              name: "browser execution smoke",
              command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
              covers: ["Browser workflows prove persisted web behavior."],
              exitCode: 0,
              durationMs: 4321,
              status: "skipped",
              skipReason: "Missing .env.e2e.",
            },
          ],
        }),
        { requireFull: true },
      ),
    ).toBe(1);
  });

  test("formats a human-readable report with the E2E gap and commands", () => {
    const report = formatTaskExecutionSmokeMarkdown(
      buildTaskExecutionSmokeSummary({
        generatedAt: "2026-06-01T00:00:00.000Z",
        e2eReady: false,
        e2eSkipReason: "Missing .env.e2e.",
        e2eRequirements,
        issueLinks,
        results: [
          passedResult,
          {
            name: "browser execution smoke",
            command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
            covers: ["Browser workflows prove persisted web behavior."],
            exitCode: 0,
            durationMs: 4321,
            status: "skipped",
            skipReason: "Missing .env.e2e.",
          },
        ],
      }),
    );

    expect(report).toContain("Status: passed_with_skips");
    expect(report).toContain("Parent PRD: https://github.com/SteepleInc/church-task/issues/60");
    expect(report).toContain("Task issue: https://github.com/SteepleInc/church-task/issues/71");
    expect(report).toContain("E2E env file: .env.e2e or CI process environment");
    expect(report).toContain("E2E required env: VITE_CONVEX_URL, VITE_CONVEX_SITE_URL");
    expect(report).toContain("E2E CI secrets: E2E_CONVEX_URL, E2E_CONVEX_SITE_URL");
    expect(report).toContain("Total duration: 5.6s");
    expect(report).toContain("E2E skip reason: Missing .env.e2e.");
    expect(report).toContain("## Closure Gate");
    expect(report).toContain("Ready to close #71: no");
    expect(report).toContain("Full verification command: bun run test:task-execution-smoke:full");
    expect(report).toContain("- browser execution smoke was skipped: Missing .env.e2e.");
    expect(report).toContain("Blocking step commands:");
    expect(report).toContain(
      "- browser execution smoke: `bun run test:e2e tests/e2e/app-shell.spec.ts` (skipped: Missing .env.e2e.)",
    );
    expect(report).toContain("| Step | Status | Duration | Skip Reason | Exit Code | Command |");
    expect(report).toContain(
      "| browser execution smoke | skipped | 4.3s | Missing .env.e2e. | 0 |",
    );
    expect(report).toContain("## Acceptance Coverage");
    expect(report).toContain("- Browser workflows prove persisted web behavior.");
    expect(report).toContain("## #71 Acceptance Criteria");
    expect(report).toContain(
      "| web_reflects_contract_changes | uncovered | Web routes reflect changes made through backend/MCP/CLI contracts. | None |",
    );
  });
});
