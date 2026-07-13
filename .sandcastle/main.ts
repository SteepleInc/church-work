// Parallel Planner with Review — local runner that publishes GitHub PRs
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a reusable sandbox runs the
//                               implementer, optional UI builder, modifying
//                               reviews, and final verifier before the first push. All
//                               issue pipelines run concurrently.
//   Phase 3 (Publish):          Push the final reviewed branch once, create or
//                               update its PR, repair failing CI centrally, and
//                               enable asynchronous GitHub auto-merge.
//
// By default the run exits after handing a batch to asynchronous auto-merge.
// Set SANDCASTLE_WAIT_FOR_MERGES=true to wait for the batch and repeat up to
// MAX_ITERATIONS so newly unblocked issues can be picked up.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
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

type PlannedIssue = z.infer<typeof planSchema>["issues"][number];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→publish cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;
const MAX_PARALLEL = 4;
const AUTO_MERGE_PRS = process.env.SANDCASTLE_AUTO_MERGE !== "false";
const BASE_BRANCH = process.env.SANDCASTLE_BASE_BRANCH ?? defaultBranch() ?? currentBranch();
const PR_CHECK_REPAIR = process.env.SANDCASTLE_REPAIR_FAILED_CHECKS !== "false";
const MAX_REPAIR_ATTEMPTS = Number(process.env.SANDCASTLE_MAX_REPAIR_ATTEMPTS ?? "3");
const CHECK_POLL_INTERVAL_MS = Number(process.env.SANDCASTLE_CHECK_POLL_INTERVAL_MS ?? "30000");
const CHECK_TIMEOUT_MS = Number(process.env.SANDCASTLE_CHECK_TIMEOUT_MS ?? String(20 * 60 * 1000));
const WAIT_FOR_MERGES = process.env.SANDCASTLE_WAIT_FOR_MERGES === "true";
const MERGE_TIMEOUT_MS = Number(process.env.SANDCASTLE_MERGE_TIMEOUT_MS ?? String(20 * 60 * 1000));
const BUN_CACHE_DIR = ".sandcastle/bun-cache";
const SANDBOX_IMAGE_NAME = process.env.SANDCASTLE_IMAGE_NAME ?? "sandcastle:church-work";
const SANDBOX_TURBO_CACHE_DIR = "/home/agent/workspace/.turbo/cache";
const SANDBOX_CAN_RUN_CONTAINER_TESTS = preflightSandbox();
const PRE_PUBLISH_REVIEW_COMPLETE_MARKER = "<!-- sandcastle-pre-publish-review-complete -->";
const LEGACY_POST_PR_REVIEW_COMPLETE_MARKER = "<!-- sandcastle-post-pr-review-complete -->";

const LOCAL_VERIFICATION_POLICY = SANDBOX_CAN_RUN_CONTAINER_TESTS
  ? [
      "Container-backed tests are available in this sandbox.",
      "Run targeted checks while iterating; the verify phase owns one final bun check:e2e run.",
    ].join(" ")
  : [
      "Container-backed tests are unavailable in this sandbox.",
      "Do not run or retry Docker, Testcontainers, Playwright E2E, bun check, or bun check:e2e.",
      "Defer the full container-backed gate to GitHub CI.",
    ].join(" ");

// Containers are short-lived, so persist a Linux-only Bun cache on the host.
// This avoids mixing macOS artifacts into the sandbox while keeping installs warm.
mkdirSync(BUN_CACHE_DIR, { recursive: true });

const allAroundAgent = () => sandcastle.opencode("openai/gpt-5.6-sol", { variant: "low" });

const uiAgent = () => sandcastle.opencode("anthropic/claude-opus-4-8");

const sandboxProvider = () =>
  docker({
    imageName: SANDBOX_IMAGE_NAME,
    env: {
      SANDCASTLE_CAN_RUN_CONTAINER_TESTS: String(SANDBOX_CAN_RUN_CONTAINER_TESTS),
      TURBO_CACHE_DIR: SANDBOX_TURBO_CACHE_DIR,
    },
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
      {
        hostPath: BUN_CACHE_DIR,
        sandboxPath: "/home/agent/.bun/install/cache",
      },
    ],
  });

