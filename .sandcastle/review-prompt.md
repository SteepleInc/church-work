# TASK

Review the code changes for issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch `{{BRANCH}}` before publication, and improve correctness, clarity, consistency, and maintainability while preserving exact functionality.

This is the all-around code reviewer. Focus on repo fit, correctness, tests, safety, and maintainability. UI design quality is reviewed separately for UI branches.

{{VERIFICATION_POLICY}}

# CONTEXT

## Branch diff

Do not load the entire branch diff at once. Start with:

- `git diff --stat {{TARGET_BRANCH}}...{{BRANCH}}`
- `git diff --name-only {{TARGET_BRANCH}}...{{BRANCH}}`

Then inspect focused changed files/hunks with `git diff {{TARGET_BRANCH}}...{{BRANCH}} -- <path>`.

## Commits on this branch

Run `git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`.

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find concerns or improvements:

1. Make the changes directly on this branch.
2. Run the narrowest relevant check only if you changed code. Do not repeat checks already completed at the current commit when no changes are needed.
3. Commit describing the refinements.

If the code is already clean and well-structured, make no commit.

Review directly. Do not invoke the review skill or launch subagents: this is already the dedicated review phase. Do not push the branch, comment on GitHub, wait for CI, or run `bun install`; the runner owns publication.

Once complete, output <promise>COMPLETE</promise>.
