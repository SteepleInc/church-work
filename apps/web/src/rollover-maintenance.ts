import { createDb } from "@church-work/db";
import {
  runScheduledCycleMaintenance,
  type ScheduledCycleMaintenanceResult,
} from "@church-work/server";
import { loggerLayer, traceSpan, withTraceSpan } from "@church-work/tracing";
import { metrics } from "@opentelemetry/api";
import { DateTime, Effect } from "effect";

export type RolloverMaintenanceEnv = {
  readonly HYPERDRIVE: { readonly connectionString: string };
};

type RolloverMaintenanceDependencies = {
  readonly log?: (record: object) => void;
  readonly recordFailedRun?: (attributes: { readonly cron: string }) => void;
  readonly run?: (
    connectionString: string,
    now: DateTime.Utc,
  ) => Promise<ScheduledCycleMaintenanceResult>;
};

const failedRunCounter = metrics
  .getMeter("church-work.worker")
  .createCounter("rollover_maintenance.failed_runs", {
    description: "Rollover Maintenance invocations in which one or more Churches failed",
  });

const runWithHyperdrive = async (connectionString: string, now: DateTime.Utc) => {
  const { db, pool } = createDb(connectionString);
  try {
    return await Effect.runPromise(
      runScheduledCycleMaintenance(db, { now }).pipe(
        withTraceSpan("rollover_maintenance.services", {
          "rollover_maintenance.scheduled_time": DateTime.formatIso(now),
        }),
        Effect.provide(loggerLayer),
      ),
    );
  } finally {
    await pool.end();
  }
};

export const runCloudflareRolloverMaintenance = async (
  controller: Pick<ScheduledController, "cron" | "scheduledTime">,
  env: RolloverMaintenanceEnv,
  dependencies: RolloverMaintenanceDependencies = {},
) => {
  const now = DateTime.makeUnsafe(controller.scheduledTime);
  const log = dependencies.log ?? console.log;
  const recordFailedRun =
    dependencies.recordFailedRun ??
    ((attributes: { readonly cron: string }) => failedRunCounter.add(1, attributes));

  return traceSpan("rollover_maintenance.run", async (span) => {
    span.setAttribute("rollover_maintenance.cron", controller.cron);
    span.setAttribute("rollover_maintenance.scheduled_time", DateTime.formatIso(now));

    try {
      const result = await (dependencies.run ?? runWithHyperdrive)(
        env.HYPERDRIVE.connectionString,
        now,
      );

      span.setAttribute("rollover_maintenance.scanned", result.scanned);
      span.setAttribute("rollover_maintenance.skipped", result.skipped);
      span.setAttribute("rollover_maintenance.succeeded", result.succeeded);
      span.setAttribute("rollover_maintenance.failed", result.failed);
      log({
        cron: controller.cron,
        event: "rollover_maintenance.completed",
        scheduledTime: DateTime.formatIso(now),
        ...result,
      });
      for (const failure of result.failures) {
        log({ event: "rollover_maintenance.church_failed", ...failure });
      }
      if (result.failed > 0) {
        recordFailedRun({ cron: controller.cron });
      }

      return result;
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      span.setAttribute("error.type", error instanceof Error ? error.name : "UnknownError");
      span.setAttribute("error.message", diagnostic);
      log({
        cron: controller.cron,
        error: diagnostic,
        event: "rollover_maintenance.invocation_failed",
        scheduledTime: DateTime.formatIso(now),
      });
      throw error;
    }
  });
};
