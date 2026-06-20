import type { KeyDatePreset, KeyDateRule } from "@church-task/domain";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  KEY_DATE_PRESET_OPTIONS,
  keyDateKindLabel,
  type KeyDateScheduleKind,
} from "@/data/templates/keyDatesData.app";
import { cn } from "@/lib/utils";

/** Slugify a Key Date name into a stable, URL-safe key. */
export const slugifyKeyDateKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "key-date";

/** Back-compat alias for `slugifyKeyDateKey`. */
export const slugifyKey = slugifyKeyDateKey;

/** Builds a slug for `name` that doesn't collide with `usedKeys` (ignoring `ignore`). */
export function uniqueKeyDateKey(
  usedKeys: ReadonlySet<string>,
  name: string,
  ignore?: string,
): string {
  const base = slugifyKeyDateKey(name);
  if (!usedKeys.has(base) || base === ignore) return base;
  for (let bump = 2; ; bump += 1) {
    const candidate = `${base}-${bump}`;
    if (!usedKeys.has(candidate) || candidate === ignore) return candidate;
  }
}

const KEY_DATE_KINDS: readonly KeyDateScheduleKind[] = ["computedYearly", "fixedYearly", "oneTime"];

export const defaultScheduleForKind = (kind: KeyDateScheduleKind): KeyDateRule => {
  if (kind === "computedYearly") return { kind: "computedYearly", rule: "easter" };
  if (kind === "fixedYearly") return { day: 25, kind: "fixedYearly", month: 12 };
  return { kind: "oneTime", localDate: new Date().toISOString().slice(0, 10) };
};

/**
 * The schedule authoring control shared by the Key Date quick action and the
 * per-row schedule editor: a kind picker (Preset / Fixed annual / One-off)
 * followed by the inputs for the chosen kind.
 */
export function ScheduleEditor({
  schedule,
  onChange,
}: {
  readonly schedule: KeyDateRule;
  readonly onChange: (schedule: KeyDateRule) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {KEY_DATE_KINDS.map((kind) => (
          <button
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              schedule.kind === kind
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
            key={kind}
            onClick={() => onChange(defaultScheduleForKind(kind))}
            type="button"
          >
            {keyDateKindLabel(kind)}
          </button>
        ))}
      </div>

      {schedule.kind === "computedYearly" ? (
        <PresetPicker
          onChange={(rule) => onChange({ kind: "computedYearly", rule })}
          rule={schedule.rule}
        />
      ) : schedule.kind === "fixedYearly" ? (
        <FixedAnnualPicker
          day={schedule.day}
          month={schedule.month}
          onChange={(month, day) => onChange({ day, kind: "fixedYearly", month })}
        />
      ) : (
        <Input
          aria-label="One-off date"
          className="h-8 w-44"
          onChange={(event) =>
            onChange({
              kind: "oneTime",
              localDate: event.currentTarget.value || schedule.localDate,
            })
          }
          type="date"
          value={schedule.localDate}
        />
      )}
    </div>
  );
}

function PresetPicker({
  rule,
  onChange,
}: {
  readonly rule: KeyDatePreset;
  readonly onChange: (rule: KeyDatePreset) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {KEY_DATE_PRESET_OPTIONS.map((option) => (
        <button
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
            option.rule === rule
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
          key={option.rule}
          onClick={() => onChange(option.rule)}
          type="button"
        >
          <span className="truncate">{option.label}</span>
          {option.rule === rule ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
        </button>
      ))}
    </div>
  );
}

const MONTHS = [
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

const daysInMonth = (month: number) => new Date(Date.UTC(2024, month, 0)).getUTCDate();

function FixedAnnualPicker({
  month,
  day,
  onChange,
}: {
  readonly month: number;
  readonly day: number;
  readonly onChange: (month: number, day: number) => void;
}) {
  const maxDay = daysInMonth(month);
  const clampedDay = Math.min(day, maxDay);

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Month"
        className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(event) => {
          const nextMonth = Number(event.currentTarget.value);
          onChange(nextMonth, Math.min(clampedDay, daysInMonth(nextMonth)));
        }}
        value={month}
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Day"
        className="h-8 w-20 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(event) => onChange(month, Number(event.currentTarget.value))}
        value={clampedDay}
      >
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
