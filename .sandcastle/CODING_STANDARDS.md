# Coding Standards

The reviewer agent loads this file during Sandcastle review.

## Style

- Use Bun commands in this repo.
- Keep changes small and scoped to the issue.
- Prefer named exports and existing repo patterns.
- Preserve Church Work domain language from `CONTEXT.md`.
- Avoid `any`, unsafe casts, and broad rewrites unless the issue requires them.
- Do not introduce secrets or commit `.env` files.

## Testing

- Builders run targeted verification before committing; the dedicated verify/fixer owns the final local verification pass after modifying reviews.
- Prefer targeted package/app checks while iterating. Run `bun check:e2e` locally only when the sandbox capability policy says container-backed tests are available.
- Add/update targeted Playwright E2E coverage for user-visible workflow changes.
- GitHub CI owns container-backed and full E2E verification when the sandbox cannot run it.

## Sandcastle Workflow

- The local Sandcastle runner completes modifying review and final local verification before the first push, publishes completed issue branches as GitHub PRs, and enables auto-merge by default.
- Do not locally merge multiple Sandcastle branches into the caller's checkout.
- PRs should use `Closes #<issue>` so GitHub closes issues after the PR merge.
- The PR body records that pre-publication review completed. Existing PRs without that marker receive one recovery review before merge.
- If GitHub checks fail, Sandcastle should repair the same PR branch and push follow-up commits rather than opening a replacement PR.
- The runner is the only branch pusher and CI poller; agents commit and return without waiting on GitHub.

## Architecture

- `apps/web` is the TanStack Start frontend app.
- `backend/server` is the Effect API/server package imported by the web app.
- `packages/db`, `packages/auth`, and `packages/zero` own persistence, auth, and sync concerns.
- Follow existing PreachX-style architecture and ADRs.
- Keep UI design aligned with existing Church Work screens and shared primitives.
