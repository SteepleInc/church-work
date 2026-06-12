import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const envDir = "../..";
  const env = loadEnv(mode, envDir, "");

  return {
    envDir,
    server: {
      port: Number(env.VITE_PORT ?? 2001),
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: "react",
        // Deliberately not code-split: one bundle means a navigation can never
        // await a JS chunk, so route pending states are unrepresentable
        // (docs/adr/0010-no-render-gates.md).
        autoCodeSplitting: false,
      }),
      react(),
    ],
  };
});
