import { Schema } from "effect";

const TeamProductFields = Schema.Struct({
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
  defaultWorkflowId: Schema.Union(Schema.String, Schema.Null),
});

export const TeamUpdate = Schema.Struct({
  teamId: Schema.String,
  fields: Schema.partial(TeamProductFields),
});

export const TeamProductUpdateArgs = Schema.Struct({
  churchId: Schema.String,
  updates: Schema.Array(TeamUpdate),
});

export const TeamListArgs = Schema.Struct({
  churchId: Schema.String,
});

export const Team = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  churchId: Schema.String,
  archivedAt: Schema.Union(Schema.String, Schema.Null),
  sortOrder: Schema.Number,
  defaultWorkflowId: Schema.Union(Schema.String, Schema.Null),
});

export const TeamOperationResponse = Schema.Struct({
  ok: Schema.Boolean,
  operation: Schema.Union(Schema.Literal("listTeams"), Schema.Literal("updateTeamProductFields")),
  data: Schema.Struct({
    teams: Schema.Array(Team),
  }),
});

export const TeamOperationErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(Schema.Literal("listTeams"), Schema.Literal("updateTeamProductFields")),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("team_not_found"),
    ),
    message: Schema.String,
  }),
});

export const TeamReadResponse = Schema.Union(TeamOperationResponse, TeamOperationErrorResponse);
export const TeamWriteResponse = Schema.Union(TeamOperationResponse, TeamOperationErrorResponse);

export const teamsResponse = (
  operation: "listTeams" | "updateTeamProductFields",
  teams: ReadonlyArray<Schema.Schema.Type<typeof Team>>,
) => ({
  ok: true,
  operation,
  data: { teams },
});

export const teamErrorResponse = (
  operation: "listTeams" | "updateTeamProductFields",
  code: Schema.Schema.Type<typeof TeamOperationErrorResponse>["error"]["code"],
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
