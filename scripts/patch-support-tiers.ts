/**
 * Patch `data/gems.json` with `uncutTier` from PoB Gems.lua `Tier`.
 * Run after sync when gems.json predates uncutTier, or when PoB data updates.
 */
import fs from "node:fs";
import path from "node:path";
import { parseReturnTable, readLuaSource } from "./parse/lua.js";
import { GemsFileSchema } from "@/schemas/gem.js";

const GEMS_JSON = path.join(process.cwd(), "data", "gems.json");
const POB_GEMS_URL =
  "https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/Gems.lua";

async function main() {
  const res = await fetch(POB_GEMS_URL);
  if (!res.ok) throw new Error(`Failed to fetch PoB Gems.lua: HTTP ${res.status}`);
  const src = readLuaSource(await res.text());
  const { data: indexData } = parseReturnTable(src);

  const raw = JSON.parse(fs.readFileSync(GEMS_JSON, "utf8"));
  const parsed = GemsFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid gems.json: ${parsed.error.message.slice(0, 200)}`);
  }

  let patchedActive = 0;
  let patchedSupport = 0;

  for (const [id, gem] of Object.entries(parsed.data.active)) {
    const entry = indexData[id] as { Tier?: number } | undefined;
    const tier = typeof entry?.Tier === "number" ? entry.Tier : null;
    if (gem.uncutTier !== tier) {
      gem.uncutTier = tier;
      patchedActive++;
    }
  }

  for (const [id, gem] of Object.entries(parsed.data.support)) {
    const entry = indexData[id] as { Tier?: number } | undefined;
    const tier = typeof entry?.Tier === "number" ? entry.Tier : null;
    if (gem.uncutTier !== tier) {
      gem.uncutTier = tier;
      patchedSupport++;
    }
  }

  fs.writeFileSync(GEMS_JSON, `${JSON.stringify(parsed.data, null, 2)}\n`);
  console.log(
    `Patched uncutTier on ${patchedActive} active and ${patchedSupport} support gems.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
