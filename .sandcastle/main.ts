// Parallel Planner with Review — local runner that publishes GitHub PRs
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Publish):          Push completed branches and create/update PRs
//                               on GitHub. Merging happens through GitHub, not
//                               by locally merging branches into this checkout.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues can be picked up after each round of published PRs.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync, execSync } from "node:child_process";
import { z } from "zod";

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema. We use Zod here, but any Standard
// Schema validator works just as well — Valibot, ArkType, etc. See
// https://standardschema.dev.
const planSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      branch: z.string(),
      needsUi: z.boolean(),
      uiBrief: z.string().optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→publish cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;
const MAX_PARALLEL = 4;
const AUTO_MERGE_PRS = process.env.SANDCASTLE_AUTO_MERGE !== "false";
const BASE_BRANCH = process.env.SANDCASTLE_BASE_BRANCH ?? currentBranch();
const PR_CHECK_REPAIR = process.env.SANDCASTLE_REPAIR_FAILED_CHECKS !== "false";
const MAX_REPAIR_ATTEMPTS = Number(process.env.SANDCASTLE_MAX_REPAIR_ATTEMPTS ?? "3");
const CHECK_POLL_INTERVAL_MS = Number(process.env.SANDCASTLE_CHECK_POLL_INTERVAL_MS ?? "30000");
const CHECK_TIMEOUT_MS = Number(process.env.SANDCASTLE_CHECK_TIMEOUT_MS ?? String(20 * 60 * 1000));

const allAroundAgent = () => sandcastle.opencode("openai/gpt-5.5", { variant: "low" });

const uiAgent = () => sandcastle.opencode("anthropic/claude-opus-4-8");

const sandboxProvider = () =>
  docker({
    mounts: [
      {
        hostPath: "~/.config/opencode",
        sandboxPath: "/home/agent/.config/opencode",
        readonly: true,
      },
      {
        hostPath: "~/.local/share/opencode/auth.json",
        sandboxPath: "/home/agent/.local/share/opencode/auth.json",
        readonly: true,
      },
      {
        hostPath: "~/.local/share/opencode/account.json",
        sandboxPath: "/home/agent/.local/share/opencode/account.json",
        readonly: true,
      },
    ],
  });

// Hooks run inside the sandbox before the agent starts each iteration.
// Bun install ensures the sandbox always has fresh dependencies.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "bun install" }] },
};

// Copy host-only files into the worktree before each sandbox starts.
// node_modules avoids a full Bun install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
// The env files are gitignored, so worktrees do not receive them automatically.
const copyToWorktree = ["node_modules", ".env.local", ".env.e2e"];

