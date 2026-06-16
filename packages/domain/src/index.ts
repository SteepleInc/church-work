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

export const STARTER_TEAM_NAMES = ["Leadership", "Worship", "Kids & Youth"] as const;

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

export const normalizeTeamIdentifier = (value: string): string => value.trim().toUpperCase();

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
