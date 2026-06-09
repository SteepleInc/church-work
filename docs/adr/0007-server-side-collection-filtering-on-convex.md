# Server-side Collection filtering, sorting, and pagination on Convex

Collections (the ported TanStack Table system) push their URL-synced filter, sort, and pagination state into Convex queries rather than fetching all rows and filtering client-side, mirroring PreachX's `useFilterQuery`/`listQueryHelpers` data flow. A Convex-side engine translates the shared `ListArgs`/`FilterItem` shape into query operations: option/number/date filters and ordering use indexed `ctx.db.query(...)` with cursor pagination via `paginate()`, and free-text "contains" filters use Convex full-text `searchIndex`es added to the relevant local-install tables (e.g. `organization`, `user`).

## Considered Options

- **Client-side filtering/sorting in TanStack Table.** Rejected for this surface: App Administration is cross-tenant and unbounded, so fetching all rows does not scale and diverges from PreachX's server-driven flow.
- **JS substring post-filter instead of search indexes.** Rejected in favor of `searchIndex`es for scalable text search.

## Consequences

- The local-install schema gains `searchIndex` definitions on text columns; another deliberate edit to auth-component-managed tables.
- Convex search indexes return relevance-ranked results and cannot be arbitrarily re-ordered, so **column sorting is disabled while a text search filter is active** — a deliberate, documented divergence from PreachX, where search and sort compose.
- Merge-orgs and other heavy cross-tenant mutations are explicitly out of scope for the initial port.