const acquireSlot = (() => {
  let running = 0;
  const queue: Array<() => void> = [];

  return async () => {
    if (running < MAX_PARALLEL) {
      running++;
      return () => {
        running--;
        const next = queue.shift();
        if (next) {
          running++;
          next();
        }
      };
    }

    await new Promise<void>((resolve) => queue.push(resolve));
    return () => {
      running--;
      const next = queue.shift();
      if (next) {
        running++;
        next();
      }
    };
  };
})();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — Output.object parses and validates it.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code. (Structured output requires maxIterations: 1.)
    maxIterations: 1,
    // All-around for planning: keep issue triage fast and pragmatic.
    agent: allAroundAgent(),
    promptFile: "./.sandcastle/plan-prompt.md",
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing, the JSON is malformed, or
    // validation fails — which aborts the loop.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(`Planning complete. ${issues.length} issue(s) to work in parallel:`);
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const releaseSlot = await acquireSlot();

      try {
        const sandbox = await sandcastle.createSandbox({
          branch: issue.branch,
          sandbox: sandboxProvider(),
          hooks,
          copyToWorktree,
        });

        try {
          // Run the all-around builder for backend, data, plumbing, and baseline implementation.
          const implement = await sandbox.run({
            name: `all-around-builder-${issue.id}`,
            maxIterations: 100,
            agent: allAroundAgent(),
            promptFile: "./.sandcastle/implement-prompt.md",
            promptArgs: {
              TASK_ID: issue.id,
              ISSUE_TITLE: issue.title,
              BRANCH: issue.branch,
              NEEDS_UI: String(issue.needsUi),
              UI_BRIEF: issue.uiBrief ?? "No dedicated UI phase requested.",
            },
          });

          let commits = implement.commits;

          if (issue.needsUi) {
            const ui = await sandbox.run({
              name: `ui-builder-${issue.id}`,
              maxIterations: 20,
              agent: uiAgent(),
              promptFile: "./.sandcastle/ui-prompt.md",
              promptArgs: {
                TASK_ID: issue.id,
                ISSUE_TITLE: issue.title,
                BRANCH: issue.branch,
                UI_BRIEF:
                  issue.uiBrief ??
                  "Make the UI excellent and consistent with Church Task's design language.",
              },
            });
            commits = [...commits, ...ui.commits];
          }

          const verify = await sandbox.run({
            name: `all-around-verify-fixer-${issue.id}`,
            maxIterations: 30,
            agent: allAroundAgent(),
            promptFile: "./.sandcastle/verify-fix-prompt.md",
            promptArgs: {
              TASK_ID: issue.id,
              ISSUE_TITLE: issue.title,
              BRANCH: issue.branch,
              NEEDS_UI: String(issue.needsUi),
            },
          });
          commits = [...commits, ...verify.commits];

          return { ...verify, commits };
        } finally {
          await sandbox.close();
        }
      } finally {
        releaseSlot();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(`  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`);
    }
  }

  const failedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter((entry) => entry.outcome.status === "rejected")
    .map((entry) => entry.issue);

  // Only publish branches that actually produced commits.
  // An agent that ran successfully but made no commits has nothing to publish.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) => entry.outcome.status === "fulfilled" && entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(`\nExecution complete. ${completedBranches.length} branch(es) with commits:`);
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    if (failedIssues.length > 0) {
      console.error(
        `Stopping because ${failedIssues.length} issue pipeline(s) failed and no branches were ready to publish.`,
      );
      process.exitCode = 1;
      break;
    }

    // All agents ran but none made commits — nothing to publish this cycle.
    console.log("No commits produced. Nothing to publish.");
    break;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Publish PRs
  //
  // Keep the whole workflow locally initiated, but move integration/merge into
  // GitHub. This gives us PR checks, review comments, and normal GitHub merge
  // semantics instead of a local mega-merge branch.
  // -------------------------------------------------------------------------
  for (const issue of completedIssues) {
    const prUrl = publishIssuePr({ baseBranch: BASE_BRANCH, issue });
    console.log(`  PR ready for ${issue.id}: ${prUrl}`);

    await runPostPrReview({ issue, prUrl });

    const autoMergeEnabled = AUTO_MERGE_PRS ? enableAutoMerge(prUrl) : false;
    if (autoMergeEnabled) {
      console.log(`  GitHub auto-merge enabled for ${prUrl}`);
    } else if (AUTO_MERGE_PRS) {
      console.log(`  GitHub auto-merge unavailable; will merge ${prUrl} after checks pass.`);
    } else {
      console.log(`  Auto-merge skipped for ${prUrl} because SANDCASTLE_AUTO_MERGE=false`);
    }

    let checksReadyToMerge = true;
    if (PR_CHECK_REPAIR) {
      checksReadyToMerge = await repairFailedPrChecks({ issue, prUrl });
    } else if (AUTO_MERGE_PRS && !autoMergeEnabled) {
      checksReadyToMerge = checksArePassing(await waitForChecks(prUrl));
    }

    if (AUTO_MERGE_PRS && !autoMergeEnabled && checksReadyToMerge) {
      mergePr(prUrl);
    } else if (AUTO_MERGE_PRS && autoMergeEnabled && checksReadyToMerge) {
      console.log(`  PR checks passed or PR merged; GitHub auto-merge owns final merge: ${prUrl}`);
    }
  }

  console.log("\nBranches published as GitHub PRs.");
}

console.log("\nAll done.");

function currentBranch() {
  return sh("git branch --show-current").trim();
}

