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

export const TeamProductFieldsSchema = Schema.Struct({
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
  defaultWorkflowId: Schema.Union(Schema.String, Schema.Null),
});

export const TeamTableFieldsSchema = Schema.Struct({
  churchId: Schema.String,
  name: Schema.String,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
  defaultWorkflowId: Schema.Union(Schema.String, Schema.Null),
});

export const TeamSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  name: Schema.String,
  color: TeamColorSchema,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
  defaultWorkflowId: Schema.Union(Schema.String, Schema.Null),
});

export const TeamMembershipSchema = Schema.Struct({
  id: Schema.String,
  churchId: Schema.String,
  teamId: Schema.String,
  userId: Schema.String,
});

export type Team = typeof TeamSchema.Type;
export type TeamMembership = typeof TeamMembershipSchema.Type;
