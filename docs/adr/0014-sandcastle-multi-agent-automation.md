# Sandcastle multi-agent automation

Church Task uses Sandcastle to run GitHub issue work in isolated branches, then automatically review and merge completed branches back into the current branch. Each issue stays on one deterministic branch (`sandcastle/issue-{id}`) while multiple specialist agents work in sequence on that branch: an all-around builder (`openai/gpt-5.5` via OpenCode with low reasoning, using the host OpenCode config and OpenCode's Codex/OpenAI OAuth auth mounted into the sandbox) handles backend, data, plumbing, and baseline implementation; an Opus UI builder (`anthropic/claude-opus-4-8` via OpenCode, using the host OpenCode Anthropic auth plugin and OAuth auth mounted into the sandbox) runs only when the planner marks `needsUi: true`; the all-around verify/fixer writes or updates targeted tests and fixes integration failures; UI branches receive an Opus design review before the all-around code review; the all-around merge agent merges branches and closes issues.

## Considered Options

- **Single generalist agent for every phase** — rejected: GPT-5.5 is fast and strong for broad implementation, but is not reliable enough for Church Task's UI design-language fit.
- **Opus for every phase** — rejected: Opus is better for UI judgment but a poor default for backend, data, plumbing, and repo-wide repair work.
- **Separate branches for data and UI stages** — rejected: cross-branch handoff would add coordination and merge complexity; one branch per issue lets agents hand off in-place.
- **Human-only merge after agent review** — rejected for the Sandcastle workflow; the desired operating model is autonomous branch production, review, and merge, with CI providing the full E2E gate.

## Consequences

- Issues that include meaningful user-facing UI need a planner-provided `needsUi` flag and `uiBrief`.
- UI agents may touch data wiring when needed to make the interface real, but broad frontend plumbing remains the all-around builder's responsibility.
- User-visible changes should gain targeted Playwright E2E coverage during the verify/fixer phase; CI runs the full E2E suite.
- Sandcastle prompt files are part of the engineering workflow and should be updated as the agent division of labor evolves.
