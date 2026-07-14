# Production Deployment Topology

Issue: [#184](https://github.com/SteepleInc/church-work/issues/184)

## Status

Human decision pending. The local architecture has been proven by #166, so the remaining work is choosing production providers and turning this brief into concrete infrastructure tasks.

This issue is not agent-completable until a human records the selected Postgres provider, Zero host, app host, production region, and operational owner in #184.

## Recommendation To Approve

Use this topology unless a human chooses a different operational tradeoff:

- **Postgres:** managed Postgres with logical replication support, provisioned in the same region as the app and `zero-cache` where possible.
- **Zero:** a dedicated long-running `zero-cache` service, not a serverless function. It must be able to keep a local SQLite replica file and maintain connections to Postgres plus the app's Zero query/mutate endpoints.
- **TanStack Start:** a Node/Bun-compatible server host for the web app and Effect API route. Prefer hosting it close to `zero-cache` and Postgres rather than splitting the first production launch across edge/serverless infrastructure.

The lowest-complexity first production shape is:

- Managed Postgres provider: **Neon or Supabase**, selected by the human owner based on account preference, backups, connection limits, and logical replication configuration.
- `zero-cache`: **Fly.io or Railway long-running service** with persistent storage for the replica file and private networking to the app if available.
- TanStack Start app: **the same long-running platform as `zero-cache` for launch** so `/zero`, `/api/zero/query`, `/api/zero/mutate`, and Better Auth callback URLs can be wired without a cross-platform edge/proxy layer.

Do not choose Vercel/serverless for the first production launch unless the implementation issue also includes a production `/zero` reverse proxy plan and validates that Better Auth, Zero header/cookie forwarding, and TanStack Start server behavior all work there.

## Human Decision Checklist

Record the final choice in #184 before opening infrastructure implementation issues:

- **Postgres provider:** Neon, Supabase, or another managed Postgres provider with logical replication enabled.
- **Primary production region:** the region where Postgres, `zero-cache`, and the app should be colocated.
- **Zero host:** Fly.io, Railway, or another long-running host with persistent storage for the replica file.
- **App host:** same host as `zero-cache`, or a separate Node/Bun-compatible host with a documented `/zero` proxy plan.
- **Public Zero URL shape:** same-origin `/zero` preferred, or a separate origin with explicit CORS and cookie/header-forwarding validation.
- **Migration owner:** the person or system responsible for running Drizzle migrations during deploys.
- **Scheduled-work runner:** platform scheduler, separate worker, or manually triggered command path for launch.

If the chosen app host differs from the `zero-cache` host, the first implementation issue must include reverse-proxy work and a production smoke test for auth cookies plus Zero query/mutate requests through that proxy.

## Required Production Contracts

- Postgres must expose a direct connection string usable by Drizzle migrations, Better Auth, Effect services, and `zero-cache`.
- Postgres must support logical replication for Zero.
- `zero-cache` must run as a persistent process with configured `ZERO_UPSTREAM_DB`, `ZERO_CVR_DB`, `ZERO_CHANGE_DB`, `ZERO_QUERY_URL`, and `ZERO_MUTATE_URL`.
- Browser clients should use a stable public Zero URL, preferably same-origin via `/zero` to avoid extra CORS and cookie-forwarding risk.
- The app server must expose the Zero query and mutate endpoints with Better Auth session context.
- Scheduled work must run through the Effect/Drizzle command path documented in `docs/scheduled-work.md`, either as a platform scheduled job or a separately triggered worker.

## Environment Variables And Secrets

Production infrastructure issues should account for at least:

- `DATABASE_URL` for Drizzle, Better Auth, server operations, scheduled work, and migrations.
- `BETTER_AUTH_SECRET` generated per environment.
- `SITE_URL` and `BETTER_AUTH_URL`/equivalent auth base URL for production callbacks and session cookies.
- `CORS_ORIGIN` if the public app origin and API origin differ.
- `VITE_ZERO_CACHE_URL`, using `/zero` if the production app proxies same-origin traffic to `zero-cache`.
- `ZERO_UPSTREAM_DB`, `ZERO_CVR_DB`, `ZERO_CHANGE_DB`, `ZERO_QUERY_URL`, `ZERO_MUTATE_URL`, `ZERO_APP_ID`, `ZERO_ADMIN_PASSWORD`, and sizing knobs such as `ZERO_UPSTREAM_MAX_CONNS` and `ZERO_NUM_SYNC_WORKERS`.
- Email and integration secrets already modeled in env handling, such as `RESEND_API_KEY`, `CHURCH_INVITATION_EMAIL_FROM`, and `GOOGLE_PLACES_API_KEY` when those features are enabled in production.
- `STRIPE_SECRET_KEY` as a live `sk_live_…` Worker secret, `STRIPE_WEBHOOK_SECRET` from the production Better Auth webhook endpoint, and `STRIPE_PAID_WEEKLY_PRICE_ID` for the sole live Paid Price. Production auth startup rejects missing, test, stub, or malformed values.

### Stripe billing deployment check

Create one active, per-unit, licensed recurring Price in Stripe for **$19.99 USD**, every **one week**, with **inclusive** tax behavior. Add Price metadata `church_work_scope=church`; Better Auth uses the active Organization ID as the Church-scoped subscription reference. Configure Stripe's Customer Portal for payment methods, invoices, cancellation at period end, and subscription resumption. Register the production Better Auth Stripe webhook endpoint and subscribe it to the subscription and invoice events required by `@better-auth/stripe`.

Store the three values above as deployment secrets/configuration, then run this pre-deploy check with production credentials:

```bash
bun stripe:verify-paid-price
```

The command retrieves (but does not mutate) the configured Stripe Price and fails unless all purchasable-price invariants match Church Work's Paid Plan. After deployment, smoke-test Checkout from a Free Church, confirm the return remains pending before webhook synchronization, then test Customer Portal payment recovery and cancellation-at-period-end. Never use the live Stripe account in automated tests; the E2E harness stubs hosted navigation and authoritative state transitions at the application boundary.

## Migration And Runbook Implications

- Drizzle migrations must run before deploying app code that expects new schema.
- Zero generated schema must be committed before deployment and must match the deployed Drizzle schema.
- Production database resets are not part of normal operations. Local reset behavior that deletes the Zero replica does not apply to production.
- If schema changes require a `zero-cache` restart, document that restart in the migration runbook for the release.
- Backups, point-in-time recovery, database branch/preview behavior, and restore drills belong to the Postgres provider decision.
- The first production runbook should include deploy order: migrate database, deploy app server, deploy/restart `zero-cache`, smoke test auth, Zero query, Zero mutator, and scheduled-work command.

## Follow-Up Issues To Create After Human Selection

- Provision production Postgres and document backup/restore settings.
- Add production deployment manifests for the TanStack Start app.
- Add production deployment manifests for `zero-cache`.
- Add a production `/zero` routing/proxy implementation if the app and `zero-cache` are not exposed from the same origin.
- Add migration/deploy runbook documentation with exact commands for the chosen provider.
- Add a production smoke checklist for Better Auth sign-in, onboarding, a Zero-backed read, a Zero-backed write, and scheduled cycle maintenance.

Use this issue template shape for the follow-up implementation tickets:

- **Decision:** the selected provider or topology this issue implements.
- **Acceptance criteria:** deployed resource, required env vars/secrets, documented operational owner, and smoke-test evidence.
- **Blocked by:** #184 and any provider-account access task.
- **Verification:** provider-specific CLI output or deployment URL plus the production smoke checklist item covered by the change.
