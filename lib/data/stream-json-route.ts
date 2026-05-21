import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const META_PATH = path.join(process.cwd(), "data", "_meta.json");

async function getEtag(filePath: string): Promise<string> {
  const [metaRaw, s] = await Promise.all([
    readFile(META_PATH, "utf8").catch(() => null),
    stat(filePath),
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

export function createJsonDataRoute(filePath: string) {
  return async function GET(request: Request) {
    const etag = await getEtag(filePath);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  };
}
