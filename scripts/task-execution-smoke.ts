import { mkdir, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { existsSync } from "node:fs";

import {
  buildTaskExecutionSmokeSummary,
  formatTaskExecutionSmokeMarkdown,
  getTaskExecutionSmokeExitCode,
  type TaskExecutionSmokeStepResult,
  type TaskExecutionSmokeAcceptanceCriterionKey,
} from "./task-execution-smoke-summary";

type Step = {
  readonly name: string;
  readonly command: readonly string[];
  readonly covers: readonly string[];
  readonly acceptanceCriteria: readonly TaskExecutionSmokeAcceptanceCriterionKey[];
};

const browserSmokePattern =
  "authenticated dashboard lands on My Work|Our Work assignment feeds My Work|My Work lifecycle actions|My Work updates Task fields and creates Subtasks|Team sidebar navigation opens a Team board filtered to that Team";
const e2eEnvFile = ".env.e2e";
const hasE2eEnvFile = existsSync(e2eEnvFile);
const requireFull = process.argv.includes("--require-full");

if (hasE2eEnvFile) {
  config({ path: e2eEnvFile, quiet: true });
}

const requiredEnvNames = ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"] as const;
const missingEnvNames = requiredEnvNames.filter((name) => !process.env[name]);
const allowsProcessE2eEnv = Boolean(process.env.CI);
const e2eReady = missingEnvNames.length === 0 && (hasE2eEnvFile || allowsProcessE2eEnv);
const e2eSkipReason = hasE2eEnvFile
  ? `Missing ${missingEnvNames.join(", ")} in ${e2eEnvFile}. E2E tests must not fall back to normal development Convex state.`
  : allowsProcessE2eEnv
    ? `Missing ${missingEnvNames.join(", ")} in the CI process environment. Export isolated Convex E2E values or copy .env.e2e.example to ${e2eEnvFile}.`
    : `Missing ${e2eEnvFile}. Local E2E tests require an explicit isolated env file and must not fall back to normal development Convex state.`;

const steps: readonly Step[] = [
  {
    name: "smoke runner contract",
    command: ["bun", "test", "scripts/task-execution-smoke-summary.test.ts"],
    covers: [
      "Regression report preserves skipped browser verification as an explicit closure gate.",
    ],
    acceptanceCriteria: ["regression_verification"],
  },
  {
    name: "backend public-boundary smoke",
    command: [
      "bun",
      "--filter",
      "@church-task/backend",
      "test:backend",
      "--",
      "confect/authenticatedStateSpike.test.ts",
      "-t",
      "Task execution smoke path",
    ],
    covers: [
      "Task can be created, assigned, moved, completed, canceled, and reopened through public backend/MCP contracts.",
      "MCP and web-facing public Confect reads share the same Task execution semantics.",
      "Activity history records event types, metadata, and authenticated actor ids for the smoke path.",
    ],
    acceptanceCriteria: [
      "cross_surface_lifecycle",
      "web_reflects_contract_changes",
      "activity_history",
      "regression_verification",
    ],
  },
  {
    name: "CLI public smoke",
    command: [
      "bun",
      "--filter",
      "@church-task/cli",
      "test:cli",
      "--",
      "cli.test.ts",
      "-t",
      "runs the Task execution smoke path through the public CLI",
    ],
    covers: [
      "CLI uses the same Task execution semantics as the MCP-backed backend contract.",
      "CLI smoke covers create, assign, move, complete, cancel, and reopen command behavior.",
      "CLI path preserves Task State, finishedAt, Activity ordering, and authenticated actor ids.",
    ],
    acceptanceCriteria: [
      "cross_surface_lifecycle",
      "cli_mcp_shared_semantics",
      "activity_history",
      "regression_verification",
    ],
  },
  {
    name: "fast web execution smoke",
    command: [
      "bun",
      "test",
      "apps/web/src/components/tasks/task-execution-surface.test.ts",
      "apps/web/src/components/tasks/task-kanban-adapter.test.ts",
    ],
    covers: [
      "Web routes read My Work, Our Work, and Team board Tasks through the shared execution filters.",
      "Fast web coverage proves creation defaults, assignment controls, lifecycle controls, and Kanban adapter behavior.",
    ],
    acceptanceCriteria: [
      "cross_surface_lifecycle",
      "web_reflects_contract_changes",
      "kanban_persists_movement",
      "regression_verification",
    ],
  },
  {
    name: "browser execution smoke",
    command: ["bun", "run", "test:e2e", "tests/e2e/app-shell.spec.ts", "-g", browserSmokePattern],
    covers: [
      "Web routes reflect backend state through browser-visible My Work, Our Work, lifecycle, and Team board workflows.",
      "ReUI Kanban drag/drop persists movement through backend state in browser smoke coverage.",
      "Final #71 closure requires this step to pass, not skip, with isolated Convex E2E env values from .env.e2e or CI secrets.",
    ],
    acceptanceCriteria: [
      "cross_surface_lifecycle",
      "web_reflects_contract_changes",
      "kanban_persists_movement",
      "regression_verification",
    ],
  },
];

const results: TaskExecutionSmokeStepResult[] = [];

for (const step of steps) {
  console.log(`\n>>> ${step.name}`);
  console.log(step.command.join(" "));

  const startedAt = performance.now();
  const proc = Bun.spawn(step.command, {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  const exitCode = await proc.exited;
  const durationMs = Math.round(performance.now() - startedAt);
  const status =
    exitCode !== 0
      ? "failed"
      : step.name === "browser execution smoke" && !e2eReady
        ? "skipped"
        : "passed";

  results.push({
    name: step.name,
    command: step.command.join(" "),
    covers: step.covers,
    acceptanceCriteria: step.acceptanceCriteria,
    exitCode,
    durationMs,
    status,
    skipReason: status === "skipped" ? e2eSkipReason : undefined,
  });

  if (exitCode !== 0) {
    break;
  }
}

const summary = buildTaskExecutionSmokeSummary({
  generatedAt: new Date().toISOString(),
  e2eReady,
  e2eSkipReason: e2eReady ? null : e2eSkipReason,
  e2eRequirements: {
    envFile: `${e2eEnvFile} or CI process environment`,
    requiredEnvNames,
    ciSecretNames: ["E2E_CONVEX_URL", "E2E_CONVEX_SITE_URL"],
  },
  plannedSteps: steps.map((step) => ({
    name: step.name,
    acceptanceCriteria: step.acceptanceCriteria,
  })),
  results,
});

await mkdir("test-results", { recursive: true });
await writeFile("test-results/task-execution-smoke.json", `${JSON.stringify(summary, null, 2)}\n`);
await writeFile("test-results/task-execution-smoke.md", formatTaskExecutionSmokeMarkdown(summary));

console.log(
  "\nTask execution smoke summary written to test-results/task-execution-smoke.json and test-results/task-execution-smoke.md",
);

const exitCode = getTaskExecutionSmokeExitCode(summary, { requireFull });

if (requireFull && summary.status === "passed_with_skips") {
  console.error(
    "\nFull Task execution smoke requires browser E2E verification; skipped browser smoke is not accepted.",
  );
}

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
