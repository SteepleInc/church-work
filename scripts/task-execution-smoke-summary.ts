export type TaskExecutionSmokeStatus = "passed" | "failed" | "skipped";

export type TaskExecutionSmokeAcceptanceCriterionKey =
  | "cross_surface_lifecycle"
  | "web_reflects_contract_changes"
  | "cli_mcp_shared_semantics"
  | "activity_history"
  | "kanban_persists_movement"
  | "regression_verification";

export type TaskExecutionSmokeAcceptanceCriterionCoverage = {
  readonly key: TaskExecutionSmokeAcceptanceCriterionKey;
  readonly text: string;
  readonly status: "passed" | "blocked" | "uncovered";
  readonly coveredBy: readonly string[];
};

export type TaskExecutionSmokeStepResult = {
  readonly name: string;
  readonly command: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly status: TaskExecutionSmokeStatus;
  readonly skipReason?: string;
  readonly covers: readonly string[];
  readonly acceptanceCriteria?: readonly TaskExecutionSmokeAcceptanceCriterionKey[];
};

export type TaskExecutionSmokePlannedStep = {
  readonly name: string;
  readonly acceptanceCriteria: readonly TaskExecutionSmokeAcceptanceCriterionKey[];
};

export type TaskExecutionSmokeBlockingStep = {
  readonly name: string;
  readonly command: string;
  readonly reason: string;
};

export type TaskExecutionSmokeSummary = {
  readonly generatedAt: string;
  readonly issueLinks: {
    readonly prdIssue: string;
    readonly taskIssue: string;
  };
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly e2eRequirements: {
    readonly envFile: string;
    readonly requiredEnvNames: readonly string[];
    readonly ciSecretNames: readonly string[];
  };
  readonly status: "passed" | "failed" | "passed_with_skips";
  readonly totalDurationMs: number;
  readonly closureGate: {
    readonly ready: boolean;
    readonly fullVerificationCommand: string;
    readonly blockingSteps: readonly string[];
    readonly blockingStepDetails: readonly TaskExecutionSmokeBlockingStep[];
  };
  readonly acceptanceCriteriaCoverage: readonly TaskExecutionSmokeAcceptanceCriterionCoverage[];
  readonly results: readonly TaskExecutionSmokeStepResult[];
};

export const taskExecutionSmokeFullVerificationCommand = "bun run test:task-execution-smoke:full";

export const taskExecutionSmokeAcceptanceCriteria: readonly Omit<
  TaskExecutionSmokeAcceptanceCriterionCoverage,
  "status" | "coveredBy"
>[] = [
  {
    key: "cross_surface_lifecycle",
    text: "A Task can be created, assigned, moved, completed, canceled, and reopened through the implemented execution surfaces.",
  },
  {
    key: "web_reflects_contract_changes",
    text: "Web routes reflect changes made through backend/MCP/CLI contracts.",
  },
  {
    key: "cli_mcp_shared_semantics",
    text: "CLI and MCP use the same Task execution semantics as the web UI.",
  },
  {
    key: "activity_history",
    text: "Activity history records the correct event types, metadata, and authenticated actor ids for the smoke path.",
  },
  {
    key: "kanban_persists_movement",
    text: "The ReUI Kanban board persists drag/drop movement through backend state.",
  },
  {
    key: "regression_verification",
    text: "Regression tests or documented verification cover the critical end-to-end path without coupling to private implementation details.",
  },
];

export function getTaskExecutionSmokeExitCode(
  summary: Pick<TaskExecutionSmokeSummary, "status">,
  options: { readonly requireFull: boolean },
) {
  if (summary.status === "failed") {
    return 1;
  }

  if (options.requireFull && summary.status === "passed_with_skips") {
    return 1;
  }

  return 0;
}

