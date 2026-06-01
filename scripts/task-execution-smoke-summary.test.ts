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
    status: "passed",
  };

  test("marks the smoke path passed when every step passes", () => {
    expect(
      buildTaskExecutionSmokeSummary({
        generatedAt: "2026-06-01T00:00:00.000Z",
        e2eReady: true,
        e2eSkipReason: null,
        results: [passedResult],
      }).status,
    ).toBe("passed");
  });

  test("keeps skipped browser verification visible in the aggregate status", () => {
    expect(
      buildTaskExecutionSmokeSummary({
        generatedAt: "2026-06-01T00:00:00.000Z",
        e2eReady: false,
        e2eSkipReason: "Missing .env.e2e.",
        results: [
          passedResult,
          {
            name: "browser execution smoke",
            command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
            covers: ["Browser workflows prove persisted web behavior."],
            exitCode: 0,
            status: "skipped",
          },
        ],
      }).status,
    ).toBe("passed_with_skips");
  });

  test("marks the smoke path failed when any step fails", () => {
    expect(
      buildTaskExecutionSmokeSummary({
        generatedAt: "2026-06-01T00:00:00.000Z",
        e2eReady: true,
        e2eSkipReason: null,
        results: [
          passedResult,
          {
            name: "CLI public smoke",
            command: "bun --filter @church-task/cli test:cli",
            covers: ["CLI commands use the public Task execution contract."],
            exitCode: 1,
            status: "failed",
          },
        ],
      }).status,
    ).toBe("failed");
  });

  test("allows local smoke runs to pass with skips by default", () => {
    expect(
      getTaskExecutionSmokeExitCode(
        buildTaskExecutionSmokeSummary({
          generatedAt: "2026-06-01T00:00:00.000Z",
          e2eReady: false,
          e2eSkipReason: "Missing .env.e2e.",
          results: [
            passedResult,
            {
              name: "browser execution smoke",
              command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
              covers: ["Browser workflows prove persisted web behavior."],
              exitCode: 0,
              status: "skipped",
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
          results: [
            passedResult,
            {
              name: "browser execution smoke",
              command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
              covers: ["Browser workflows prove persisted web behavior."],
              exitCode: 0,
              status: "skipped",
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
        results: [
          passedResult,
          {
            name: "browser execution smoke",
            command: "bun run test:e2e tests/e2e/app-shell.spec.ts",
            covers: ["Browser workflows prove persisted web behavior."],
            exitCode: 0,
            status: "skipped",
          },
        ],
      }),
    );

    expect(report).toContain("Status: passed_with_skips");
    expect(report).toContain("E2E skip reason: Missing .env.e2e.");
    expect(report).toContain("| browser execution smoke | skipped | 0 |");
    expect(report).toContain("## Acceptance Coverage");
    expect(report).toContain("- Browser workflows prove persisted web behavior.");
  });
});
