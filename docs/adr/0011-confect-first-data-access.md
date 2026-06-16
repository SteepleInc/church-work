# Postgres, Drizzle, and Zero data access

Church Task's persisted data model is Postgres-first. Drizzle table definitions are the source of truth for persisted row shape, Drizzle migrations are committed, and Zero schema is generated from the Drizzle schema and committed. Confect and Convex are no longer part of the target data-access architecture.

Postgres and Zero data contracts use snake_case names. Drizzle table names, column names, Zero query/mutator args, and Zero row fields are snake_case. App code that consumes Zero data uses those snake_case fields directly; there is no permanent camelCase adapter layer. Snake_case is a data-contract rule, not a rule for local UI state or route search params.

New IDs use `typeid-js` through shared ID factory helpers, following the PreachX `get-ids` pattern. Multi-word TypeID prefixes are concatenated lowercase, such as `orguser`, `workflowstatus`, `templatetask`, and `cycleadjustment`.

Most product tables use a slim base field set:

- `_tag`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `deleted_at`
- `deleted_by`

Generic `status`, `inactivated_at`, and `inactivated_by` fields are not default base fields. Table-specific lifecycle fields are added only when Church Task domain language requires them. Database foreign key constraints are not used by default; relationship cleanup is enforced in Zero mutators, Effect/Drizzle services, and tests. Unique indexes remain important for domain invariants.

Zero is the normal path for product reads and user-facing product writes. Zero query and mutator definitions receive Better Auth session context, following PreachX's Zero endpoint pattern. App Administration is Zero-backed too; App Administrator access is distinguished through session context and query/mutator definitions. Use `useIsAppAdmin`-style helpers in the app so application-level admin is not confused with Church Membership `admin`.

Effect API handlers and Drizzle-backed services handle server-authoritative operations: CLI, MCP, agent operations, scheduled work, webhooks, secretful integrations, and other work that should not be a local-first Zero mutator. Zero mutators and Drizzle services may need parallel implementations; sharing write functions is not a migration prerequisite.

Better Auth uses Postgres/Drizzle. Auth-owned ephemeral tables stay close to Better Auth's expected schema. Church Task copies the PreachX onboarding/session plugin pattern while preserving the current Church Task onboarding semantics.

## Consequences

- The domain package narrows to API contracts, tagged errors, pure domain logic, and constants. Duplicated Effect table-field schemas are removed where Drizzle/Zero now provide the row shape.
- New files use kebab-case filenames and package subpath exports where practical; existing files are not mass-renamed.
- Vitest and Playwright replace Convex-specific test harnesses. E2E uses Testcontainers Postgres, Drizzle migrations, a Zero process pointed at the test DB, the TanStack Start app, and Drizzle seed helpers.
- Production hosting, billing, and observability expansion are separate future decisions.
