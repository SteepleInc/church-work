/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as polar from "../polar.js";
import type * as privateData from "../privateData.js";
import type * as teams from "../teams.js";
import type * as workDefaults from "../workDefaults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agent: typeof agent;
  auth: typeof auth;
  dashboard: typeof dashboard;
  healthCheck: typeof healthCheck;
  http: typeof http;
  polar: typeof polar;
  privateData: typeof privateData;
  teams: typeof teams;
  workDefaults: typeof workDefaults;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  polar: import("@convex-dev/polar/_generated/component.js").ComponentApi<"polar">;
};
