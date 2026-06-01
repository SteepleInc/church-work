import { Schema } from "effect";

export const AgentUser = Schema.Struct({
  id: Schema.String,
  email: Schema.Union(Schema.String, Schema.Null),
  name: Schema.Union(Schema.String, Schema.Null),
});

export const CurrentUserData = Schema.Struct({
  user: Schema.Union(AgentUser, Schema.Null),
});

export const CurrentUserResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("currentUser"),
  data: CurrentUserData,
});

export const ActiveChurchArgs = Schema.Struct({
  churchId: Schema.Union(Schema.String, Schema.Null),
});

export const ActiveChurch = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.Union(Schema.String, Schema.Null),
  churchTimeZone: Schema.Union(Schema.String, Schema.Null),
});

export const ChurchMembership = Schema.Struct({
  role: Schema.String,
});

export const ActiveChurchSuccessResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("activeChurch"),
  data: Schema.Union(
    Schema.Struct({
      status: Schema.Literal("noActiveChurch"),
      activeChurch: Schema.Null,
      membership: Schema.Null,
    }),
    Schema.Struct({
      status: Schema.Literal("activeChurchReady"),
      activeChurch: ActiveChurch,
      membership: ChurchMembership,
    }),
  ),
});

export const ActiveChurchErrorResponse = Schema.Struct({
  ok: Schema.Literal(false),
  operation: Schema.Literal("activeChurch"),
  error: Schema.Struct({
    code: Schema.Literal("not_church_member"),
    message: Schema.String,
  }),
});

export const ActiveChurchResponse = Schema.Union(
  ActiveChurchSuccessResponse,
  ActiveChurchErrorResponse,
);

export const McpCurrentUserToolResponse = Schema.Struct({
  ok: Schema.Literal(true),
  tool: Schema.Literal("currentUser"),
  result: CurrentUserResponse,
});

export const BatchReadArgs = Schema.Struct({
  operations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      operation: Schema.Literal("currentUser"),
      input: Schema.Struct({}),
    }),
  ),
});

export const BatchReadResponse = Schema.Struct({
  ok: Schema.Literal(true),
  operation: Schema.Literal("batchRead"),
  results: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      ok: Schema.Literal(true),
      operation: Schema.Literal("currentUser"),
      data: CurrentUserData,
    }),
  ),
});

export type CurrentUserResponse = typeof CurrentUserResponse.Type;
export type ActiveChurchResponse = typeof ActiveChurchResponse.Type;
export type McpCurrentUserToolResponse = typeof McpCurrentUserToolResponse.Type;
export type BatchReadResponse = typeof BatchReadResponse.Type;

export const currentUserResponse = (user: typeof AgentUser.Type | null): CurrentUserResponse => ({
  ok: true,
  operation: "currentUser",
  data: { user },
});

export const noActiveChurchResponse = (): ActiveChurchResponse => ({
  ok: true,
  operation: "activeChurch",
  data: {
    status: "noActiveChurch",
    activeChurch: null,
    membership: null,
  },
});

export const activeChurchResponse = (args: {
  readonly church: typeof ActiveChurch.Type;
  readonly membership: typeof ChurchMembership.Type;
}): ActiveChurchResponse => ({
  ok: true,
  operation: "activeChurch",
  data: {
    status: "activeChurchReady",
    activeChurch: args.church,
    membership: args.membership,
  },
});

export const notChurchMemberResponse = (): ActiveChurchResponse => ({
  ok: false,
  operation: "activeChurch",
  error: {
    code: "not_church_member",
    message: "User does not have Church Membership for requested Church.",
  },
});

export const mcpCurrentUserToolResponse = (
  user: typeof AgentUser.Type,
): McpCurrentUserToolResponse => ({
  ok: true,
  tool: "currentUser",
  result: currentUserResponse(user),
});

export const batchReadResponse = (
  operations: ReadonlyArray<{ readonly id: string }>,
  data: typeof CurrentUserData.Type,
): BatchReadResponse => ({
  ok: true,
  operation: "batchRead",
  results: operations.map((operation) => ({
    id: operation.id,
    ok: true,
    operation: "currentUser",
    data,
  })),
});
