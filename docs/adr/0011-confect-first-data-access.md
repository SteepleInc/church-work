# Confect-first data access through a local cache-backed useQuery

App data access standardizes on Confect (Effect-schema'd function refs + `QueryResult`) rather than raw `convex/react` hooks: typed errors, schema-decoded returns, and `Option`/`QueryResult` modeling fit the codebase's Effect-first style. However, `@confect/react`'s `useQuery` hard-codes `convex/react`'s `useQuery` with no injection point, which would silently bypass the global query cache required by ADR 0010. So the app maintains its own `useQuery`: a ~30-line drop-in built from Confect's public primitives (`Ref.getFunctionReference`, `Ref.encodeArgsSync`, `Ref.decodeReturnsSync`, `Ref.decodeErrorSync`, `QueryResult`) on top of `useQuery` from `convex-helpers/react/cache`. It is the only sanctioned query hook in `apps/web`; pagination uses the cache's `usePaginatedQuery` directly since Confect has no paginated hook.

## Consequences

- Importing `useQuery` from `convex/react` or `@confect/react` in app code is forbidden (enforced by lint import restrictions) — either import bypasses the cache.
- The wrapper depends only on stable public Confect APIs, not internals; Confect upgrades should be low-risk. An upstream PR making Confect's hook implementation pluggable would let us delete the wrapper.
- New backend functions should be written Confect-first so the app can consume them through typed refs; plain Convex refs remain consumable through the same wrapper (arg encoding is identity for them).
