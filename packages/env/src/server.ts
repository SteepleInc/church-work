import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { createServerEnv } from "./create-server-env";

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

const loadNodeEnv = () => {
  const preloadedEnv = { ...process.env };

  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
  config({ override: true, path: fileURLToPath(new URL("../../../.env.local", import.meta.url)) });
  Object.assign(process.env, preloadedEnv);

  return process.env;
};

// Worker bundles resolve the `workerd` export condition to `server.worker.ts`
// instead of this entry. The runtime guard is a fallback so a worker bundle
// that lands here never touches the filesystem at global scope.
const serverEnv = createServerEnv(isCloudflareWorkerRuntime() ? process.env : loadNodeEnv());

export const getServerEnv = () => serverEnv;
