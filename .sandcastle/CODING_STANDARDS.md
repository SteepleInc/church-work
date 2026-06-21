# Coding Standards

The reviewer agent loads this file during Sandcastle review.

## Style

- Use Bun commands in this repo.
- Keep changes small and scoped to the issue.
- Prefer named exports and existing repo patterns.
- Preserve Church Task domain language from `CONTEXT.md`.
- Avoid `any`, unsafe casts, and broad rewrites unless the issue requires them.
- Do not introduce secrets or commit `.env` files.

## Testing

- Run targeted verification before committing.
- Prefer targeted package/app checks while iterating, `bun check` for initial verification, then `bun check:e2e` before work is considered CI-ready.
- Add/update targeted Playwright E2E coverage for user-visible workflow changes.
- CI owns the full E2E suite; Sandcastle branches should run the narrowest relevant E2E script.

## Sandcastle Workflow

- The local Sandcastle runner publishes completed issue branches as GitHub PRs, runs the final review cycle on the open PR branch, and enables auto-merge by default.
- Do not locally merge multiple Sandcastle branches into the caller's checkout.
- PRs should use `Closes #<issue>` so GitHub closes issues after the PR merge.
- Post-PR review agents should comment on the PR with concerns before pushing follow-up fixes, even when they fix the concern themselves.
- If GitHub checks fail, Sandcastle should repair the same PR branch and push follow-up commits rather than opening a replacement PR.
- Leave review feedback and follow-up context on the PR whenever possible; GitHub is the integration and merge record.

## Architecture

- `apps/web` is the TanStack Start frontend app.
- `backend/server` is the Effect API/server package imported by the web app.
- `packages/db`, `packages/auth`, and `packages/zero` own persistence, auth, and sync concerns.
- Follow existing PreachX-style architecture and ADRs.
- Keep UI design aligned with existing Church Task screens and shared primitives.
