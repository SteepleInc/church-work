import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),
    VITE_GOOGLE_PLACES_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    VITE_CONVEX_URL: (import.meta as any).env.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: (import.meta as any).env.VITE_CONVEX_SITE_URL,
    VITE_GOOGLE_PLACES_API_KEY: (import.meta as any).env.VITE_GOOGLE_PLACES_API_KEY,
  },
  emptyStringAsUndefined: true,
});
