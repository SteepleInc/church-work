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
import type * as admin from "../admin.js";
import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as churchSettings from "../churchSettings.js";
import type * as coreWork from "../coreWork.js";
import type * as crons from "../crons.js";
import type * as cycleMaintenance from "../cycleMaintenance.js";
import type * as dashboard from "../dashboard.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as keyDates from "../keyDates.js";
import type * as labels from "../labels.js";
import type * as listQueryHelpers from "../listQueryHelpers.js";
import type * as polar from "../polar.js";
import type * as privateData from "../privateData.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as telemetry from "../telemetry.js";
import type * as templates from "../templates.js";
import type * as workDefaults from "../workDefaults.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  admin: typeof admin;
  agent: typeof agent;
  auth: typeof auth;
  churchSettings: typeof churchSettings;
  coreWork: typeof coreWork;
  crons: typeof crons;
  cycleMaintenance: typeof cycleMaintenance;
  dashboard: typeof dashboard;
  healthCheck: typeof healthCheck;
  http: typeof http;
  keyDates: typeof keyDates;
  labels: typeof labels;
  listQueryHelpers: typeof listQueryHelpers;
  polar: typeof polar;
  privateData: typeof privateData;
  tasks: typeof tasks;
  teams: typeof teams;
  telemetry: typeof telemetry;
  templates: typeof templates;
  workDefaults: typeof workDefaults;
  workflows: typeof workflows;
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