function publishIssuePr({
  baseBranch,
  issue,
}: {
  baseBranch: string;
  issue: z.infer<typeof planSchema>["issues"][number];
}) {
  sh(`git push --set-upstream origin ${quote(issue.branch)}`);

  const existingPr = safeSh(`gh pr view ${quote(issue.branch)} --json url --jq .url`).trim();

  if (existingPr) {
    return existingPr;
  }

  return execFileSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      baseBranch,
      "--head",
      issue.branch,
      "--title",
      `Sandcastle: ${issue.title}`,
      "--body",
      [
        `Closes #${issue.id}`,
        "",
        "Implemented by the local Sandcastle workflow.",
        "",
        "Merging is intentionally handled by GitHub so this branch gets normal PR checks, review comments, and merge history.",
      ].join("\n"),
    ],
    { encoding: "utf8" },
  ).trim();
}

function enableAutoMerge(prUrl: string) {
  try {
    execFileSync("gh", ["pr", "merge", prUrl, "--auto", "--squash", "--delete-branch"], {
      encoding: "utf8",
    });
    return true;
  } catch (error) {
    console.warn(`  Could not enable auto-merge for ${prUrl}: ${String(error)}`);
    return false;
  }
}

function mergePr(prUrl: string) {
  execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
    encoding: "utf8",
  });
  console.log(`  PR merged through GitHub: ${prUrl}`);
}

async function runPostPrReview({
  issue,
  prUrl,
}: {
  issue: z.infer<typeof planSchema>["issues"][number];
  prUrl: string;
}) {
  console.log(`  Running post-PR review for ${issue.id}: ${prUrl}`);

  const sandbox = await sandcastle.createSandbox({
    branch: issue.branch,
    sandbox: sandboxProvider(),
    hooks,
    copyToWorktree,
  });

  try {
    let reviewCommitCount = 0;

    if (issue.needsUi) {
      const uiReview = await sandbox.run({
        name: `post-pr-ui-design-reviewer-${issue.id}`,
        maxIterations: 3,
        agent: uiAgent(),
        promptFile: "./.sandcastle/ui-review-prompt.md",
        promptArgs: {
          TASK_ID: issue.id,
          ISSUE_TITLE: issue.title,
          BRANCH: issue.branch,
          PR_URL: prUrl,
          UI_BRIEF: issue.uiBrief ?? "Review design quality and UX fit.",
        },
      });
      reviewCommitCount += uiReview.commits.length;
    }

    const codeReview = await sandbox.run({
      name: `post-pr-all-around-code-reviewer-${issue.id}`,
      maxIterations: 3,
      agent: allAroundAgent(),
      promptFile: "./.sandcastle/review-prompt.md",
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        BRANCH: issue.branch,
        PR_URL: prUrl,
      },
    });
    reviewCommitCount += codeReview.commits.length;

    if (reviewCommitCount > 0) {
      sh(`git push origin ${quote(issue.branch)}`);
      console.log(`  Post-PR review pushed ${reviewCommitCount} commit(s) to ${prUrl}`);
    }
  } finally {
    await sandbox.close();
  }
}

async function repairFailedPrChecks({
  issue,
  prUrl,
}: {
  issue: z.infer<typeof planSchema>["issues"][number];
  prUrl: string;
}) {
  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    console.log(`  Waiting for PR checks (${attempt}/${MAX_REPAIR_ATTEMPTS}): ${prUrl}`);
    const checks = await waitForChecks(prUrl);
    const failedChecks = checks.filter(
      (check) => check.bucket === "fail" || check.conclusion === "failure",
    );

    if (failedChecks.length === 0) {
      console.log(`  PR checks are not failing: ${prUrl}`);
      return checks.length === 0 || checksArePassing(checks);
    }

    console.log(`  ${failedChecks.length} PR check(s) failed; running repair agent.`);

    const sandbox = await sandcastle.createSandbox({
      branch: issue.branch,
      sandbox: sandboxProvider(),
      hooks,
      copyToWorktree,
    });

    try {
      await sandbox.run({
        name: `pr-check-repair-${issue.id}-${attempt}`,
        maxIterations: 30,
        agent: allAroundAgent(),
        promptFile: "./.sandcastle/pr-check-repair-prompt.md",
        promptArgs: {
          TASK_ID: issue.id,
          ISSUE_TITLE: issue.title,
          BRANCH: issue.branch,
          PR_URL: prUrl,
          FAILED_CHECKS_JSON: JSON.stringify(failedChecks, null, 2),
        },
      });
    } finally {
      await sandbox.close();
    }

    sh(`git push origin ${quote(issue.branch)}`);
    if (AUTO_MERGE_PRS) {
      enableAutoMerge(prUrl);
    }
  }

  console.warn(
    `  PR checks still failing after ${MAX_REPAIR_ATTEMPTS} repair attempt(s): ${prUrl}`,
  );
  return false;
}

