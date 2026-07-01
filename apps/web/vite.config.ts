import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const ZERO_PATH_REGEX = /^\/zero/;

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, "../..");
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };
  const proxy = env.VITE_ZERO_CACHE_URL
    ? {
        "/zero": {
          changeOrigin: true,
          rewrite: (path: string) => path.replace(ZERO_PATH_REGEX, ""),
          target: env.VITE_ZERO_CACHE_URL,
          ws: true,
        },
      }
    : undefined;

  return {
    envDir,
    server: {
      port: Number(env.VITE_PORT ?? 2001),
      proxy,
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tailwindcss(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart({
        router: {},
      }),
      react(),
    ],
  };
});
