# Agent Notes

## Repo Overview

`church-task` is a private Bun + Turborepo TypeScript monorepo. It is migrating from a Convex/Confect backend to a PreachX-style architecture with TanStack Start, Postgres, Drizzle, Zero, Better Auth, Effect, shared UI primitives, and shared config/env packages.

Primary commands from the repo root:

- `bun run build` builds all workspaces.
- `bun run check-types` runs type checks through Turbo.
- `bun run check` runs Oxlint and Oxfmt.

The package manager is Bun (`bun@1.3.13`). Prefer Bun commands for this repo unless a package-specific script clearly requires something else.

## Project Structure

- `apps/web` is the frontend app. It is being migrated in place from Vite + TanStack Router to TanStack Start while preserving the existing UI.
- `backend/server` is the target Effect API/server package imported by the web app, following the PreachX pattern.
- `packages/db`, `packages/auth`, and `packages/zero` are the target Postgres/Better Auth/Zero packages.
- `packages/backend-old` and `packages/domain-old`, once created, are temporary read-only references for the old Convex/Confect implementation.
- `packages/config` contains shared TypeScript/tooling config.
- `packages/env` contains shared environment-variable handling.

## Reference Repositories

`.reference/` is intentionally gitignored and contains local source checkouts for implementation reference only. Do not edit these repositories as part of normal app work unless explicitly asked. Treat them as read-only examples for patterns, APIs, and integration details.

Current contents:

- `.reference/drizzle` is the Drizzle source. Use it when checking Drizzle beta APIs and the Effect integration.
- `.reference/zero` is the Zero source/docs/examples. Use it when checking Zero, drizzle-zero, sync, mutators, and query patterns.
- `.reference/effect-smol` is the Effect v4/effect-smol source. Use it when checking new Effect APIs and migration patterns.
- `.reference/effect` is the old Effect TypeScript library source. Use it only when checking legacy Effect v3 patterns during migration.
- `.reference/better-auth` is the Better Auth source. Use it when checking auth APIs, plugin patterns, adapters, tests, and runtime constraints.
- `.reference/router` is the TanStack Router source. Use it when checking routing APIs, file-route conventions, router internals, and examples.
- `.reference/circle` is a Linear-inspired project management UI by ln-dev7, built with Next.js, TypeScript, shadcn/ui, and Tailwind CSS. Use it as a UI/UX and component-structure reference for issue/project/team tracking interfaces.

Because `.reference/` is ignored, files added or changed there will not appear in this repo's git status.

## Working Notes

- Preserve the existing UI and domain language while following the target architecture decisions in `docs/adr/` and the migration PRD.
- Check existing code before introducing new patterns.
- Keep changes small and run the narrowest useful verification command before finishing.
- Do not commit unless the user explicitly asks.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `SteepleInc/church-task`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout with root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.
