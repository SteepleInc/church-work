import {
  addLocalDateDays,
  assertValidTimeZone,
  localMidnightToUtcInstant,
} from "@church-task/domain";
import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { ChurchTaskDb } from "./client";
import { cycles } from "./schema";

type CycleBoundary = {
  readonly id: string;
  readonly church_time_zone: string;
  readonly end_date: string;
  readonly ends_at: Date;
  readonly start_date: string;
  readonly starts_at: Date;
};

type DbTransaction = Parameters<Parameters<ChurchTaskDb["transaction"]>[0]>[0];
type DbExecutor = ChurchTaskDb | DbTransaction;

export type CycleTimeZoneAdjustment = CycleBoundary;

const isInstantInCycle = (instant: Date, cycle: CycleBoundary) =>
  cycle.starts_at.getTime() <= instant.getTime() && instant.getTime() < cycle.ends_at.getTime();

const recalculateCycle = (
  cycle: CycleBoundary,
  newChurchTimeZone: string,
  preserveStartBoundary: boolean,
): CycleTimeZoneAdjustment => ({
  church_time_zone: newChurchTimeZone,
  end_date: addLocalDateDays(cycle.start_date, 6),
  ends_at: localMidnightToUtcInstant(addLocalDateDays(cycle.start_date, 7), newChurchTimeZone),
  id: cycle.id,
  start_date: cycle.start_date,
  starts_at: preserveStartBoundary
    ? cycle.starts_at
    : localMidnightToUtcInstant(cycle.start_date, newChurchTimeZone),
});

const hasBoundaryChange = (cycle: CycleBoundary, adjustment: CycleTimeZoneAdjustment) =>
  cycle.church_time_zone !== adjustment.church_time_zone ||
  cycle.end_date !== adjustment.end_date ||
  cycle.ends_at.getTime() !== adjustment.ends_at.getTime() ||
  cycle.start_date !== adjustment.start_date ||
  cycle.starts_at.getTime() !== adjustment.starts_at.getTime();

export const buildCycleTimeZoneAdjustments = (args: {
  readonly cycles: readonly CycleBoundary[];
  readonly newChurchTimeZone: string;
  readonly now?: Date;
}) => {
  assertValidTimeZone(args.newChurchTimeZone);
  const now = args.now ?? new Date();
  const sortedCycles = [...args.cycles].sort(
    (left, right) => left.starts_at.getTime() - right.starts_at.getTime(),
  );
  const currentCycle = sortedCycles.find((cycle) => isInstantInCycle(now, cycle));
  if (!currentCycle) return [];

  return sortedCycles.flatMap((cycle) => {
    if (cycle.starts_at.getTime() < currentCycle.starts_at.getTime()) return [];

    const adjustment = recalculateCycle(
      cycle,
      args.newChurchTimeZone,
      cycle.id === currentCycle.id,
    );
    return hasBoundaryChange(cycle, adjustment) ? [adjustment] : [];
  });
};

export const adjustChurchCyclesForTimeZone = async (
  db: ChurchTaskDb,
  args: {
    readonly church_id: string;
    readonly newChurchTimeZone: string;
    readonly now?: Date;
    readonly updatedByUserId?: string | null;
  },
) => {
  assertValidTimeZone(args.newChurchTimeZone);

  const [cycleWithOldTimeZone] = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.church_id, args.church_id),
        isNull(cycles.deleted_at),
        ne(cycles.church_time_zone, args.newChurchTimeZone),
      ),
    )
    .limit(1);

  if (!cycleWithOldTimeZone) return { adjustedCycleIds: [] };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${args.church_id}))`);

    return adjustChurchCyclesForTimeZoneInTransaction(tx, args);
  });
};

const adjustChurchCyclesForTimeZoneInTransaction = async (
  db: DbExecutor,
  args: {
    readonly church_id: string;
    readonly newChurchTimeZone: string;
    readonly now?: Date;
    readonly updatedByUserId?: string | null;
  },
) => {
  const updatedAt = args.now ?? new Date();
  const cycleRows = await db
    .select({
      church_time_zone: cycles.church_time_zone,
      end_date: cycles.end_date,
      ends_at: cycles.ends_at,
      id: cycles.id,
      start_date: cycles.start_date,
      starts_at: cycles.starts_at,
    })
    .from(cycles)
    .where(and(eq(cycles.church_id, args.church_id), isNull(cycles.deleted_at)));

  const adjustments = buildCycleTimeZoneAdjustments({
    cycles: cycleRows,
    newChurchTimeZone: args.newChurchTimeZone,
    now: args.now,
  });

  for (const adjustment of adjustments) {
    await db
      .update(cycles)
      .set({
        church_time_zone: adjustment.church_time_zone,
        end_date: adjustment.end_date,
        ends_at: adjustment.ends_at,
        start_date: adjustment.start_date,
        starts_at: adjustment.starts_at,
        updated_at: updatedAt,
        updated_by: args.updatedByUserId ?? null,
      })
      .where(eq(cycles.id, adjustment.id));
  }

  return { adjustedCycleIds: adjustments.map((adjustment) => adjustment.id) };
};
