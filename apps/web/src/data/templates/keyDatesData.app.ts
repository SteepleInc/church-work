import {
  calculateKeyDateOccurrence,
  KEY_DATE_PRESETS,
  type KeyDatePreset,
  type KeyDateRule,
} from "@church-task/domain";
import { mutators, queries } from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useCallback } from "react";

export type KeyDateItem = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly schedule: KeyDateRule;
  /** Next upcoming occurrence as a local `YYYY-MM-DD` string, or null. */
  readonly nextOccurrence: string | null;
};

type KeyDateMutationResult = Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: { readonly message: string } }
>;

type ZeroMutationResult = {
  readonly server: Promise<
    | { readonly type: "success" }
    | { readonly type: "error"; readonly error: { readonly message: string } }
  >;
};

const keyDatePresets = new Set<unknown>(KEY_DATE_PRESETS);

const isKeyDatePreset = (value: unknown): value is KeyDatePreset => keyDatePresets.has(value);

const isValidLocalDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isKeyDateRule = (value: unknown): value is KeyDateRule => {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;

  if (value.kind === "computedYearly") {
    return "rule" in value && isKeyDatePreset(value.rule);
  }

  if (value.kind === "fixedYearly") {
    const month = "month" in value ? value.month : null;
    const day = "day" in value ? value.day : null;
    return (
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      typeof month === "number" &&
      typeof day === "number" &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    );
  }

  return value.kind === "oneTime" && "localDate" in value && isValidLocalDate(value.localDate);
};

const parseSchedule = (value: string): KeyDateRule | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isKeyDateRule(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const nextOccurrenceForSchedule = (schedule: KeyDateRule, today = new Date()) => {
  const year = today.getUTCFullYear();
  const todayLocalDate = today.toISOString().slice(0, 10);
  for (const candidateYear of [year, year + 1]) {
    const occurrence = calculateKeyDateOccurrence(schedule, candidateYear);
    if (occurrence && occurrence >= todayLocalDate) return occurrence;
  }
  return null;
};

const mutationResult = async (run: () => ZeroMutationResult): KeyDateMutationResult => {
  try {
    const result = await run().server;
    if (result.type === "error") {
      return { error: { message: result.error.message }, ok: false };
    }
    return { ok: true };
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Could not update Key Dates." },
      ok: false,
    };
  }
};

export function useKeyDatesCollection(params: { readonly churchId: string | null }) {
  const [rows, result] = useQuery(
    queries.key_dates.by_church({ church_id: params.churchId ?? "__no_church__" }),
  );
  const collection =
    params.churchId === null
      ? []
      : rows.flatMap((row) => {
          const schedule = parseSchedule(row.schedule);
          if (!schedule) return [];
          return {
            id: row.id,
            key: row.key,
            name: row.name,
            nextOccurrence: nextOccurrenceForSchedule(schedule),
            schedule,
          };
        });

  return {
    collection,
    keyDatesCollection: collection,
    loading: params.churchId !== null && result.type !== "complete",
  };
}

export function useCreateKeyDate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly key: string;
      readonly name: string;
      readonly schedule: KeyDateRule;
    }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.key_dates.create({
            church_id: params.churchId,
            key: params.key,
            name: params.name,
            schedule: params.schedule,
          }),
        ),
      ),
    [zero],
  );
}

export function useUpdateKeyDate() {
  const zero = useZero();
  return useCallback(
    (params: {
      readonly churchId: string;
      readonly keyDateId: string;
      readonly key: string;
      readonly name: string;
      readonly schedule: KeyDateRule;
    }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.key_dates.update({
            church_id: params.churchId,
            key: params.key,
            key_date_id: params.keyDateId,
            name: params.name,
            schedule: params.schedule,
          }),
        ),
      ),
    [zero],
  );
}

export function useDeleteKeyDate() {
  const zero = useZero();
  return useCallback(
    (params: { readonly churchId: string; readonly keyDateId: string }) =>
      mutationResult(() =>
        zero.mutate(
          mutators.key_dates.delete({ church_id: params.churchId, key_date_id: params.keyDateId }),
        ),
      ),
    [zero],
  );
}

/** The three authoring shapes a Key Date schedule can take, in UI order. */
export type KeyDateScheduleKind = KeyDateRule["kind"];

export const KEY_DATE_PRESET_LABELS: Record<KeyDatePreset, string> = {
  ash_wednesday: "Ash Wednesday",
  easter: "Easter",
  fathers_day: "Father's Day",
  good_friday: "Good Friday",
  mothers_day: "Mother's Day",
  palm_sunday: "Palm Sunday",
  pentecost: "Pentecost",
  thanksgiving: "Thanksgiving",
};

export const KEY_DATE_PRESET_OPTIONS = KEY_DATE_PRESETS.map((rule) => ({
  label: KEY_DATE_PRESET_LABELS[rule],
  rule,
}));

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** A short, human-readable summary of how a Key Date is scheduled. */
export const describeKeyDateSchedule = (schedule: KeyDateRule): string => {
  if (schedule.kind === "computedYearly") {
    return `${KEY_DATE_PRESET_LABELS[schedule.rule]} · every year`;
  }
  if (schedule.kind === "fixedYearly") {
    const month = MONTH_NAMES[schedule.month - 1] ?? "";
    return `${month} ${schedule.day} · every year`;
  }
  return "One-off date";
};

/** The label for a Key Date schedule kind, used in pickers and pills. */
export const keyDateKindLabel = (kind: KeyDateScheduleKind): string => {
  switch (kind) {
    case "computedYearly":
      return "Preset";
    case "fixedYearly":
      return "Fixed annual";
    case "oneTime":
      return "One-off";
  }
};

/** Formats a local `YYYY-MM-DD` occurrence into a friendly date label. */
export const formatKeyDateOccurrence = (localDate: string | null): string => {
  if (!localDate) return "—";
  const parsed = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
};