// Hooks run inside the sandbox before the agent starts each iteration.
// Bun install ensures the sandbox always has fresh dependencies.
const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command: 'mkdir -p "$TURBO_CACHE_DIR" && bun install --frozen-lockfile',
      },
    ],
  },
};

// Copy host-only env files into the worktree before each sandbox starts. The
// dependency cache is mounted separately so node_modules is built for Linux.
const copyToWorktree = [".env.local", ".env.e2e"];

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

console.log(
  `Sandbox preflight: container-backed tests ${SANDBOX_CAN_RUN_CONTAINER_TESTS ? "enabled" : "disabled"}; Turbo cache ${SANDBOX_TURBO_CACHE_DIR}.`,
);

async function runPrePublishReviewAndVerify({
  issue,
  sandbox,
}: {
  issue: PlannedIssue;
  sandbox: Awaited<ReturnType<typeof sandcastle.createSandbox>>;
}) {
  const commits: Array<{ sha: string }> = [];

  if (issue.needsUi) {
    const uiReview = await sandbox.run({
      name: `pre-publish-ui-design-reviewer-${issue.id}`,
      maxIterations: 3,
      agent: uiAgent(),
      promptFile: "./.sandcastle/ui-review-prompt.md",
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        BRANCH: issue.branch,
        UI_BRIEF: issue.uiBrief ?? "Review design quality and UX fit.",
        VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
      },
    });
    commits.push(...uiReview.commits);
  }

  const codeReview = await sandbox.run({
    name: `pre-publish-all-around-code-reviewer-${issue.id}`,
    maxIterations: 3,
    agent: allAroundAgent(),
    promptFile: "./.sandcastle/review-prompt.md",
    promptArgs: {
      TASK_ID: issue.id,
      ISSUE_TITLE: issue.title,
      BRANCH: issue.branch,
      VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
    },
  });
  commits.push(...codeReview.commits);

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
      VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
    },
  });
  commits.push(...verify.commits);

  return commits;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  refreshBaseBranch();

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

  const existingPrIssues = issues
    .map((issue) => ({ issue, prUrl: findIssuePr(issue) }))
    .filter((entry): entry is { issue: (typeof issues)[number]; prUrl: string } =>
      Boolean(entry.prUrl),
    );
  const existingPrIssueIds = new Set(existingPrIssues.map((entry) => entry.issue.id));
  const issuesToBuild = issues.filter((issue) => !existingPrIssueIds.has(issue.id));

  for (const entry of existingPrIssues) {
    console.log(`  ${entry.issue.id}: existing PR in flight → ${entry.prUrl}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review + Verify
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and every modifying phase shares one sandbox instance per branch. Reviews
  // happen before publication so GitHub CI sees the final reviewed commit once.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issuesToBuild.map(async (issue) => {
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
              VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
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
                  "Make the UI excellent and consistent with Church Work's design language.",
                VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
              },
            });
            commits = [...commits, ...ui.commits];
          }

          const reviewAndVerifyCommits = await runPrePublishReviewAndVerify({ issue, sandbox });
          commits = [...commits, ...reviewAndVerifyCommits];

          return { commits };
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
      console.error(
        `  ✗ ${issuesToBuild[i]!.id} (${issuesToBuild[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  const failedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issuesToBuild[i]! }))
    .filter((entry) => entry.outcome.status === "rejected")
    .map((entry) => entry.issue);

  // Only publish branches that actually produced commits.
  // An agent that ran successfully but made no commits has nothing to publish.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issuesToBuild[i]! }))
    .filter(
      (entry) => entry.outcome.status === "fulfilled" && entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(`\nExecution complete. ${completedBranches.length} branch(es) with commits:`);
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0 && existingPrIssues.length === 0) {
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
  // Push the already-reviewed branch once, let the runner own CI repair, and
  // hand integration to GitHub auto-merge without waiting on each PR serially.
  // -------------------------------------------------------------------------
  let stopRun = false;
  const prWorkItems = [
    ...existingPrIssues,
    ...completedIssues.map((issue) => ({ issue, prUrl: undefined })),
  ];

  const preparedPrResults = await Promise.allSettled(
    prWorkItems.map(async ({ issue, prUrl: existingPrUrl }) => {
      const prUrl = existingPrUrl ?? publishIssuePr({ baseBranch: BASE_BRANCH, issue });
      console.log(`  PR ready for ${issue.id}: ${prUrl}`);

      if (existingPrUrl && !prePublishReviewIsComplete(prUrl)) {
        await recoverMissingPrePublishReview({ issue, prUrl });
      }

      const branchUpToDate = await ensurePrBranchUpToDate({ issue, prUrl });
      if (!branchUpToDate) {
        throw new Error(`PR branch could not be brought up to date: ${prUrl}`);
      }

      let checksReadyToMerge = true;
      if (PR_CHECK_REPAIR) {
        checksReadyToMerge = await repairFailedPrChecks({ issue, prUrl });
      } else if (AUTO_MERGE_PRS) {
        const checkResult = await waitForChecks(prUrl);
        checksReadyToMerge =
          checkResult.status === "merged" ||
          (checkResult.status === "completed" && checksArePassing(checkResult.checks));
      }

      if (!checksReadyToMerge) {
        throw new Error(`PR is not ready to merge after repair attempts: ${prUrl}`);
      }

      const autoMergeEnabled = AUTO_MERGE_PRS ? enableAutoMerge(prUrl) : false;
      if (autoMergeEnabled) {
        console.log(`  GitHub auto-merge enabled for ${prUrl}`);
      } else if (AUTO_MERGE_PRS) {
        console.log(`  GitHub auto-merge unavailable; direct merge fallback required: ${prUrl}`);
      } else {
        console.log(`  Auto-merge skipped for ${prUrl} because SANDCASTLE_AUTO_MERGE=false`);
      }

      return {
        autoMergeEnabled,
        issue,
        prUrl,
      };
    }),
  );

  const preparedPrs: Array<{
    autoMergeEnabled: boolean;
    issue: z.infer<typeof planSchema>["issues"][number];
    prUrl: string;
  }> = [];

  for (const result of preparedPrResults) {
    if (result.status === "fulfilled") {
      preparedPrs.push(result.value);
    } else {
      console.warn(`  PR preparation failed: ${String(result.reason)}`);
      process.exitCode = 1;
      stopRun = true;
    }
  }

  if (stopRun) {
    break;
  }

  for (const { autoMergeEnabled, issue, prUrl } of preparedPrs) {
    if (AUTO_MERGE_PRS && !autoMergeEnabled && !prIsMerged(prUrl)) {
      const readyForDirectMerge = await ensurePrBranchUpToDate({ issue, prUrl });
      if (!readyForDirectMerge) {
        console.warn(`  Direct merge fallback is not ready: ${prUrl}`);
        process.exitCode = 1;
        stopRun = true;
        break;
      }
      mergePr(prUrl);
    }
  }

  console.log("\nBranches published as GitHub PRs and handed off for merge.");

  if (stopRun) {
    break;
  }

  if (!WAIT_FOR_MERGES || !AUTO_MERGE_PRS) {
    console.log(
      WAIT_FOR_MERGES
        ? "Merge waiting skipped because SANDCASTLE_AUTO_MERGE=false."
        : "Auto-merge will continue asynchronously. Re-run Sandcastle after merges to plan newly unblocked work.",
    );
    break;
  }

  const allMerged = await waitForPrBatchMerge(preparedPrs);
  if (!allMerged) {
    process.exitCode = 1;
    break;
  }

  refreshBaseBranch();
}

if (process.exitCode && process.exitCode !== 0) {
  console.error("\nSandcastle stopped with errors. See the failures above.");
} else {
  console.log("\nAll done.");
}

function preflightSandbox() {
  const configured = process.env.SANDCASTLE_SANDBOX_CAN_RUN_CONTAINER_TESTS;

  try {
    const detected = execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        SANDBOX_IMAGE_NAME,
        "-c",
        [
          `mkdir -p ${quote(SANDBOX_TURBO_CACHE_DIR)}`,
          `test -w ${quote(SANDBOX_TURBO_CACHE_DIR)} || exit 42`,
          'if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then printf "true"; else printf "false"; fi',
        ].join(" && "),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 },
    );
    if (configured === "true") return true;
    if (configured === "false") return false;
    return detected.trim() === "true";
  } catch (error) {
    throw new Error(
      `Sandbox preflight failed for image ${SANDBOX_IMAGE_NAME}; verify Docker and the sandbox image before running Sandcastle.`,
      { cause: error },
    );
  }
}

