# Zero-backed Collection filtering, sorting, and pagination

Collections push their URL-synced filter, sort, and pagination state into Zero queries rather than fetching unbounded data and filtering in React components. The shared list-query helper pattern is copied from PreachX and adapted to Church Task's snake_case Postgres/Zero data contract.

The helper layer lives in `packages/zero` and translates Collection list args into Zero query operations. Product Collections and App Administration Collections both use Zero-backed query shapes. UI sorting and filtering, including timestamp sorting, happen against Zero data.

Text search uses the PreachX-style `ILIKE` pattern. Full-text search, trigram indexes, vector search, and a separate search service are out of scope for the migration.

## Considered Options

- **Client-side filtering/sorting in TanStack Table.** Rejected for core Collections because it does not scale and hides access-control mistakes.
- **Convex search indexes.** Obsolete because Convex is no longer part of the target architecture.
- **Full-text search from the start.** Deferred. `ILIKE` search is sufficient for the migration and keeps search and sort composition close to PreachX.

## Consequences

- New Collection helpers use snake_case field names because Postgres and Zero data contracts are snake_case.
- App Administration is Zero-backed and must distinguish normal Church-scoped access from App Administrator access through query/mutator context.
- E2E tests cover user-visible Collection behavior and access boundaries, not every helper branch.
