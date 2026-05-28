import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

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
