import { fileURLToPath } from "node:url";

import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { z } from "zod";

const isCloudflareWorkerRuntime = () => {
  const navigatorUserAgent = globalThis.navigator?.userAgent ?? "";
  const processVersions = process.versions as NodeJS.ProcessVersions & {
    workerd?: string;
  };

  return (
    processVersions.workerd !== undefined ||
    navigatorUserAgent.includes("Cloudflare-Workers") ||
    ("WebSocketPair" in globalThis && "caches" in globalThis)
  );
};

const loadCloudflareWorkerEnv = async () => {
  // `cloudflare:workers` is a workerd built-in. Import it through a variable
  // specifier so Node TypeScript programs and non-worker bundles neither
  // resolve nor include it.
  const specifier = "cloudflare:workers";
  const { env } = await import(/* @vite-ignore */ specifier);

  return {
    ...env,
    // Prefer pooled Hyperdrive connections over the direct DATABASE_URL when
    // the binding is configured.
    DATABASE_URL: env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL,
  };
};

const loadNodeEnv = () => {
  const preloadedEnv = { ...process.env };

  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
  config({ override: true, path: fileURLToPath(new URL("../../../.env.local", import.meta.url)) });
  Object.assign(process.env, preloadedEnv);

  return process.env;
};

export const serverEnv = createEnv({
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
  runtimeEnv: isCloudflareWorkerRuntime() ? await loadCloudflareWorkerEnv() : loadNodeEnv(),
  emptyStringAsUndefined: true,
  skipValidation: process.env.NODE_ENV === "test",
});
