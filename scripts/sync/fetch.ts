import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const REPO = "PathOfBuildingCommunity/PathOfBuilding-PoE2";

export interface Upstream {
  readonly sha: string;
  fetchFile(path: string): Promise<Buffer>;
  fetchFileAsString(path: string): Promise<string>;
  listDir(path: string): Promise<string[]>;
  cachePath(path: string): string;
}

export function createUpstream(): Upstream {
  const sha = resolveSha();
  const cacheDir = `.cache/upstream/${sha}`;

  return {
    sha,
    cachePath: (path: string) => `${cacheDir}/${path}`,

    async fetchFile(path: string): Promise<Buffer> {
      const cachePath = `${cacheDir}/${path}`;
      const cached = await readIfExists(cachePath);
      if (cached) return cached;

      const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${path}`;
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

      const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${sha}`;
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

function resolveSha(): string {
  const overrideArg = process.argv.find((a) => a.startsWith("--commit="));
  const fromArg = overrideArg ? overrideArg.slice("--commit=".length).trim() : null;
  const fromFile = (() => {
    try {
      return readFileSync("POB_VERSION", "utf8").trim();
    } catch {
      return null;
    }
  })();

  const sha = fromArg ?? fromFile;
  if (!sha) {
    throw new Error(
      "No POB SHA available. Either create POB_VERSION or pass --commit=<sha>.",
    );
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(`POB SHA is not a 40-char hex string: "${sha}"`);
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
