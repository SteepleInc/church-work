# Scheduled Work

Scheduled/background work runs in the Effect/Drizzle server package, not from browser traffic.

## Cycle Maintenance

The migrated equivalent of the old `Sunday Cycle maintenance` cron (`0 8 * * 0`) is:

```sh
DATABASE_URL=postgres://... bun run scheduled:cycle-maintenance
```

It calls `runScheduledCycleMaintenance` from `@church-work/server`, which:

- Ensures the current Cycle and next two weekly Cycles for each Church.
- Rolls unfinished Tasks from closed Cycles into the following Cycle.
- Projects Template Tasks into ensured Cycles.
- Records system Activity rows for created Cycles, rolled Tasks, and projected Template Tasks.

Production runs from the existing Cloudflare web Worker every 15 minutes from Sunday 10:00 UTC through Monday 12:00 UTC, with a final Monday 13:15 UTC reconciliation run.

To invoke the Cloudflare scheduled handler locally against the Hyperdrive local connection string:

```sh
cd apps/web
bun run wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*/15+10-23+*+*+SUN"
```

The root command remains useful for directly exercising the Effect service without the Worker runtime.

## Historical Scheduled/Background Inventory

- Old-stack `Sunday Cycle maintenance` called `internal.cycleMaintenance.internalRunForAllChurches`. This is ported to `runScheduledCycleMaintenance` in `@church-work/server`.
- Old starter Polar/billing background work was obsolete rather than ported because billing is outside the current architecture.
- Other old internal mutations were invoked by product, onboarding, or agent operations rather than registered background schedules. Those paths were handled by the feature-specific migration issues.
