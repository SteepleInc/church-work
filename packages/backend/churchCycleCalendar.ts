import { isValidChurchTimeZone } from "./churchTimeZone";

export type CycleStatus = "past" | "current" | "future";

export type CycleCalendarFields = {
  /** Church-local Monday that identifies the Cycle. */
  readonly startDate: string;
  /** Church-local Sunday displayed as the Cycle's final calendar date. */
  readonly endDate: string;
  /** UTC instant for the inclusive start boundary of the local Cycle. */
  readonly startsAt: string;
  /** UTC instant for the exclusive end boundary immediately after local Sunday. */
  readonly endsAt: string;
  readonly churchTimeZone: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const localDateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const localDateTimeFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

function assertValidTimeZone(churchTimeZone: string) {
  if (!isValidChurchTimeZone(churchTimeZone)) {
    throw new Error("Church Time Zone must be a valid IANA time zone.");
  }
}

function assertValidLocalDate(localDate: string) {
  if (!isoDatePattern.test(localDate)) {
    throw new Error("Local date must use YYYY-MM-DD format.");
  }

  const [year, month, day] = parseLocalDate(localDate);
  const asUtcDate = new Date(Date.UTC(year, month - 1, day));
  if (formatUtcDate(asUtcDate) !== localDate) {
    throw new Error("Local date must be a real calendar date.");
  }
}

function parseLocalDate(localDate: string) {
  return localDate.split("-").map(Number) as [number, number, number];
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(localDate: string, days: number) {
  const [year, month, day] = parseLocalDate(localDate);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatUtcDate(date);
}

function localDateDayOfWeek(localDate: string) {
  const [year, month, day] = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getLocalDateFormatter(churchTimeZone: string) {
  const existing = localDateFormatterByTimeZone.get(churchTimeZone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: churchTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  localDateFormatterByTimeZone.set(churchTimeZone, formatter);
  return formatter;
}

function getLocalDateTimeFormatter(churchTimeZone: string) {
  const existing = localDateTimeFormatterByTimeZone.get(churchTimeZone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: churchTimeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  localDateTimeFormatterByTimeZone.set(churchTimeZone, formatter);
  return formatter;
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]) {
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  ) as Record<string, string>;
}

function instantToLocalDate(instant: Date, churchTimeZone: string) {
  const parts = partsToRecord(getLocalDateFormatter(churchTimeZone).formatToParts(instant));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localMidnightToUtcInstant(localDate: string, churchTimeZone: string) {
  const [year, month, day] = parseLocalDate(localDate);
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidateUtc = desiredLocalAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsToRecord(
      getLocalDateTimeFormatter(churchTimeZone).formatToParts(new Date(candidateUtc)),
    );
    const candidateLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const delta = candidateLocalAsUtc - desiredLocalAsUtc;

    if (delta === 0) {
      return new Date(candidateUtc);
    }

    candidateUtc -= delta;
  }

  return new Date(candidateUtc);
}

export function cycleStartDateForLocalDate(localDate: string) {
  assertValidLocalDate(localDate);

  const dayOfWeek = localDateDayOfWeek(localDate);
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(localDate, -daysSinceMonday);
}

export function localDateForInstant(args: {
  readonly instant: string | Date;
  readonly churchTimeZone: string;
}) {
  assertValidTimeZone(args.churchTimeZone);
  const instant = typeof args.instant === "string" ? new Date(args.instant) : args.instant;

  if (Number.isNaN(instant.getTime())) {
    throw new Error("Instant must be a valid ISO date-time.");
  }

  return instantToLocalDate(instant, args.churchTimeZone);
}

export function buildCycleForLocalDate(args: {
  readonly localDate: string;
  readonly churchTimeZone: string;
}): CycleCalendarFields {
  assertValidTimeZone(args.churchTimeZone);

  const startDate = cycleStartDateForLocalDate(args.localDate);
  const endDate = addDays(startDate, 6);
  const startsAt = localMidnightToUtcInstant(startDate, args.churchTimeZone);
  const endsAt = localMidnightToUtcInstant(addDays(startDate, 7), args.churchTimeZone);

  return {
    startDate,
    endDate,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    churchTimeZone: args.churchTimeZone,
  };
}

export function buildCycleForInstant(args: {
  readonly instant: string | Date;
  readonly churchTimeZone: string;
}) {
  return buildCycleForLocalDate({
    localDate: localDateForInstant(args),
    churchTimeZone: args.churchTimeZone,
  });
}

export function deriveCycleStatus(args: {
  readonly cycle: Pick<CycleCalendarFields, "startsAt" | "endsAt">;
  readonly now: string | Date;
}): CycleStatus {
  const now = typeof args.now === "string" ? new Date(args.now) : args.now;
  const startsAt = new Date(args.cycle.startsAt);
  const endsAt = new Date(args.cycle.endsAt);

  if (
    Number.isNaN(now.getTime()) ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new Error("Cycle status requires valid UTC instants.");
  }

  if (now.getTime() < startsAt.getTime()) {
    return "future";
  }

  if (now.getTime() >= endsAt.getTime()) {
    return "past";
  }

  return "current";
}