async function waitForChecks(prUrl: string) {
  const deadline = Date.now() + CHECK_TIMEOUT_MS;
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount++;

    if (prIsMerged(prUrl)) {
      console.log(`  PR already merged; stopping check polling: ${prUrl}`);
      return [];
    }

    const checks = getPrChecks(prUrl);
    if (checks.length === 0) {
      console.log(
        `  Check poll ${pollCount}: no checks reported yet; waiting ${CHECK_POLL_INTERVAL_MS / 1000}s...`,
      );
      await sleep(CHECK_POLL_INTERVAL_MS);
      continue;
    }

    const hasPending = checks.some(
      (check) => check.bucket === "pending" || check.state === "pending",
    );
    const hasFailing = checks.some(
      (check) => check.bucket === "fail" || check.conclusion === "failure",
    );

    console.log(`  Check poll ${pollCount}: ${formatCheckSummary(checks)}`);

    if (hasFailing || !hasPending) {
      return checks;
    }

    await sleep(CHECK_POLL_INTERVAL_MS);
  }

  console.warn(
    `  Timed out waiting for checks; leaving PR for GitHub auto-merge/manual inspection.`,
  );
  return [];
}

function prIsMerged(prUrl: string) {
  const json = safeSh(`gh pr view ${quote(prUrl)} --json state,mergedAt`);
  if (!json.trim()) {
    return false;
  }

  const pr = JSON.parse(json) as { state?: string; mergedAt?: string | null };
  return pr.state === "MERGED" || Boolean(pr.mergedAt);
}

function formatCheckSummary(checks: PrCheck[]) {
  const counts = checks.reduce(
    (summary, check) => {
      const bucket = check.bucket ?? check.state ?? check.conclusion ?? "unknown";
      summary[bucket] = (summary[bucket] ?? 0) + 1;
      return summary;
    },
    {} as Record<string, number>,
  );

  const names = checks
    .map(
      (check) =>
        `${check.name ?? check.workflow ?? "unnamed"}:${check.bucket ?? check.state ?? check.conclusion ?? "unknown"}`,
    )
    .join(", ");

  return `${Object.entries(counts)
    .map(([bucket, count]) => `${count} ${bucket}`)
    .join(", ")} (${names})`;
}

function checksArePassing(checks: PrCheck[]) {
  return (
    checks.length > 0 &&
    checks.every(
      (check) =>
        check.bucket !== "fail" &&
        check.conclusion !== "failure" &&
        check.bucket !== "pending" &&
        check.state !== "pending",
    )
  );
}

function getPrChecks(prUrl: string): PrCheck[] {
  const json = safeSh(
    `gh pr checks ${quote(prUrl)} --json bucket,conclusion,detailsUrl,link,name,state,workflow`,
  );
  if (json.trim()) {
    return JSON.parse(json) as PrCheck[];
  }

  const prJson = safeSh(`gh pr view ${quote(prUrl)} --json statusCheckRollup`);
  if (!prJson.trim()) {
    return [];
  }

  const pr = JSON.parse(prJson) as { statusCheckRollup?: GitHubStatusCheck[] };
  return (pr.statusCheckRollup ?? []).map((check) => ({
    bucket:
      check.conclusion === "SUCCESS" ? "pass" : check.status === "COMPLETED" ? "fail" : "pending",
    conclusion: check.conclusion,
    detailsUrl: check.detailsUrl,
    name: check.name,
    state: check.status === "COMPLETED" ? "completed" : "pending",
    workflow: check.workflowName,
  }));
}

type GitHubStatusCheck = {
  conclusion?: string;
  detailsUrl?: string;
  name?: string;
  status?: string;
  workflowName?: string;
};

type PrCheck = {
  bucket?: string;
  conclusion?: string;
  detailsUrl?: string;
  link?: string;
  name?: string;
  state?: string;
  workflow?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sh(command: string) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function safeSh(command: string) {
  try {
    return sh(command);
  } catch {
    return "";
  }
}

function quote(value: string) {
  return JSON.stringify(value);
}
