# TASK

Resolve merge conflicts for issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch `{{BRANCH}}`.

The PR is: {{PR_URL}}
The base branch is: {{BASE_BRANCH}}

# LOCAL VERIFICATION CAPABILITIES

{{VERIFICATION_POLICY}}

# PROCESS

1. Update local refs with `git fetch origin {{BASE_BRANCH}}`.
2. Merge `origin/{{BASE_BRANCH}}` into `{{BRANCH}}`.
3. Resolve conflicts carefully, preserving the issue's intent and the latest base-branch behavior.
4. Run checks targeted to the conflicted files. Run the comprehensive local gate only when the capability policy says it is available.
5. Commit the merge/conflict resolution and return immediately.

# RULES

- Do not force-push.
- Do not bypass checks.
- Keep the PR as the integration surface; do not merge the PR locally.
- If the conflict reveals that this issue is obsolete or unsafe to merge, comment on the PR with the blocker and stop without inventing unrelated work.
- Do not push. The runner syncs and pushes your commit after the sandbox closes.
- Do not poll or wait for GitHub CI. The runner is the only CI poller.
- Do not invoke review skills or launch subagents. Resolve the supplied conflict directly.
- Do not run `bun install` unless the resolution changes dependencies.

Once complete, output <promise>COMPLETE</promise>.
