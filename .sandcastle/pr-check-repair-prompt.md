# TASK

Fix the failing GitHub PR checks for issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch `{{BRANCH}}`.

The PR is: {{PR_URL}}

# FAILED CHECKS

```json
{{FAILED_CHECKS_JSON}}
```

# LOCAL VERIFICATION CAPABILITIES

{{VERIFICATION_POLICY}}

# PROCESS

1. Inspect the failed checks and their logs/details using `gh`.
2. Reproduce failures locally with the narrowest relevant Bun command.
3. Fix the root cause on this branch.
4. Run only the narrowest verification that reproduces the failed check. Do not run the full gate unless the failed check itself requires it and the capability policy says it is available.
5. Commit the fix and return immediately.

# RULES

- Do not bypass or weaken checks.
- Do not force-push.
- Keep the fix scoped to the failing checks and original issue.
- Preserve the GitHub PR as the integration surface; do not merge locally.
- Do not push. The runner syncs and pushes your commit after the sandbox closes.
- Do not poll or wait for the new GitHub CI run. The runner is the only CI poller.
- Do not invoke review skills or launch subagents. Diagnose the supplied failure directly.
- Do not run `bun install` unless the repair changes dependencies.

Once complete, output <promise>COMPLETE</promise>.