function currentBranch() {
  return sh("git branch --show-current").trim();
}

function defaultBranch() {
  return (
    safeSh("gh repo view --json defaultBranchRef --jq .defaultBranchRef.name").trim() ||
    safeSh("git remote show origin | rg 'HEAD branch' | cut -d ':' -f 2").trim() ||
    undefined
  );
}

function refreshBaseBranch() {
  console.log(`Refreshing ${BASE_BRANCH} from origin before continuing...`);
  sh(`git fetch origin ${quote(BASE_BRANCH)}`);

  if (currentBranch() === BASE_BRANCH) {
    try {
      sh(`git pull --ff-only origin ${quote(BASE_BRANCH)}`);
    } catch (error) {
      if (!workingTreeIsClean()) {
        throw error;
      }

      console.warn(
        `  ${BASE_BRANCH} could not fast-forward; resetting clean local base branch to origin/${BASE_BRANCH}.`,
      );
      sh(`git reset --hard ${quote(`origin/${BASE_BRANCH}`)}`);
    }
  }
}

function workingTreeIsClean() {
  return sh("git status --porcelain").trim() === "";
}

function publishIssuePr({
  baseBranch,
  issue,
}: {
  baseBranch: string;
  issue: z.infer<typeof planSchema>["issues"][number];
}) {
  pushIssueBranch(issue.branch);

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
        "Merging is intentionally handled by GitHub so this branch gets normal PR checks and merge history after local pre-publication review.",
        "",
        PRE_PUBLISH_REVIEW_COMPLETE_MARKER,
      ].join("\n"),
    ],
    { encoding: "utf8" },
  ).trim();
}

