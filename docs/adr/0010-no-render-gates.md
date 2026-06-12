# No Render Gates: Optimistic Shell, Skeletons, and Action Loading only

The app previously blocked rendering behind loading states: two stacked full-screen text loaders in the app shell (`AuthLoading` → "Loading...", then "Loading Church..."), a router `defaultPendingComponent` spinner, and ~25 scattered `"Loading X..."` text placeholders gated on query `.loading` flags. We decided Render Gates are forbidden: chrome renders immediately, the only spinner permitted anywhere is Action Loading (the Button/menu-item overlay spinner for an in-flight user action), and absent data is handled by Skeletons or omission. PreachX is the reference implementation; it gets instant reads from Zero's local replica, which we approximate on Convex with a global query cache.

The concrete rules:

- **Optimistic Shell.** The app shell (sidebar, header, page chrome) renders before auth or Active Church resolves. Routing decisions come from Better Auth session fields (`activeOrganizationId`, `orgCompletedOnboarding` — baked in by session hooks, ADR 0009); redirects happen after the fact via `useAuthGuard` effects, never via up-front gates. A signed-out or mid-onboarding user may briefly see empty chrome before being redirected — accepted.
- **No route loaders.** No `loader`, no async `beforeLoad`, no `pendingComponent` on any route. Sync `beforeLoad` redirects are fine. `autoCodeSplitting` is disabled so a navigation can never await a JS chunk — the route-pending state is unrepresentable by construction. Do not re-enable code splitting to "optimize" the bundle; the single bundle is deliberate.
- **Global query cache.** `ConvexQueryCacheProvider` (convex-helpers) is mounted at the root with default expiration; all queries go through cache-backed hooks (see ADR 0011). Returning to a previously-visited surface renders synchronously from cache, then live-updates. Stale-then-live is the normal, accepted experience on every surface.
- **Skeleton tiers.** Loading treatment lives in shared layout primitives, never in page components: (1) Collections render built-in skeleton rows; (2) Details Panes and dialogs skeleton their body shape; (3) small widgets and optional fields are omitted until data arrives. Page-level `isLoading` composition that gates a whole surface is a Render Gate and is forbidden.
- **Empty State suppression.** `loading` flags exist to suppress Empty States ("No results" must never flash while data is syncing), not to show loading UI.

## Considered options

- Keeping full-screen gates but styling them as skeletons — rejected: a politer Render Gate is still a Render Gate.
- A localStorage hint for Active Church — unnecessary: the session already carries the routing fields.
- Route-loader prefetching with `pendingComponent` skeletons — rejected: keeps async on the navigation path and regresses toward spinners.

## Consequences

- A truly cold load still has one `get-session` round trip; the shell skeletons during it. Enabling Better Auth `session.cookieCache` is an available perf tweak, not a design change.
- Larger initial bundle (no route code splitting) — accepted for an authed SPA of this size.
- Surfaces showing cached data may be momentarily out of date before the live subscription catches up, including App Administration and impersonation views — accepted everywhere.
- `components/loader.tsx` is deleted; nothing should reintroduce a centered page spinner.
