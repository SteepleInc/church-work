# Fractional string keys for Board Order

Tasks need a persisted manual ordering within Board Columns (Board Order), and Convex makes per-write cost matter: a drag should touch one document, not reindex a column. We store a required `boardOrder` string on every Task, generated with the `fractional-indexing` package (`generateKeyBetween` / `generateNKeysBetween`); keys are assigned at creation in the centralized `createTasks` helper (appended to the end of the destination column) and rewritten on drag to slot between the destination neighbors. Since there are no production users yet, the field is required from day one with no nullable fallback or migration.

## Considered Options

- **Integer positions with reindex-on-move** — rejected: O(column) writes per drag, noisy for optimistic updates and the activity log.
- **Float midpoint ranks** — rejected: exhausts precision after ~50 adjacent inserts and needs renormalization; fractional string keys solve the same problem without it.
- **Nullable rank with creation-time fallback** — rejected: only useful to avoid a migration, and with a nukeable DB the two-tier sort logic isn't worth carrying.

## Consequences

- Every task-creation path must flow through `createTasks` (or otherwise assign a key) — `boardOrder` is required by the schema.
- Ordering is a plain string comparison scoped within a column; columns partition by `workflowStatusId`, so one field serves all Boards.
