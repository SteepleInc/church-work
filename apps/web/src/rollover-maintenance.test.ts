import { DateTime } from "effect";
import { describe, expect, test } from "bun:test";

import { runCloudflareRolloverMaintenance } from "./rollover-maintenance";

describe("Cloudflare Rollover Maintenance", () => {
  test("configures the worldwide Monday boundary window and reconciliation run", async () => {
    const wranglerConfig = await Bun.file(new URL("../wrangler.jsonc", import.meta.url)).text();

    expect(wranglerConfig).toContain('"*/15 10-23 * * SUN"');
    expect(wranglerConfig).toContain('"*/15 0-12 * * MON"');
    expect(wranglerConfig).toContain('"15 13 * * MON"');
  });

  test("preserves controlled instants across whole-hour, half-hour, and quarter-hour boundaries", async () => {
    const boundaryInstants = [
      "2026-06-21T10:00:00.000Z", // UTC+14
      "2026-06-22T04:00:00.000Z", // representative whole-hour offset
      "2026-06-22T02:30:00.000Z", // representative half-hour offset
      "2026-06-21T18:15:00.000Z", // representative quarter-hour offset
      "2026-06-22T12:00:00.000Z", // UTC-12
    ];

    for (const instant of boundaryInstants) {
      const scheduledTime = Date.parse(instant);
      await runCloudflareRolloverMaintenance(
        { cron: "*/15 * * * *", scheduledTime },
        { HYPERDRIVE: { connectionString: "postgres://hyperdrive" } },
        {
          log: () => undefined,
          run: async (_connectionString, now) => {
            expect(DateTime.toEpochMillis(now)).toBe(scheduledTime);
            return {
              failed: 0,
              failures: [],
              maintainedChurchIds: [],
              resultsByChurchId: {},
              scanned: 0,
              skipped: 0,
              succeeded: 0,
            };
          },
        },
      );
    }
  });

  test("uses the supplied scheduled instant and emits structured failure outcomes", async () => {
    const logs: object[] = [];
    const scheduledTime = Date.parse("2026-06-22T13:15:00.000Z");

    const result = await runCloudflareRolloverMaintenance(
      { cron: "15 13 * * MON", scheduledTime },
      { HYPERDRIVE: { connectionString: "postgres://hyperdrive" } },
      {
        log: (record) => logs.push(record),
        run: async (connectionString, now) => {
          expect(connectionString).toBe("postgres://hyperdrive");
          expect(DateTime.toEpochMillis(now)).toBe(scheduledTime);
          return {
            failed: 1,
            failures: [{ churchId: "church-failed", error: "database unavailable" }],
            maintainedChurchIds: ["church-succeeded"],
            resultsByChurchId: {},
            scanned: 3,
            skipped: 1,
            succeeded: 1,
          };
        },
      },
    );

    expect(result).toMatchObject({ failed: 1, scanned: 3, skipped: 1, succeeded: 1 });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "rollover_maintenance.completed",
          scheduledTime: "2026-06-22T13:15:00.000Z",
        }),
        {
          churchId: "church-failed",
          error: "database unavailable",
          event: "rollover_maintenance.church_failed",
        },
        { metric: "rollover_maintenance.failed_runs", value: 1 },
      ]),
    );
  });
});