export function buildTaskExecutionSmokeSummary(input: {
  readonly generatedAt: string;
  readonly issueLinks: {
    readonly prdIssue: string;
    readonly taskIssue: string;
  };
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly e2eRequirements: {
    readonly envFile: string;
    readonly requiredEnvNames: readonly string[];
    readonly ciSecretNames: readonly string[];
  };
  readonly plannedSteps?: readonly TaskExecutionSmokePlannedStep[];
  readonly results: readonly TaskExecutionSmokeStepResult[];
}): TaskExecutionSmokeSummary {
  const status = input.results.some((result) => result.status === "failed")
    ? "failed"
    : input.results.some((result) => result.status === "skipped")
      ? "passed_with_skips"
      : "passed";
  const totalDurationMs = input.results.reduce((total, result) => total + result.durationMs, 0);
  const blockingSteps = input.results.flatMap((result) => {
    if (result.status === "failed") {
      return [`${result.name} failed with exit code ${result.exitCode}`];
    }

    if (result.status === "skipped") {
      const reason = result.skipReason ? `: ${result.skipReason}` : "";
      return [`${result.name} was skipped${reason}`];
    }

    return [];
  });
  const blockingStepDetails = input.results.flatMap((result): TaskExecutionSmokeBlockingStep[] => {
    if (result.status === "failed") {
      return [
        {
          name: result.name,
          command: result.command,
          reason: `failed with exit code ${result.exitCode}`,
        },
      ];
    }

    if (result.status === "skipped") {
      return [
        {
          name: result.name,
          command: result.command,
          reason: result.skipReason ? `skipped: ${result.skipReason}` : "skipped",
        },
      ];
    }

    return [];
  });

  const acceptanceCriteriaCoverage = taskExecutionSmokeAcceptanceCriteria.map((criterion) => {
    const coveringResults = input.results.filter((result) =>
      result.acceptanceCriteria?.includes(criterion.key),
    );
    const resultNames = new Set(input.results.map((result) => result.name));
    const unrunPlannedSteps = (input.plannedSteps ?? []).filter(
      (step) => !resultNames.has(step.name) && step.acceptanceCriteria.includes(criterion.key),
    );
    const coveredBy = [
      ...coveringResults.map((result) => result.name),
      ...unrunPlannedSteps.map((step) => `${step.name} (not run)`),
    ];
    const criterionStatus =
      coveredBy.length === 0
        ? "uncovered"
        : coveringResults.some((result) => result.status !== "passed") ||
            unrunPlannedSteps.length > 0
          ? "blocked"
          : "passed";

    return {
      ...criterion,
      status: criterionStatus,
      coveredBy,
    };
  });

  return {
    ...input,
    status,
    totalDurationMs,
    closureGate: {
      ready: status === "passed",
      fullVerificationCommand: taskExecutionSmokeFullVerificationCommand,
      blockingSteps,
      blockingStepDetails,
    },
    acceptanceCriteriaCoverage,
  };
}

export function formatTaskExecutionSmokeMarkdown(summary: TaskExecutionSmokeSummary) {
  const lines = [
    "# Task Execution Smoke Report",
    "",
    `Generated: ${summary.generatedAt}`,
    `Status: ${summary.status}`,
    `Parent PRD: ${summary.issueLinks.prdIssue}`,
    `Task issue: ${summary.issueLinks.taskIssue}`,
    `E2E ready: ${summary.e2eReady ? "yes" : "no"}`,
    `Total duration: ${formatDuration(summary.totalDurationMs)}`,
    `E2E env file: ${summary.e2eRequirements.envFile}`,
    `E2E required env: ${summary.e2eRequirements.requiredEnvNames.join(", ")}`,
    `E2E CI secrets: ${summary.e2eRequirements.ciSecretNames.join(", ")}`,
  ];

  if (summary.e2eSkipReason) {
    lines.push("", `E2E skip reason: ${summary.e2eSkipReason}`);
  }

  lines.push(
    "",
    "## Closure Gate",
    "",
    `Ready to close #71: ${summary.closureGate.ready ? "yes" : "no"}`,
    `Full verification command: ${summary.closureGate.fullVerificationCommand}`,
  );

  if (summary.closureGate.blockingSteps.length > 0) {
    lines.push("", "Blocking steps:");

    for (const blockingStep of summary.closureGate.blockingSteps) {
      lines.push(`- ${blockingStep}`);
    }
  }

  if (summary.closureGate.blockingStepDetails.length > 0) {
    lines.push("", "Blocking step commands:");

    for (const blockingStep of summary.closureGate.blockingStepDetails) {
      lines.push(`- ${blockingStep.name}: \`${blockingStep.command}\` (${blockingStep.reason})`);
    }
  }

  lines.push(
    "",
    "| Step | Status | Duration | Skip Reason | Exit Code | Command |",
    "| --- | --- | ---: | --- | ---: | --- |",
  );

  for (const result of summary.results) {
    lines.push(
      `| ${escapeMarkdownTableCell(result.name)} | ${result.status} | ${formatDuration(result.durationMs)} | ${result.skipReason ? escapeMarkdownTableCell(result.skipReason) : ""} | ${result.exitCode} | ${escapeMarkdownTableCell(result.command)} |`,
    );
  }

  lines.push("", "## Acceptance Coverage", "");

  for (const result of summary.results) {
    lines.push(`### ${result.name}`, "");

    if (result.covers.length === 0) {
      lines.push("- No explicit acceptance criteria mapped.", "");
      continue;
    }

    for (const coverage of result.covers) {
      lines.push(`- ${coverage}`);
    }

    lines.push("");
  }

  lines.push(
    "## #71 Acceptance Criteria",
    "",
    "| Criterion | Status | Requirement | Covered By |",
    "| --- | --- | --- | --- |",
  );

  for (const criterion of summary.acceptanceCriteriaCoverage) {
    lines.push(
      `| ${criterion.key} | ${criterion.status} | ${escapeMarkdownTableCell(criterion.text)} | ${criterion.coveredBy.length > 0 ? escapeMarkdownTableCell(criterion.coveredBy.join(", ")) : "None"} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownTableCell(value: string) {
  return value.replaceAll("|", "\\|");
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1_000).toFixed(1)}s`;
}
