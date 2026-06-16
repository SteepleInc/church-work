# No Render Gates: Optimistic Shell, Skeletons, and Action Loading only

The app previously blocked rendering behind loading states: full-screen auth/data loaders, route pending components, and scattered text placeholders gated on query loading flags. Render Gates are forbidden: chrome renders immediately, the only spinner permitted is Action Loading on the control that initiated an async action, and absent data is handled by Skeletons or omission. Zero's local replica is the data mechanism for product surfaces.

The concrete rules:

- **Optimistic Shell.** The app shell (sidebar, header, page chrome) renders before auth, Active Church, or product data has fully resolved. Redirects happen after the fact rather than through up-front render gates.
- **Zero for product data.** Core product reads come from Zero queries, not TanStack Start route loaders or server functions that block route rendering.
- **TanStack Start server features are allowed but bounded.** Start loaders/server functions may support public metadata, auth/session helpers, API route mounting, and small framework-local concerns. They are not the primary data path for core app screens.
- **Skeleton tiers.** Loading treatment lives in shared layout primitives, never in page components: (1) Collections render built-in skeleton rows; (2) Details Panes and dialogs skeleton their body shape; (3) small widgets and optional fields are omitted until data arrives. Page-level `isLoading` composition that gates a whole surface is a Render Gate and is forbidden.
- **Empty State suppression.** `loading` flags exist to suppress Empty States ("No results" must never flash while data is syncing), not to show loading UI.

## Considered options

- Keeping full-screen gates but styling them as skeletons — rejected: a politer Render Gate is still a Render Gate.
- Loader-driven app screens in TanStack Start — rejected for core product data because it reintroduces navigation-time waits.
- Dedicated E2E tests for cold-load shell behavior — deferred. The ADR is enforced by code review and focused regression tests when needed.

## Consequences

- The existing UI/design is preserved, but data loading behavior may change to match PreachX-style Zero surfaces.
- App Administration is also Zero-backed, but this ADR does not require dedicated local-first/offline E2E assertions.
- Full offline workflow support is not part of this decision.
