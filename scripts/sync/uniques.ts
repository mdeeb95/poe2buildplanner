import { parseUniquesLua } from "../parse/uniques-lua.js";
import { readLuaSource } from "../parse/lua.js";
import {
  UniquesFileSchema,
  type UniqueItem,
  type UniquesFile,
} from "@/schemas/unique.js";
import type { Upstream } from "./fetch.js";

const UNIQUES_DIR = "src/Data/Uniques";

/** PoB slots not used in the 12-slot editor grid. */
const SKIP_SLOTS = new Set(["flask", "jewel", "fishing", "tincture"]);

export async function syncUniques(upstream: Upstream): Promise<UniquesFile> {
  const fileNames = await upstream.listDir(UNIQUES_DIR);
  const luaFiles = fileNames.filter((n) => n.endsWith(".lua"));

  const uniques: Record<string, UniqueItem> = {};
  const bySlot: Record<string, string[]> = {};

  for (const file of luaFiles) {
    const slot = file.replace(/\.lua$/, "");
    if (SKIP_SLOTS.has(slot)) continue;

    const src = readLuaSource(await upstream.fetchFile(`${UNIQUES_DIR}/${file}`));
    const parsed = parseUniquesLua(src, slot);

    for (const { name, base } of parsed) {
      uniques[name] = { id: name, name, base, slot };
      (bySlot[slot] ??= []).push(name);
    }
  }

  for (const list of Object.values(bySlot)) list.sort();

  const result: UniquesFile = {
    version: { pobCommit: upstream.sha, fetchedAt: new Date().toISOString() },
    uniques,
    bySlot,
  };
  return UniquesFileSchema.parse(result);
}
