import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
config({ override: true, path: fileURLToPath(new URL("../../.env.local", import.meta.url)) });

export default defineConfig({
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
});
