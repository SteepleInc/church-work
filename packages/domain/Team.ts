import { Schema } from "effect";

// The curated palette of Team Color tokens. Each token maps to a Tailwind
// color family on the web side. Stored on the team record as a plain string;
// use isTeamColor to validate stored values.
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

export const TeamColorSchema = Schema.Literal(...TEAM_COLORS);

export const isTeamColor = (value: unknown): value is TeamColor =>
  typeof value === "string" && (TEAM_COLORS as readonly string[]).includes(value);

// Deterministically derive a Team Color from a Team name. Used to assign a
// color at creation time and as a render-time fallback for teams created
// before colors were stored.
export const getTeamColorForName = (name: string): TeamColor => {
  const normalized = name.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return TEAM_COLORS[hash % TEAM_COLORS.length] ?? TEAM_COLORS[0];
};

// Team Identifier: the short uppercase code that prefixes Task Identifiers
// (e.g. "PRD" in "PRD-48") and references a Team in URLs. Generated as three
// characters from the Team name at creation (mirroring the derive-from-name
// Team Color pattern), user-editable up to 7 characters, unique within the
// Church. Pure functions only — no I/O.
export const TEAM_IDENTIFIER_MAX_LENGTH = 7;

const TEAM_IDENTIFIER_PATTERN = /^[A-Z0-9]{1,7}$/;

// Canonical form is uppercase; matching elsewhere is case-insensitive.
export const normalizeTeamIdentifier = (value: string): string => value.trim().toUpperCase();

export const isValidTeamIdentifier = (value: string): boolean =>
  TEAM_IDENTIFIER_PATTERN.test(value);

// The base candidate before collision bumping: the first three alphanumeric
// characters of the name, uppercased. Short names yield shorter candidates
// ("Go" -> "GO"); names with no alphanumeric characters fall back to "TEAM".
export const deriveTeamIdentifierBase = (name: string): string => {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3) || "TEAM";
};

// Derive a Team Identifier from a Team name that does not collide with any
// already-taken identifier (case-insensitive). Collisions bump
// deterministically by appending a counter: KID, KID2, KID3, ... The base is
// truncated when needed so bumped candidates never exceed the max length.
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

export const TeamProductFieldsSchema = Schema.Struct({
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
});

export const TeamTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  name: Schema.String,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
});

export const TeamSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  name: Schema.String,
  identifier: Schema.String,
  previousIdentifiers: Schema.Array(Schema.String),
  color: TeamColorSchema,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
});

export const TeamMembershipSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  teamId: Schema.String,
  userId: Schema.String,
});

export type Team = typeof TeamSchema.Type;
export type TeamMembership = typeof TeamMembershipSchema.Type;
