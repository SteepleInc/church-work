export type TaskExecutionSmokeStatus = "passed" | "failed" | "skipped";

export type TaskExecutionSmokeStepResult = {
  readonly name: string;
  readonly command: string;
  readonly exitCode: number;
  readonly status: TaskExecutionSmokeStatus;
};

export type TaskExecutionSmokeSummary = {
  readonly generatedAt: string;
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly status: "passed" | "failed" | "passed_with_skips";
  readonly results: readonly TaskExecutionSmokeStepResult[];
};

export function buildTaskExecutionSmokeSummary(input: {
  readonly generatedAt: string;
  readonly e2eReady: boolean;
  readonly e2eSkipReason: string | null;
  readonly results: readonly TaskExecutionSmokeStepResult[];
}): TaskExecutionSmokeSummary {
  return {
    ...input,
    status: input.results.some((result) => result.status === "failed")
      ? "failed"
      : input.results.some((result) => result.status === "skipped")
        ? "passed_with_skips"
        : "passed",
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

  lines.push("", "| Step | Status | Exit Code | Command |", "| --- | --- | ---: | --- |");

  for (const result of summary.results) {
    lines.push(
      `| ${escapeMarkdownTableCell(result.name)} | ${result.status} | ${result.exitCode} | ${escapeMarkdownTableCell(result.command)} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownTableCell(value: string) {
  return value.replaceAll("|", "\\|");
}