function findIssuePr(issue: z.infer<typeof planSchema>["issues"][number]) {
  return safeSh(`gh pr view ${quote(issue.branch)} --json url --jq .url`).trim() || undefined;
}

function prePublishReviewIsComplete(prUrl: string) {
  const text = safeSh(
    `gh pr view ${quote(prUrl)} --json body,comments --jq ${quote('[.body, .comments[].body] | join("\\n")')}`,
  );
  return (
    text.includes(PRE_PUBLISH_REVIEW_COMPLETE_MARKER) ||
    text.includes(LEGACY_POST_PR_REVIEW_COMPLETE_MARKER)
  );
}

function markPrePublishReviewComplete(prUrl: string) {
  execFileSync("gh", ["pr", "comment", prUrl, "--body", PRE_PUBLISH_REVIEW_COMPLETE_MARKER], {
    encoding: "utf8",
  });
}

async function recoverMissingPrePublishReview({
  issue,
  prUrl,
}: {
  issue: PlannedIssue;
  prUrl: string;
}) {
  console.log(`  Existing PR has no review marker; running one recovery review: ${prUrl}`);
  const releaseSlot = await acquireSlot();

  try {
    const sandbox = await sandcastle.createSandbox({
      branch: issue.branch,
      sandbox: sandboxProvider(),
      hooks,
      copyToWorktree,
    });

    try {
      const commits = await runPrePublishReviewAndVerify({ issue, sandbox });
      if (commits.length > 0) {
        pushIssueBranch(issue.branch);
      }
    } finally {
      await sandbox.close();
    }

    markPrePublishReviewComplete(prUrl);
  } finally {
    releaseSlot();
  }
}

