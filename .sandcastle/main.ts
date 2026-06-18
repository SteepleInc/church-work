// Parallel Planner with Review — four-phase orchestration loop
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
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
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

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;
const MAX_PARALLEL = 4;

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
        hostPath: "~/.local/share/opencode",
        sandboxPath: "/home/agent/.local/share/opencode",
      },
    ],
  });

// Hooks run inside the sandbox before the agent starts each iteration.
// Bun install ensures the sandbox always has fresh dependencies.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "bun install" }] },
};

// Copy node_modules from the host into the worktree before each sandbox starts.
// Avoids a full Bun install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

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

          if (issue.needsUi && commits.length > 0) {
            const uiReview = await sandbox.run({
              name: `ui-design-reviewer-${issue.id}`,
              maxIterations: 3,
              agent: uiAgent(),
              promptFile: "./.sandcastle/ui-review-prompt.md",
              promptArgs: {
                TASK_ID: issue.id,
                ISSUE_TITLE: issue.title,
                BRANCH: issue.branch,
                UI_BRIEF: issue.uiBrief ?? "Review design quality and UX fit.",
              },
            });
            commits = [...commits, ...uiReview.commits];
          }

          if (commits.length > 0) {
            const review = await sandbox.run({
              name: `all-around-code-reviewer-${issue.id}`,
              maxIterations: 3,
              agent: allAroundAgent(),
              promptFile: "./.sandcastle/review-prompt.md",
              promptArgs: {
                TASK_ID: issue.id,
                ISSUE_TITLE: issue.title,
                BRANCH: issue.branch,
              },
            });

            return {
              ...review,
              commits: [...commits, ...review.commits],
            };
          }

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

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
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
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "merger",
    maxIterations: 1,
    agent: allAroundAgent(),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
