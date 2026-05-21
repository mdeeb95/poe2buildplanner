import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cacheRoot,
  canUseFastPath,
  getChangedFiles,
  restoreNextFromCache,
  saveNextToCache,
} from "./railway-build-lib.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = cacheRoot(root);
const changed = getChangedFiles(root);

function run(cmd: string): void {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

if (canUseFastPath({ root, changed, cacheDir })) {
  console.log(
    `[railway-build] data-only change (${changed!.join(", ")}); restoring cached Next output`,
  );
  restoreNextFromCache(root, cacheDir);
  run("node scripts/copy-standalone-assets.mjs");
} else {
  if (changed === null) {
    console.log("[railway-build] full build (no git history for fast path)");
  } else if (changed.length === 0) {
    console.log("[railway-build] full build (empty diff)");
  } else {
    console.log(`[railway-build] full build (${changed.join(", ")})`);
  }
  run("pnpm exec next build");
  run("node scripts/copy-standalone-assets.mjs");
  saveNextToCache(root, cacheDir);
}

console.log("[railway-build] done");
