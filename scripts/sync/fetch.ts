import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const POB_REPO = "PathOfBuildingCommunity/PathOfBuilding-PoE2";
// GGG's official passive-tree export. Source of truth for the tree + tree art;
// PoB re-processes this same data. We read it directly so the tree can track a
// new patch (e.g. 0.5) before PoB publishes its converted export.
const GGG_REPO = "grindinggear/poe2-skilltree-export";

export interface Upstream {
  readonly sha: string;
  fetchFile(path: string): Promise<Buffer>;
  fetchFileAsString(path: string): Promise<string>;
  listDir(path: string): Promise<string[]>;
  cachePath(path: string): string;
}

/** PoB-PoE2 upstream — Lua catalogs (gems, bases, uniques, stat descriptions). */
export function createUpstream(): Upstream {
  const sha = resolveSha("POB_VERSION", "POB");
  return makeUpstream(POB_REPO, sha, `.cache/upstream/${sha}`);
}

/** GGG official skilltree export — passive tree data + art (data.json, assets/). */
export function createGggUpstream(): Upstream {
  const sha = resolveSha("GGG_TREE_VERSION", "GGG");
  return makeUpstream(GGG_REPO, sha, `.cache/ggg/${sha}`);
}

function makeUpstream(repo: string, sha: string, cacheDir: string): Upstream {
  return {
    sha,
    cachePath: (path: string) => `${cacheDir}/${path}`,

    async fetchFile(path: string): Promise<Buffer> {
      const cachePath = `${cacheDir}/${path}`;
      const cached = await readIfExists(cachePath);
      if (cached) return cached;

      const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
      const res = await fetch(url);
      if (res.status === 404) {
        throw new Error(`Upstream 404: ${url} — file moved or renamed since pinning?`);
      }
      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status}: ${url}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeCache(cachePath, buf);
      return buf;
    },

    async fetchFileAsString(path: string): Promise<string> {
      const buf = await this.fetchFile(path);
      return buf.toString("utf8");
    },

    async listDir(path: string): Promise<string[]> {
      const cachePath = `${cacheDir}/${path}/_index.json`;
      const cached = await readIfExists(cachePath);
      if (cached) return JSON.parse(cached.toString("utf8"));

      const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${sha}`;
      const res = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        throw new Error(`Upstream listDir HTTP ${res.status}: ${url}`);
      }
      const items = (await res.json()) as Array<{ name: string; type: string }>;
      const names = items.filter((i) => i.type === "file").map((i) => i.name);
      await writeCache(cachePath, Buffer.from(JSON.stringify(names)));
      return names;
    },
  };
}

function resolveSha(file: string, label: string): string {
  const argName = `--${label.toLowerCase()}-commit=`;
  const overrideArg = process.argv.find((a) => a.startsWith(argName));
  // Back-compat: `--commit=` still targets the PoB pin.
  const legacyArg =
    label === "POB" ? process.argv.find((a) => a.startsWith("--commit=")) : undefined;
  const fromArg = overrideArg
    ? overrideArg.slice(argName.length).trim()
    : legacyArg
      ? legacyArg.slice("--commit=".length).trim()
      : null;
  const fromFile = (() => {
    try {
      return readFileSync(file, "utf8").trim();
    } catch {
      return null;
    }
  })();

  const sha = fromArg ?? fromFile;
  if (!sha) {
    throw new Error(`No ${label} SHA available. Either create ${file} or pass ${argName}<sha>.`);
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(`${label} SHA is not a 40-char hex string: "${sha}"`);
  }
  return sha;
}

async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function writeCache(path: string, buf: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}
