# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

This is the all-around builder phase.

- Own backend, database, auth, Zero, domain, infrastructure, frontend plumbing, data wiring, mutations, and baseline implementation.
- Use fast, pragmatic reasoning. Prefer small correct changes over speculative architecture.
- If `NEEDS_UI` is true, prepare the data/API/component seams needed for a great UI, but do not spend time on high-polish visual design. A dedicated Opus UI builder runs after you.
- If `NEEDS_UI` is false, complete the full implementation yourself.

NEEDS_UI: {{NEEDS_UI}}
UI_BRIEF: {{UI_BRIEF}}

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run the narrowest useful Bun checks. Prefer targeted tests relevant to the changed package or app, then `bun check` for initial verification when practical.

Do not run the full E2E suite here unless the issue specifically requires it; the verify/fixer phase owns final E2E verification.

# COMMIT

Make a git commit. The commit message must:

1. Start with `SANDCASTLE:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
