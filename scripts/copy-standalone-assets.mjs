import { cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next/standalone");

if (!existsSync(standalone)) {
  console.warn("copy-standalone-assets: no standalone output, skipping");
  process.exit(0);
}

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, "public"), { recursive: true });
}
cpSync(join(root, ".next/static"), join(standalone, ".next/static"), {
  recursive: true,
});

const dataDir = join(root, "data");
if (existsSync(dataDir)) {
  cpSync(dataDir, join(standalone, "data"), { recursive: true });
}

console.log("copy-standalone-assets: public, static, and data copied into standalone");
