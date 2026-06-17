# Initial application architecture

Church Task uses a Bun + Turborepo monorepo with a TanStack Start React app, Postgres as the source-of-truth database, Drizzle as the database schema/query layer, Zero for synced product data, Better Auth on Postgres for authentication, and Effect v4 for typed server/API composition. The architecture follows the PreachX shape: reusable libraries live under `packages/*`, server runtime code lives under `backend/*`, and the web app imports the Effect server API through a TanStack Start `/api/$` route.

The target workspace packages are:

- `apps/web`: TanStack Start app, preserving the existing Church Task UI while using Zero for product data and server API calls for bounded server concerns.
- `packages/db`: Drizzle schema, migrations, seed helpers, and database utilities.
- `packages/auth`: Better Auth configuration, client helpers, and custom auth plugins following the PreachX onboarding/session pattern.
- `packages/zero`: Zero schema generation, queries, mutators, and list-query helpers.
- `packages/domain`: Effect API contracts, tagged errors, pure domain logic, and shared constants that are not merely duplicated row schemas.
- `packages/shared`: cross-cutting helpers such as TypeID factories.
- `backend/server`: Effect API implementation imported by `apps/web` for `/api/$`.
- a test harness package for Vitest, Playwright, Testcontainers, local Postgres, Zero, and seed lifecycle helpers.

The old-stack packages were temporary source references during the migration and are no longer part of the workspace. New code must use the Postgres/Drizzle/Zero/Better Auth/Effect packages above.

Old-stack persistence/runtime packages and starter billing integrations are not part of the architecture. There is no data migration because there were no production users or data to preserve. Current Church Task domain language remains stable; this was a persistence/runtime migration, not a domain-model rewrite.

Production deployment topology, billing, and observability expansion are out of scope for the architecture reset. Local development and CI must support the new stack, including local Postgres, Zero, Drizzle migrations, and E2E tests.
