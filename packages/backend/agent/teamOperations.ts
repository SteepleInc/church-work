import {
  TeamMembershipSchema,
  TeamProductFieldsSchema,
  TeamSchema,
} from "@church-task/domain/Team";
import { Schema } from "effect";

const TeamProductFields = TeamProductFieldsSchema;

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
  includeArchived: Schema.optional(Schema.Boolean),
});

export const TeamCreateArgs = Schema.Struct({
  churchId: Schema.String,
  name: Schema.String,
});

export const TeamRenameArgs = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  name: Schema.String,
});

export const TeamSetIdentifierArgs = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  identifier: Schema.String,
});

const TemplateTeamRepair = Schema.Union(
  Schema.Struct({
    templateTeamId: Schema.String,
    action: Schema.Literal("remap"),
    mappedTeamId: Schema.String,
  }),
  Schema.Struct({
    templateTeamId: Schema.String,
    action: Schema.Literal("abandon"),
  }),
);

export const TeamArchiveArgs = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  templateTeamRepairs: Schema.optional(Schema.Array(TemplateTeamRepair)),
});

export const TeamDeleteArgs = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  templateTeamRepairs: Schema.optional(Schema.Array(TemplateTeamRepair)),
});

export const TeamReorderArgs = Schema.Struct({
  churchId: Schema.String,
  teamIds: Schema.Array(Schema.String),
});

export const TeamMembershipArgs = Schema.Struct({
  churchId: Schema.String,
  teamId: Schema.String,
  userId: Schema.String,
});

export const Team = TeamSchema;

export const TeamOperationResponse = Schema.Struct({
  ok: Schema.Boolean,
  operation: Schema.Union(
    Schema.Literal("listTeams"),
    Schema.Literal("createTeam"),
    Schema.Literal("renameTeam"),
    Schema.Literal("setTeamIdentifier"),
    Schema.Literal("archiveTeam"),
    Schema.Literal("deleteTeam"),
    Schema.Literal("reorderTeams"),
    Schema.Literal("updateTeamProductFields"),
  ),
  data: Schema.Struct({
    teams: Schema.Array(Team),
  }),
});

export const TeamMembership = TeamMembershipSchema;

export const TeamMembershipOperationResponse = Schema.Struct({
  ok: Schema.Boolean,
  operation: Schema.Union(
    Schema.Literal("listTeamMemberships"),
    Schema.Literal("addTeamMember"),
    Schema.Literal("removeTeamMember"),
  ),
  data: Schema.Struct({
    teamMemberships: Schema.Array(TeamMembership),
  }),
});

export const TeamOperationErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("listTeams"),
    Schema.Literal("createTeam"),
    Schema.Literal("renameTeam"),
    Schema.Literal("setTeamIdentifier"),
    Schema.Literal("archiveTeam"),
    Schema.Literal("deleteTeam"),
    Schema.Literal("reorderTeams"),
    Schema.Literal("updateTeamProductFields"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("team_not_found"),
      Schema.Literal("team_has_tasks"),
      Schema.Literal("template_team_repair_required"),
      Schema.Literal("last_team_required"),
      Schema.Literal("workflow_not_found"),
      Schema.Literal("invalid_team_reorder"),
      Schema.Literal("invalid_team_identifier"),
      Schema.Literal("team_identifier_taken"),
    ),
    message: Schema.String,
  }),
});

export const TeamMembershipOperationErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Union(
    Schema.Literal("listTeamMemberships"),
    Schema.Literal("addTeamMember"),
    Schema.Literal("removeTeamMember"),
  ),
  error: Schema.Struct({
    code: Schema.Union(
      Schema.Literal("not_authenticated"),
      Schema.Literal("not_church_member"),
      Schema.Literal("not_authorized"),
      Schema.Literal("team_not_found"),
      Schema.Literal("member_not_found"),
    ),
    message: Schema.String,
  }),
});

export const TeamReadResponse = Schema.Union(
  TeamOperationResponse,
  TeamOperationErrorResponse,
  TeamMembershipOperationResponse,
  TeamMembershipOperationErrorResponse,
);
export const TeamWriteResponse = Schema.Union(
  TeamOperationResponse,
  TeamOperationErrorResponse,
  TeamMembershipOperationResponse,
  TeamMembershipOperationErrorResponse,
);

export const teamsResponse = (
  operation: Schema.Schema.Type<typeof TeamOperationResponse>["operation"],
  teams: ReadonlyArray<Schema.Schema.Type<typeof Team>>,
) => ({
  ok: true,
  operation,
  data: { teams },
});

export const teamErrorResponse = (
  operation: Schema.Schema.Type<typeof TeamOperationErrorResponse>["operation"],
  code: Schema.Schema.Type<typeof TeamOperationErrorResponse>["error"]["code"],
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});

export const teamMembershipsResponse = (
  operation: Schema.Schema.Type<typeof TeamMembershipOperationResponse>["operation"],
  teamMemberships: ReadonlyArray<Schema.Schema.Type<typeof TeamMembership>>,
) => ({
  ok: true,
  operation,
  data: { teamMemberships },
});

export const teamMembershipErrorResponse = (
  operation: Schema.Schema.Type<typeof TeamMembershipOperationErrorResponse>["operation"],
  code: Schema.Schema.Type<typeof TeamMembershipOperationErrorResponse>["error"]["code"],
  message: string,
) => ({
  ok: false as const,
  operation,
  error: { code, message },
});
