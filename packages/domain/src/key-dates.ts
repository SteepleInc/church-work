import { addLocalDateDays, parseLocalDate } from "./template-projection";

export const KEY_DATE_PRESETS = [
  "easter",
  "pentecost",
  "ash_wednesday",
  "good_friday",
  "palm_sunday",
  "mothers_day",
  "fathers_day",
  "thanksgiving",
] as const;

export type KeyDatePreset = (typeof KEY_DATE_PRESETS)[number];

export type KeyDateRule =
  | { readonly kind: "fixedYearly"; readonly month: number; readonly day: number }
  | { readonly kind: "computedYearly"; readonly rule: KeyDatePreset }
  | { readonly kind: "oneTime"; readonly localDate: string };

const pad = (value: number) => value.toString().padStart(2, "0");
const localDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, occurrence: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (occurrence - 1) * 7;
  return localDate(year, month, day);
};

export const calculateEasterDate = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return localDate(year, month, day);
};

export const calculateKeyDateOccurrence = (schedule: KeyDateRule, year: number) => {
  if (schedule.kind === "oneTime") {
    return parseLocalDate(schedule.localDate).year === year ? schedule.localDate : null;
  }
  if (schedule.kind === "fixedYearly") return localDate(year, schedule.month, schedule.day);

  const easter = calculateEasterDate(year);
  switch (schedule.rule) {
    case "easter":
      return easter;
    case "palm_sunday":
      return addLocalDateDays(easter, -7);
    case "good_friday":
      return addLocalDateDays(easter, -2);
    case "ash_wednesday":
      return addLocalDateDays(easter, -46);
    case "pentecost":
      return addLocalDateDays(easter, 49);
    case "mothers_day":
      return nthWeekdayOfMonth(year, 5, 0, 2);
    case "fathers_day":
      return nthWeekdayOfMonth(year, 6, 0, 3);
    case "thanksgiving":
      return nthWeekdayOfMonth(year, 11, 4, 4);
  }
};

export const STARTER_KEY_DATES = [
  { key: "easter", name: "Easter", schedule: { kind: "computedYearly", rule: "easter" } },
  {
    key: "good-friday",
    name: "Good Friday",
    schedule: { kind: "computedYearly", rule: "good_friday" },
  },
  {
    key: "palm-sunday",
    name: "Palm Sunday",
    schedule: { kind: "computedYearly", rule: "palm_sunday" },
  },
  {
    key: "ash-wednesday",
    name: "Ash Wednesday",
    schedule: { kind: "computedYearly", rule: "ash_wednesday" },
  },
  { key: "pentecost", name: "Pentecost", schedule: { kind: "computedYearly", rule: "pentecost" } },
  {
    key: "mothers-day",
    name: "Mother's Day",
    schedule: { kind: "computedYearly", rule: "mothers_day" },
  },
  {
    key: "fathers-day",
    name: "Father's Day",
    schedule: { kind: "computedYearly", rule: "fathers_day" },
  },
  {
    key: "thanksgiving",
    name: "Thanksgiving",
    schedule: { kind: "computedYearly", rule: "thanksgiving" },
  },
  { key: "christmas", name: "Christmas", schedule: { kind: "fixedYearly", month: 12, day: 25 } },
] as const satisfies readonly { key: string; name: string; schedule: KeyDateRule }[];
