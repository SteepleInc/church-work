# Initial application architecture

Church Task uses a Bun + Turborepo monorepo with a TanStack Start React app, Postgres as the source-of-truth database, Drizzle as the database schema/query layer, Zero for synced product data, Better Auth on Postgres for authentication, and Effect v4 for typed server/API composition. The architecture follows the PreachX shape: reusable libraries live under `packages/*`, server runtime code lives under `backend/*`, and the web app imports the Effect server API through a TanStack Start `/api/$` route.

The target workspace packages are:

- `apps/web`: TanStack Start app, preserving the existing Church Task UI while replacing Convex data access with Zero and server API calls.
- `packages/db`: Drizzle schema, migrations, seed helpers, and database utilities.
- `packages/auth`: Better Auth configuration, client helpers, and custom auth plugins following the PreachX onboarding/session pattern.
- `packages/zero`: Zero schema generation, queries, mutators, and list-query helpers.
- `packages/domain`: Effect API contracts, tagged errors, pure domain logic, and shared constants that are not merely duplicated row schemas.
- `packages/shared`: cross-cutting helpers such as TypeID factories.
- `backend/server`: Effect API implementation imported by `apps/web` for `/api/$`.
- a test harness package for Vitest, Playwright, Testcontainers, local Postgres, Zero, and seed lifecycle helpers.

The existing Convex/Confect-era packages will be moved aside as temporary source references, such as `@church-task/backend-old` and `@church-task/domain-old`. New code must not import old packages; they exist only to preserve behavior while the new stack is ported. They are excluded from required checks during the migration and deleted in the final cleanup.

Convex, Confect, and starter billing integrations are not part of the target architecture. There is no Convex data migration because there are no production users or data to preserve. Current Church Task domain language remains stable; this is a persistence/runtime migration, not a domain-model rewrite.

Production deployment topology, billing, and observability expansion are out of scope for the architecture reset. Local development and CI must support the new stack, including local Postgres, Zero, Drizzle migrations, and E2E tests.
