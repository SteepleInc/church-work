import { createDb } from "@church-work/db";
import {
  runScheduledCycleMaintenance,
  type ScheduledCycleMaintenanceResult,
} from "@church-work/server";
import { DateTime, Effect } from "effect";

export type RolloverMaintenanceEnv = {
  readonly HYPERDRIVE: { readonly connectionString: string };
};

type RolloverMaintenanceDependencies = {
  readonly log?: (record: object) => void;
  readonly run?: (
    connectionString: string,
    now: DateTime.Utc,
  ) => Promise<ScheduledCycleMaintenanceResult>;
};

const runWithHyperdrive = async (connectionString: string, now: DateTime.Utc) => {
  const { db, pool } = createDb(connectionString);
  try {
    return await Effect.runPromise(runScheduledCycleMaintenance(db, { now }));
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
  const result = await (dependencies.run ?? runWithHyperdrive)(
    env.HYPERDRIVE.connectionString,
    now,
  );
  const log = dependencies.log ?? console.log;

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
    log({ metric: "rollover_maintenance.failed_runs", value: 1 });
  }

  return result;
};
