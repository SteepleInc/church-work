# TASK

Fix the failing GitHub PR checks for issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch `{{BRANCH}}`.

The PR is: {{PR_URL}}

# FAILED CHECKS

```json
{{FAILED_CHECKS_JSON}}
```

# PROCESS

1. Inspect the failed checks and their logs/details using `gh`.
2. Reproduce failures locally with the narrowest relevant Bun command.
3. Fix the root cause on this branch.
4. Run targeted verification, then `bun check:e2e` before handing the PR back when practical.
5. Commit the fix and push the branch.

# RULES

- Do not bypass or weaken checks.
- Do not force-push.
- Keep the fix scoped to the failing checks and original issue.
- Preserve the GitHub PR as the integration surface; do not merge locally.

Once complete, output <promise>COMPLETE</promise>.
