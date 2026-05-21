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

console.log("copy-standalone-assets: public + static copied into standalone");
