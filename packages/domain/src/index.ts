import { addLocalDateDays } from "./template-projection";

export const TEAM_COLORS = [
  "red",
  "orange",
  "amber",
  "emerald",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;

export type TeamColor = (typeof TEAM_COLORS)[number];

export const LABEL_COLORS = TEAM_COLORS;

export type LabelColor = (typeof LABEL_COLORS)[number];

export const STARTER_TEAM_NAMES = [
  "Worship",
  "Production",
  "Kids",
  "Experience",
  "Facilities",
  "Social Media",
] as const;

export const STARTER_LABELS = [
  "Worship",
  "Kids & Youth",
  "Outreach",
  "Events",
  "Facilities",
  "Communications",
  "Admin",
] as const;

export const DEFAULT_WORKFLOW_STATUSES = [
  { key: "to-do", name: "To Do", task_state: "todo", sort_order: 0 },
  { key: "in-progress", name: "In Progress", task_state: "in_progress", sort_order: 1 },
  { key: "done", name: "Done", task_state: "done", sort_order: 2 },
] as const;

export const TEAM_IDENTIFIER_MAX_LENGTH = 7;

export const TaskStatus = {
  todo: "todo",
  inProgress: "in_progress",
  done: "done",
  canceled: "canceled",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export type TaskEstimate = "xs" | "s" | "m" | "l" | "xl";

export const getTeamColorForName = (name: string): TeamColor => {
  const normalized = name.trim().toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return TEAM_COLORS[hash % TEAM_COLORS.length] ?? TEAM_COLORS[0];
};

export const getLabelColorForName = (name: string): TeamColor => getTeamColorForName(name);

export const isLabelColor = (value: unknown): value is LabelColor =>
  typeof value === "string" && (LABEL_COLORS as readonly string[]).includes(value);

export const isTeamColor = (value: unknown): value is TeamColor =>
  typeof value === "string" && (TEAM_COLORS as readonly string[]).includes(value);

export const normalizeTeamIdentifier = (value: string): string => value.trim().toUpperCase();

export const isValidTeamIdentifier = (value: string): boolean => {
  return (
    value.length > 0 && value.length <= TEAM_IDENTIFIER_MAX_LENGTH && /^[A-Z0-9]+$/.test(value)
  );
};

export const deriveTeamIdentifierBase = (name: string): string => {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3) || "TEAM";
};

export const generateTeamIdentifier = (
  name: string,
  takenIdentifiers: ReadonlyArray<string>,
): string => {
  const taken = new Set(takenIdentifiers.map(normalizeTeamIdentifier));
  const base = deriveTeamIdentifierBase(name);

  if (!taken.has(base)) return base;

  for (let bump = 2; ; bump += 1) {
    const suffix = String(bump);
    const candidate = base.slice(0, TEAM_IDENTIFIER_MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
};

export const formatTaskIdentifier = (teamIdentifier: string, taskNumber: number): string =>
  `${teamIdentifier.trim().toUpperCase()}-${taskNumber}`;

const localDateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const localDateTimeFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

export const assertValidTimeZone = (churchTimeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: churchTimeZone });
  } catch {
    throw new Error("Church Time Zone must be a valid IANA time zone.");
  }
};

export const parseLocalDate = (localDate: string) => {
  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const asUtcDate = new Date(Date.UTC(year, month - 1, day));
  if (asUtcDate.toISOString().slice(0, 10) !== localDate) {
    throw new Error("Local date must be a real calendar date.");
  }
  return { day, month, year };
};

const localDateDayOfWeek = (localDate: string) => {
  const { day, month, year } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const getLocalDateFormatter = (churchTimeZone: string) => {
  const existing = localDateFormatterByTimeZone.get(churchTimeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: churchTimeZone,
    year: "numeric",
  });
  localDateFormatterByTimeZone.set(churchTimeZone, formatter);
  return formatter;
};

const getLocalDateTimeFormatter = (churchTimeZone: string) => {
  const existing = localDateTimeFormatterByTimeZone.get(churchTimeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: churchTimeZone,
    year: "numeric",
  });
  localDateTimeFormatterByTimeZone.set(churchTimeZone, formatter);
  return formatter;
};

const partsToRecord = (parts: Intl.DateTimeFormatPart[]) => {
  const record: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") record[part.type] = part.value;
  }
  return record;
};

export const localDateForInstant = (instant: Date, churchTimeZone: string) => {
  assertValidTimeZone(churchTimeZone);
  const parts = partsToRecord(getLocalDateFormatter(churchTimeZone).formatToParts(instant));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const localMidnightToUtcInstant = (localDate: string, churchTimeZone: string) => {
  const { day, month, year } = parseLocalDate(localDate);
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
    if (delta === 0) return new Date(candidateUtc);
    candidateUtc -= delta;
  }

  return new Date(candidateUtc);
};

export const cycleStartDateForLocalDate = (localDate: string) => {
  const dayOfWeek = localDateDayOfWeek(localDate);
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addLocalDateDays(localDate, -daysSinceMonday);
};

const TASK_IDENTIFIER_PATTERN = new RegExp(
  `^([A-Za-z0-9]{1,${TEAM_IDENTIFIER_MAX_LENGTH}})-([0-9]+)$`,
);

export type ParsedTaskIdentifier = {
  readonly teamIdentifier: string;
  readonly taskNumber: number;
};

export const parseTaskIdentifier = (value: string): ParsedTaskIdentifier | null => {
  const match = TASK_IDENTIFIER_PATTERN.exec(value.trim());
  if (!match) return null;

  const taskNumber = Number.parseInt(match[2]!, 10);
  if (!Number.isSafeInteger(taskNumber) || taskNumber < 1) return null;

  return { teamIdentifier: match[1]!.toUpperCase(), taskNumber };
};

export * from "./template-projection";
export * from "./key-dates";
export * from "./agent-contracts";
