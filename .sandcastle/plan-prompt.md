# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name using the exact format `sandcastle/issue-{id}` (no slug or other suffix). This must be deterministic so that re-planning the same issue always produces the same branch name and accumulated progress is preserved.

Also classify whether the issue needs a dedicated UI phase.

Set `needsUi: true` when the issue includes meaningful user-facing UI design, layout, component composition, interaction polish, or design-language judgment. The UI phase exists because Opus is much better at making Church Task UI beautiful and consistent with the app's design language.

Set `needsUi: false` when the issue is mostly backend, database, auth, Zero, domain logic, infrastructure, tests, or frontend plumbing/data wiring. The all-around builder should own plumbing and data setup. If a feature needs both data plumbing and UI, keep one branch for the issue and set `needsUi: true`; the all-around builder will do the plumbing first, the UI builder will build/polish the UI, and the all-around verify/fixer will make tests and integration pass afterward.

When `needsUi` is true, include a short `uiBrief` telling the UI builder what product surface, interaction, and design-language outcome to focus on. When `needsUi` is false, omit `uiBrief`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Build onboarding team editor", "branch": "sandcastle/issue-42", "needsUi": true, "uiBrief": "Make the Initial Teams editor feel native to Church Task while keeping the flow fast and clear."}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies).

Always emit the `<plan>` tags, even when there is nothing to do. If there are no issues to work on at all, output `<plan>{"issues": []}</plan>` so the run can exit cleanly.
