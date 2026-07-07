import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const createServerEnv = (
  runtimeEnv: Record<string, string | boolean | number | undefined>,
) =>
  createEnv({
    clientPrefix: "VITE_",
    client: {},
    server: {
      BETTER_AUTH_SECRET: z.string().optional(),
      BETTER_AUTH_URL: z.url().optional(),
      CHURCH_INVITATION_EMAIL_FROM: z.email().optional(),
      DATABASE_URL: z.url(),
      E2E_SITE_URL: z.url().optional(),
      GOOGLE_PLACES_API_KEY: z.string().optional(),
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      OTP_CAPTURE_ENABLED: z.enum(["0", "1"]).optional(),
      RESEND_API_KEY: z.string().optional(),
      SITE_URL: z.url().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    skipValidation: runtimeEnv.NODE_ENV === "test",
  });
