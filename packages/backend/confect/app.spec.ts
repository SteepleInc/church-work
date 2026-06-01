import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

import {
  ListActivitiesForEntityArgs,
  ListActivitiesForEntityResponse,
  RecordActivityArgs,
  RecordActivityOperationResponse,
} from "../agent/activityOperations";
import {
  ActiveChurchArgs,
  ActiveChurchResponse,
  BatchReadArgs,
  BatchReadResponse,
  CurrentUserResponse,
} from "../agent/operations";
import {
  TeamListArgs,
  TeamProductUpdateArgs,
  TeamReadResponse,
  TeamWriteResponse,
} from "../agent/teamOperations";
import { WorkDefaultsChurchArgs, WorkDefaultsResponse } from "../agent/workDefaultsOperations";

export const healthCheck = GroupSpec.make("healthCheck").addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: Schema.Struct({}),
    returns: Schema.Literal("OK"),
  }),
);

export const privateData = GroupSpec.make("privateData").addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: Schema.Struct({}),
    returns: Schema.Struct({ message: Schema.String }),
  }),
);

export const auth = GroupSpec.make("auth").addFunction(
  FunctionSpec.publicQuery({
    name: "getCurrentUser",
    args: Schema.Struct({}),
    returns: Schema.Any,
  }),
);

export const agent = GroupSpec.make("agent")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "currentUser",
      args: Schema.Struct({}),
      returns: CurrentUserResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "batchRead",
      args: BatchReadArgs,
      returns: BatchReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "activeChurch",
      args: ActiveChurchArgs,
      returns: ActiveChurchResponse,
    }),
  );

export const workDefaults = GroupSpec.make("workDefaults")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "seedForChurch",
      args: WorkDefaultsChurchArgs,
      returns: WorkDefaultsResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "readForChurch",
      args: WorkDefaultsChurchArgs,
      returns: WorkDefaultsResponse,
    }),
  );

export const activities = GroupSpec.make("activities")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "recordForChurch",
      args: RecordActivityArgs,
      returns: RecordActivityOperationResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForEntity",
      args: ListActivitiesForEntityArgs,
      returns: ListActivitiesForEntityResponse,
    }),
  );

export const teams = GroupSpec.make("teams")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForChurch",
      args: TeamListArgs,
      returns: TeamReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateProductFields",
      args: TeamProductUpdateArgs,
      returns: TeamWriteResponse,
    }),
  );
