import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_OR_PUBLIC = /^(data|public)\//;

export function isDataOnlyChange(files: readonly string[]): boolean {
  if (files.length === 0) return false;
  return files.every((f) => DATA_OR_PUBLIC.test(f));
}

/** Paths changed in the latest commit, or null when git history is unavailable. */
export function getChangedFiles(root: string): string[] | null {
  try {
    const out = execSync("git diff --name-only HEAD~1 HEAD", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return [];
    return out.split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

/** Hash of tracked source files excluding data/ and public/ (stable across data-only commits). */
export function getSourceHash(root: string): string | null {
  try {
    const files = execSync("git ls-files --exclude-standard", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter((f) => f && !DATA_OR_PUBLIC.test(f))
      .sort();
    return createHash("sha256").update(files.join("\n")).digest("hex");
  } catch {
    return null;
  }
}

export function cacheRoot(root: string): string {
  if (process.env.BUILD_CACHE_DIR) return process.env.BUILD_CACHE_DIR;
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA);
  return onRailway ? "/root/.cache/buildproj-next" : join(root, ".cache/buildproj-next");
}

export function canUseFastPath(opts: {
  root: string;
  changed: string[] | null;
  cacheDir: string;
}): boolean {
  if (opts.changed === null || !isDataOnlyChange(opts.changed)) return false;
  if (!existsSync(join(opts.cacheDir, "source-hash"))) return false;
  if (!existsSync(join(opts.cacheDir, "standalone", "server.js"))) return false;

  const currentHash = getSourceHash(opts.root);
  const cachedHash = readFileSync(join(opts.cacheDir, "source-hash"), "utf8").trim();
  if (!currentHash || currentHash !== cachedHash) return false;

  return true;
}

export function restoreNextFromCache(root: string, cacheDir: string): void {
  rmSync(join(root, ".next"), { recursive: true, force: true });
  mkdirSync(join(root, ".next"), { recursive: true });
  cpSync(join(cacheDir, "standalone"), join(root, ".next/standalone"), { recursive: true });
  cpSync(join(cacheDir, "static"), join(root, ".next/static"), { recursive: true });
}

export function saveNextToCache(root: string, cacheDir: string): void {
  const sourceHash = getSourceHash(root);
  if (!sourceHash) return;

  mkdirSync(cacheDir, { recursive: true });
  rmSync(join(cacheDir, "standalone"), { recursive: true, force: true });
  rmSync(join(cacheDir, "static"), { recursive: true, force: true });
  cpSync(join(root, ".next/standalone"), join(cacheDir, "standalone"), { recursive: true });
  cpSync(join(root, ".next/static"), join(cacheDir, "static"), { recursive: true });
  writeFileSync(join(cacheDir, "source-hash"), `${sourceHash}\n`);
}
