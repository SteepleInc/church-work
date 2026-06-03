import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const serverEnv = createEnv({
  clientPrefix: "VITE_",
  client: {},
  server: {
    BETTER_AUTH_SECRET: z.string().optional(),
    CHURCH_INVITATION_EMAIL_FROM: z.email().optional(),
    CONVEX_SITE_URL: z.url().optional(),
    E2E_SITE_URL: z.url().optional(),
    GOOGLE_PLACES_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    RESEND_API_KEY: z.string().optional(),
    SITE_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.NODE_ENV === "test",
});
