import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

import {
  ActiveChurchArgs,
  ActiveChurchResponse,
  BatchReadArgs,
  BatchReadResponse,
  CurrentUserResponse,
} from "../agent/operations";

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