function pushIssueBranch(branch: string) {
  const cwd = issueBranchWorktreePath(branch) ?? ".";
  const remoteBranchExists = safeSh(
    `git -C ${quote(cwd)} fetch origin ${quote(branch)} && git -C ${quote(cwd)} rev-parse --verify ${quote(`origin/${branch}`)}`,
  ).trim();

  if (remoteBranchExists) {
    sh(`git -C ${quote(cwd)} rebase ${quote(`origin/${branch}`)}`);
  }

  sh(`git -C ${quote(cwd)} push --set-upstream origin ${quote(branch)}`);
}

function issueBranchWorktreePath(branch: string) {
  const path = `.sandcastle/worktrees/${branch.replaceAll("/", "-")}`;
  return existsSync(path) ? path : undefined;
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

async function ensurePrBranchUpToDate({
  issue,
  prUrl,
}: {
  issue: z.infer<typeof planSchema>["issues"][number];
  prUrl: string;
}) {
  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const status = getPrMergeStatus(prUrl);

    if (status.state === "MERGED" || Boolean(status.mergedAt)) {
      return true;
    }

    if (status.mergeStateStatus !== "BEHIND") {
      if (isConflictedPrStatus(status)) {
        console.log(
          `  PR has merge conflicts against ${BASE_BRANCH}; running conflict repair (${attempt}/${MAX_REPAIR_ATTEMPTS}): ${prUrl}`,
        );
        await repairPrConflicts({ issue, prUrl });

        const checkResult = await waitForChecks(prUrl);
        if (checkResult.status === "merged") {
          return true;
        }
        if (checkResult.status !== "completed") {
          return false;
        }

        const failedChecks = checkResult.checks.filter(
          (check) => check.bucket === "fail" || check.conclusion === "failure",
        );

        if (failedChecks.length > 0) {
          console.log(`  Conflict repair introduced failing checks; running check repair agent.`);
          const repaired = await repairFailedPrChecks({ issue, prUrl });
          if (!repaired) {
            return false;
          }
        }

        continue;
      }

      return true;
    }

    console.log(
      `  PR branch is behind ${BASE_BRANCH}; updating branch (${attempt}/${MAX_REPAIR_ATTEMPTS}): ${prUrl}`,
    );
    updatePrBranch(prUrl);

    const checkResult = await waitForChecks(prUrl);
    if (checkResult.status === "merged") {
      return true;
    }
    if (checkResult.status !== "completed") {
      return false;
    }

    const failedChecks = checkResult.checks.filter(
      (check) => check.bucket === "fail" || check.conclusion === "failure",
    );

    if (failedChecks.length > 0) {
      console.log(
        `  Updating from ${BASE_BRANCH} introduced failing checks; running repair agent.`,
      );
      const repaired = await repairFailedPrChecks({ issue, prUrl });
      if (!repaired) {
        return false;
      }
    }
  }

  const finalStatus = getPrMergeStatus(prUrl);
  return finalStatus.mergeStateStatus !== "BEHIND" && !isConflictedPrStatus(finalStatus);
}

function isConflictedPrStatus(status: PrMergeStatus) {
  return status.mergeStateStatus === "DIRTY" || status.mergeable === "CONFLICTING";
}

async function repairPrConflicts({
  issue,
  prUrl,
}: {
  issue: z.infer<typeof planSchema>["issues"][number];
  prUrl: string;
}) {
  const sandbox = await sandcastle.createSandbox({
    branch: issue.branch,
    sandbox: sandboxProvider(),
    hooks,
    copyToWorktree,
  });

  try {
    await sandbox.run({
      name: `pr-conflict-repair-${issue.id}`,
      maxIterations: 30,
      agent: allAroundAgent(),
      promptFile: "./.sandcastle/pr-conflict-repair-prompt.md",
      promptArgs: {
        BASE_BRANCH,
        BRANCH: issue.branch,
        ISSUE_TITLE: issue.title,
        PR_URL: prUrl,
        TASK_ID: issue.id,
        VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
      },
    });
  } finally {
    await sandbox.close();
  }

  pushIssueBranch(issue.branch);
}

