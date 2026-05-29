import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const META_PATH = path.join(process.cwd(), "data", "_meta.json");

async function getEtag(filePath: string): Promise<string | null> {
  try {
    await access(filePath);
  } catch {
    return null;
  }
  const [metaRaw, s] = await Promise.all([
    readFile(META_PATH, "utf8").catch(() => null),
    stat(filePath),
  ]);
  let sha = "unknown";
  let fetchedAt = "";
  let fileMeta: Record<string, unknown> | undefined;
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as {
        pobCommit?: string;
        fetchedAt?: string;
        files?: Record<string, unknown>;
      };
      sha = meta.pobCommit ?? "unknown";
      fetchedAt = meta.fetchedAt ?? "";
      fileMeta = meta.files;
    } catch {
      /* keep unknown */
    }
  }
  const fileKey = path.basename(filePath);
  // Always fold the file's size + mtime into the signature. The `_meta.json`
  // entry alone is too coarse — it summarises counts (e.g. {active, support})
  // that stay constant when fields are added/edited in place, so a content edit
  // that didn't change the meta would otherwise keep serving a stale 304.
  const statSig = `${s.size}-${Math.floor(s.mtimeMs)}`;
  const fileSig =
    fileMeta?.[fileKey] != null
      ? `${JSON.stringify(fileMeta[fileKey])}-${statSig}`
      : statSig;
  return `"${sha}-${fetchedAt}-${fileKey}-${fileSig}"`;
}

export function createJsonDataRoute(filePath: string) {
  return async function GET(request: Request) {
    const etag = await getEtag(filePath);
    if (!etag) {
      return new Response("Not found", { status: 404 });
    }
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: etag,
      },
    });
  };
}
