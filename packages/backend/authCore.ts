import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "./convex/_generated/api";
import type { DataModel } from "./convex/_generated/dataModel";
import authConfig from "./convex/auth.config";

const siteUrl = process.env.SITE_URL!;
const trustedOrigins = [
  siteUrl,
  process.env.E2E_SITE_URL,
  "http://127.0.0.1:2101",
  "http://localhost:2101",
].filter((origin): origin is string => Boolean(origin));

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  });
}
