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
- Prefer `bun run check-types` and `bun run check` for repo-wide safety.
- Add/update targeted Playwright E2E coverage for user-visible workflow changes.
- CI owns the full E2E suite; Sandcastle branches should run the narrowest relevant E2E script.

## Architecture

- `apps/web` is the TanStack Start frontend app.
- `backend/server` is the Effect API/server package imported by the web app.
- `packages/db`, `packages/auth`, and `packages/zero` own persistence, auth, and sync concerns.
- Follow existing PreachX-style architecture and ADRs.
- Keep UI design aligned with existing Church Task screens and shared primitives.
