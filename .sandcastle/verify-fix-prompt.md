# TASK

Verify and fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Work on branch {{BRANCH}}.

NEEDS_UI: {{NEEDS_UI}}

# ROLE

You are the all-around verify/fixer. Your job is to make the branch actually work.

Own tests and test data, type errors, lint/format issues, integration bugs, and targeted E2E coverage for user-visible workflows.

# LOCAL VERIFICATION CAPABILITIES

{{VERIFICATION_POLICY}}

# RUNNER GATE CONTEXT

{{GATE_CONTEXT}}

# REQUIRED PROCESS

1. Understand the branch diff by running targeted commands yourself. Start with:
   - `git diff --stat {{TARGET_BRANCH}}...{{BRANCH}}`
   - `git diff --name-only {{TARGET_BRANCH}}...{{BRANCH}}`
   - Then inspect only the relevant changed files/hunks with focused `git diff {{TARGET_BRANCH}}...{{BRANCH}} -- <path>` commands.

   Do not dump the full branch diff into context for large branches.

2. Run targeted verification while iterating. Run the comprehensive local gate when the capability policy above says it is available. If it fails, fix every failure and rerun it until it passes. Do not stop after fixing only the first formatting, type, unit, integration, or E2E failure.

3. If the branch changes a user-visible browser workflow, add or update the narrowest useful Playwright E2E coverage. Then run the matching targeted E2E script when possible:
   - `bun run test:e2e:onboarding`
   - `bun run test:e2e:labels`
   - `bun run test:e2e:tasks-boards`
   - `bun run test:e2e:teams-workflows`
   - `bun run test:e2e:invitations`

   If existing E2E coverage already covers the changed workflow, say so in your final output. Do not attempt browser or container-backed tests when the capability policy says they are unavailable.

4. Fix failures and add missing coverage. Keep fixes scoped to this issue.

Do not invoke review skills or launch review subagents. Dedicated modifying reviews already ran; this is the final local verification phase. Do not push the branch or wait for GitHub checks; the runner owns publication and CI polling. Do not run `bun install` unless you changed dependencies.

# COMMIT

If you make changes, commit them with a concise `SANDCASTLE:` commit message explaining verification and fixes.

Once complete, output <promise>COMPLETE</promise>.
