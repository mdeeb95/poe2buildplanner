import { readFile } from "node:fs/promises";
import path from "node:path";
import { BuildEditor } from "@/components/BuildEditor";
import type { Tree } from "@/schemas/tree";

export const dynamic = "force-static";

export default async function HomePage() {
  const raw = await readFile(path.join(process.cwd(), "data", "tree.json"), "utf8");
  const tree = JSON.parse(raw) as Tree;
  return (
    <BuildEditor
      seed={{
        version: tree.version,
        bounds: tree.bounds,
        constants: tree.constants,
      }}
      classes={tree.classes}
    />
  );
}