function updatePrBranch(prUrl: string) {
  execFileSync("gh", ["pr", "update-branch", prUrl], { encoding: "utf8" });
}

async function waitForPrBatchMerge(prs: Array<{ issue: PlannedIssue; prUrl: string }>) {
  const deadline = Date.now() + MERGE_TIMEOUT_MS;
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount++;
    const pendingPrs = prs.filter(({ prUrl }) => !prIsMerged(prUrl));
    if (pendingPrs.length === 0) {
      console.log(`  All ${prs.length} PR(s) merged through GitHub.`);
      return true;
    }

    console.log(
      `  Batch merge poll ${pollCount}: ${prs.length - pendingPrs.length}/${prs.length} merged; waiting ${CHECK_POLL_INTERVAL_MS / 1000}s...`,
    );

    for (const { issue, prUrl } of pendingPrs) {
      const status = getPrMergeStatus(prUrl);
      if (status.mergeStateStatus !== "BEHIND" && !isConflictedPrStatus(status)) {
        continue;
      }

      const repaired = await ensurePrBranchUpToDate({ issue, prUrl });
      if (!repaired) {
        console.warn(`  PR became blocked while waiting for the batch: ${prUrl}`);
        return false;
      }
      enableAutoMerge(prUrl);
    }

    await sleep(CHECK_POLL_INTERVAL_MS);
  }

  console.warn(`  Timed out waiting for the PR batch to merge.`);
  return false;
}

function getPrMergeStatus(prUrl: string) {
  const json = safeSh(
    `gh pr view ${quote(prUrl)} --json state,mergedAt,mergeStateStatus,mergeable`,
  );
  if (!json.trim()) {
    return {} as PrMergeStatus;
  }
  return JSON.parse(json) as PrMergeStatus;
}

async function repairFailedPrChecks({
  issue,
  prUrl,
}: {
  issue: z.infer<typeof planSchema>["issues"][number];
  prUrl: string;
}) {
  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const status = getPrMergeStatus(prUrl);
    if (isConflictedPrStatus(status)) {
      console.log(
        `  PR has merge conflicts before checks; running conflict repair (${attempt}/${MAX_REPAIR_ATTEMPTS}): ${prUrl}`,
      );
      await repairPrConflicts({ issue, prUrl });
      continue;
    }

    console.log(`  Waiting for PR checks (${attempt}/${MAX_REPAIR_ATTEMPTS}): ${prUrl}`);
    const checkResult = await waitForChecks(prUrl);
    if (checkResult.status === "merged") {
      return true;
    }
    if (checkResult.status === "conflicted") {
      continue;
    }
    if (checkResult.status === "timed-out") {
      return false;
    }

    const failedChecks = checkResult.checks.filter(
      (check) => check.bucket === "fail" || check.conclusion === "failure",
    );

    if (failedChecks.length === 0) {
      console.log(`  PR checks are not failing: ${prUrl}`);
      return checksArePassing(checkResult.checks);
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
          VERIFICATION_POLICY: LOCAL_VERIFICATION_POLICY,
        },
      });
    } finally {
      await sandbox.close();
    }

    pushIssueBranch(issue.branch);
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

    const status = getPrMergeStatus(prUrl);
    if (isConflictedPrStatus(status)) {
      console.log(
        `  PR is conflicted (mergeState=${status.mergeStateStatus ?? "unknown"}, mergeable=${status.mergeable ?? "unknown"}); stopping check polling: ${prUrl}`,
      );
      return { status: "conflicted" } as const;
    }

    if (prIsMerged(prUrl)) {
      console.log(`  PR already merged; stopping check polling: ${prUrl}`);
      return { status: "merged" } as const;
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
      return { checks, status: "completed" } as const;
    }

    await sleep(CHECK_POLL_INTERVAL_MS);
  }

  console.warn(
    `  Timed out waiting for checks; leaving PR for GitHub auto-merge/manual inspection.`,
  );
  return { status: "timed-out" } as const;
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

type PrMergeStatus = {
  mergeable?: string;
  mergeStateStatus?: string;
  mergedAt?: string | null;
  state?: string;
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
