# TASK

Resolve merge conflicts for issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch `{{BRANCH}}`.

The PR is: {{PR_URL}}
The base branch is: {{BASE_BRANCH}}

# PROCESS

1. Update local refs with `git fetch origin {{BASE_BRANCH}}`.
2. Merge `origin/{{BASE_BRANCH}}` into `{{BRANCH}}`.
3. Resolve conflicts carefully, preserving the issue's intent and the latest base-branch behavior.
4. Run targeted checks, then `bun check:e2e` before handing the PR back when practical.
5. Commit the merge/conflict resolution and push the branch.

# RULES

- Do not force-push.
- Do not bypass checks.
- Keep the PR as the integration surface; do not merge the PR locally.
- If the conflict reveals that this issue is obsolete or unsafe to merge, comment on the PR with the blocker and stop without inventing unrelated work.

Once complete, output <promise>COMPLETE</promise>.
