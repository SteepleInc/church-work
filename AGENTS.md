# Agent Notes

## Repo Overview

`church-task` is a private Bun + Turborepo TypeScript monorepo generated from Better-T-Stack. It contains a React web app, a Convex backend, shared UI primitives, and shared config/env packages.

Primary commands from the repo root:

- `bun run build` builds all workspaces.
- `bun run check-types` runs type checks through Turbo.
- `bun run check` runs Oxlint and Oxfmt.

The package manager is Bun (`bun@1.3.13`). Prefer Bun commands for this repo unless a package-specific script clearly requires something else.

## Project Structure

- `apps/web` is the frontend app. It uses Vite, React 19, TanStack Router, Tailwind CSS, Better Auth, Convex, and workspace packages.
- `packages/backend` contains Convex backend functions, schema, auth/payment integration code, and Convex dev/setup scripts.
- `packages/config` contains shared TypeScript/tooling config.
- `packages/env` contains shared environment-variable handling.

## Reference Repositories

`.reference/` is intentionally gitignored and contains local source checkouts for implementation reference only. Do not edit these repositories as part of normal app work unless explicitly asked. Treat them as read-only examples for patterns, APIs, and integration details.

Current contents:

- `.reference/confect` is a TypeScript monorepo around Effect + Convex integration, including core/server/js/react packages, docs, and an example app.
- `.reference/effect` is the Effect TypeScript library source. Use it when checking Effect patterns, types, and implementation details.
- `.reference/better-auth` is the Better Auth source. Use it when checking auth APIs, plugin patterns, adapters, tests, and runtime constraints.
- `.reference/convex-backend` is Convex's backend source. It is primarily Rust with many npm packages, demos, and tests under `npm-packages/`.
- `.reference/router` is the TanStack Router source. Use it when checking routing APIs, file-route conventions, router internals, and examples.
- `.reference/circle` is a Linear-inspired project management UI by ln-dev7, built with Next.js, TypeScript, shadcn/ui, and Tailwind CSS. Use it as a UI/UX and component-structure reference for issue/project/team tracking interfaces.

Because `.reference/` is ignored, files added or changed there will not appear in this repo's git status.

## Working Notes

- Preserve the existing stack and workspace boundaries: app-specific code in `apps/web`, backend code in `packages/backend`, reusable UI in `packages/ui`.
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
