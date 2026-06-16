# Church Task Database Schema

This package owns the canonical Drizzle/Postgres schema and generated migrations.

Schema conventions for product tables:

- Table names, column names, and TypeScript row fields use `snake_case`.
- IDs are TypeID strings generated through `@church-task/shared/get-ids`; multi-word prefixes are concatenated lowercase, such as `workflowstatus`.
- Soft-deletable product tables use the slim base entity fields from `baseEntityFields`: `_tag`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, and `deleted_by`.
- Do not add generic `status`, `inactivated_at`, or `inactivated_by` fields to base entities.
- Do not add database foreign keys by default. Relationship cleanup is application/service logic.
- Enforce domain invariants with named unique indexes. For soft-deletable tables, prefer partial unique indexes that only apply to live rows, like `demo_items_name_live_idx`.
- UTC instant columns use Drizzle `timestamp with time zone` with `mode: "date"` on the server. Zero/app-facing timestamp values are generated as numeric milliseconds.

Better Auth-owned tables may keep Better Auth-compatible TypeScript field names while still mapping to snake_case Postgres columns. Product tables should not copy that exception.

## Seed And Reset Helpers

`seedDatabase`, `resetSeededData`, and `resetAndSeedDatabase` provide the shared Drizzle seed primitives for local dev scripts and E2E harness code. The current profiles are `empty`, `app`, and `admin`; they use deterministic names, emails, and slugs while generating TypeIDs through `@church-task/shared/get-ids`.

Resets truncate the current migrated tables directly through Drizzle. This keeps local/E2E reset independent from domain service code and lets a running Zero process continue watching the same Postgres database across reset/reseed cycles.
