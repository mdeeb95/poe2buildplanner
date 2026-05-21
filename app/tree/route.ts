import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const TREE_PATH = path.join(process.cwd(), "data", "tree.json");
const META_PATH = path.join(process.cwd(), "data", "_meta.json");

// ETag = pobCommit + tree.json mtime. Including mtime means the ETag changes
// whenever the data file is regenerated, even when the upstream SHA didn't
// change (e.g. fixing a sync bug without re-pinning). Recomputed per request
// so a re-sync invalidates browser caches without a server restart.
async function getEtag(): Promise<string> {
  const [metaRaw, s] = await Promise.all([
    readFile(META_PATH, "utf8").catch(() => null),
    stat(TREE_PATH),
  ]);
  let sha = "unknown";
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as { pobCommit?: string };
      sha = meta.pobCommit ?? "unknown";
    } catch {
      /* keep unknown */
    }
  }
  return `"${sha}-${Math.floor(s.mtimeMs)}"`;
}

export async function GET(request: Request) {
  const etag = await getEtag();
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const stream = createReadStream(TREE_PATH);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
