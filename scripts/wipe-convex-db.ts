import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url);
const backendDir = new URL("../packages/backend/", import.meta.url);
const backendPath = fileURLToPath(backendDir);
const importDir = join(tmpdir(), "church-task");
const importPath = join(importDir, "empty-convex-import.json");

const convexDeployment = process.env.CONVEX_DEPLOYMENT;

if (!convexDeployment) {
  console.error(
    "CONVEX_DEPLOYMENT is missing. Run with `bun --env-file=.env scripts/wipe-convex-db.ts`.",
  );
  process.exit(1);
}

if (convexDeployment === "prod") {
  console.error("Refusing to wipe CONVEX_DEPLOYMENT=prod.");
  process.exit(1);
}

await mkdir(importDir, { recursive: true });
await writeFile(importPath, "[]\n", "utf8");

console.log(`Wiping Convex deployment ${convexDeployment} from ${repoRoot.pathname}`);

const proc = Bun.spawnSync(
  [
    process.execPath,
    "--env-file=../../.env",
    "convex",
    "import",
    "--table",
    "tasks",
    "--replace-all",
    "-y",
    importPath,
  ],
  {
    cwd: backendPath,
    stdout: "inherit",
    stderr: "inherit",
  },
);

if (!proc.success) {
  process.exit(proc.exitCode || 1);
}
