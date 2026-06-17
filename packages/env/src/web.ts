import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_GOOGLE_PLACES_API_KEY: z.string().optional(),
    VITE_ZERO_CACHE_URL: z.url().optional(),
  },
  runtimeEnv: {
    VITE_GOOGLE_PLACES_API_KEY: (import.meta as any).env.VITE_GOOGLE_PLACES_API_KEY,
    VITE_ZERO_CACHE_URL: (import.meta as any).env.VITE_ZERO_CACHE_URL,
  },
  emptyStringAsUndefined: true,
});
