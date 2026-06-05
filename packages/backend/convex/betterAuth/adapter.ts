import { createApi } from "@convex-dev/better-auth";

import { createAuthOptions } from "../../authCore";
import schema from "./schema";

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, createAuthOptions);
