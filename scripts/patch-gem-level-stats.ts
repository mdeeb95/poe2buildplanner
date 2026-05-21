/**
 * Patch `data/gems.json` level entries with computed reqStr/reqDex/reqInt.
 */
import fs from "node:fs";
import path from "node:path";
import { getGemStatRequirementsAtLevel } from "@/lib/build/gem-stat-requirement.js";
import { GemsFileSchema } from "@/schemas/gem.js";

const GEMS_JSON = path.join(process.cwd(), "data", "gems.json");

function main() {
  const raw = JSON.parse(fs.readFileSync(GEMS_JSON, "utf8"));
  const parsed = GemsFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid gems.json: ${parsed.error.message.slice(0, 200)}`);
  }

  let patched = 0;

  for (const gem of [...Object.values(parsed.data.active), ...Object.values(parsed.data.support)]) {
    const isSupport = gem.kind === "support";
    for (const level of gem.levels) {
      const stats = getGemStatRequirementsAtLevel(
        level.level,
        gem.reqStr,
        gem.reqDex,
        gem.reqInt,
        isSupport,
      );
      if (
        level.reqStr !== stats.reqStr ||
        level.reqDex !== stats.reqDex ||
        level.reqInt !== stats.reqInt
      ) {
        level.reqStr = stats.reqStr;
        level.reqDex = stats.reqDex;
        level.reqInt = stats.reqInt;
        patched++;
      }
    }
  }

  fs.writeFileSync(GEMS_JSON, `${JSON.stringify(parsed.data, null, 2)}\n`);
  console.log(`Patched stat requirements on ${patched} gem level entries.`);
}

main();
