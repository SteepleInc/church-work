export type TaskExecutionSmokeStatus = "passed" | "failed" | "skipped";

export type TaskExecutionSmokeStepResult = {
  readonly name: string;
  readonly command: string;
  readonly exitCode: number;
  readonly status: TaskExecutionSmokeStatus;
  readonly covers: readonly string[];
};

export type TaskExecutionSmokeSummary = {
  readonly generatedAt: string;
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly status: "passed" | "failed" | "passed_with_skips";
  readonly closureGate: {
    readonly ready: boolean;
    readonly fullVerificationCommand: string;
    readonly blockingSteps: readonly string[];
  };
  readonly results: readonly TaskExecutionSmokeStepResult[];
};

export const taskExecutionSmokeFullVerificationCommand = "bun run test:task-execution-smoke:full";

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
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly results: readonly TaskExecutionSmokeStepResult[];
}): TaskExecutionSmokeSummary {
  const status = input.results.some((result) => result.status === "failed")
    ? "failed"
    : input.results.some((result) => result.status === "skipped")
      ? "passed_with_skips"
      : "passed";
  const blockingSteps = input.results.flatMap((result) => {
    if (result.status === "failed") {
      return [`${result.name} failed with exit code ${result.exitCode}`];
    }

    if (result.status === "skipped") {
      return [`${result.name} was skipped`];
    }

    return [];
  });

  return {
    ...input,
    status,
    closureGate: {
      ready: status === "passed",
      fullVerificationCommand: taskExecutionSmokeFullVerificationCommand,
      blockingSteps,
    },
  };
}

export function formatTaskExecutionSmokeMarkdown(summary: TaskExecutionSmokeSummary) {
  const lines = [
    "# Task Execution Smoke Report",
    "",
    `Generated: ${summary.generatedAt}`,
    `Status: ${summary.status}`,
    `E2E ready: ${summary.e2eReady ? "yes" : "no"}`,
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

  lines.push("", "| Step | Status | Exit Code | Command |", "| --- | --- | ---: | --- |");

  for (const result of summary.results) {
    lines.push(
      `| ${escapeMarkdownTableCell(result.name)} | ${result.status} | ${result.exitCode} | ${escapeMarkdownTableCell(result.command)} |`,
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

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownTableCell(value: string) {
  return value.replaceAll("|", "\\|");
}
