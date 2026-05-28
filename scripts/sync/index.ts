import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createUpstream, createGggUpstream } from "./fetch.js";
import { syncTree, fetchTreeConstants } from "./tree.js";
import { syncGems } from "./gems.js";
import { syncBases } from "./bases.js";
import { syncUniques } from "./uniques.js";
import { syncStatDescriptions } from "./stat-descriptions.js";
import { syncTreeArt, logIconCoverage } from "./tree-art.js";

const SCHEMA_VERSION = 1;

async function main() {
  const upstream = createUpstream();
  const ggg = createGggUpstream();
  console.log(`[sync] Pinned PoB commit: ${upstream.sha}`);
  console.log(`[sync] Pinned GGG tree export: ${ggg.sha}`);

  const start = performance.now();

  // Tree + tree art come from GGG's official export (so we can track 0.5 before
  // PoB publishes its conversion). Geometry constants are carried from PoB's
  // last export. Gems/bases/uniques/stats remain PoB Lua catalogs.
  const constants = await fetchTreeConstants(upstream);
  const tree = await timed("tree", () => syncTree(ggg, constants));
  await writeJson("data/tree.json", tree);

  const treeArt = await timed("tree-art", () => syncTreeArt(ggg));
  console.log(`        icons=${treeArt.iconCount} frames=${treeArt.frameCount}`);
  logIconCoverage(treeArt.manifest, tree.nodes);

  const gems = await timed("gems", () => syncGems(upstream));
  await writeJson("data/gems.json", gems);
  console.log(`        active=${Object.keys(gems.active).length} support=${Object.keys(gems.support).length}`);

  const bases = await timed("bases", () => syncBases(upstream));
  await writeJson("data/bases.json", bases);
  console.log(`        bases=${Object.keys(bases.bases).length} slots=${Object.keys(bases.bySlot).length}`);

  const uniques = await timed("uniques", () => syncUniques(upstream));
  await writeJson("data/uniques.json", uniques);
  console.log(`        uniques=${Object.keys(uniques.uniques).length} slots=${Object.keys(uniques.bySlot).length}`);

  const stats = await timed("stat-descriptions", () => syncStatDescriptions(upstream));
  await writeJson("data/stat-descriptions.json", stats);
  console.log(`        entries=${stats.entries.length} stats=${Object.keys(stats.byStat).length}`);

  const meta = {
    pobCommit: upstream.sha,
    gggTreeCommit: ggg.sha,
    treeVersion: tree.version.treeVersion,
    fetchedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    files: {
      "tree.json": { nodes: Object.keys(tree.nodes).length, groups: tree.groups.length },
      "tree-art.json": { icons: treeArt.iconCount, frames: treeArt.frameCount },
      "gems.json": { active: Object.keys(gems.active).length, support: Object.keys(gems.support).length },
      "bases.json": { bases: Object.keys(bases.bases).length, slots: Object.keys(bases.bySlot).length },
      "uniques.json": { uniques: Object.keys(uniques.uniques).length, slots: Object.keys(uniques.bySlot).length },
      "stat-descriptions.json": { entries: stats.entries.length, stats: Object.keys(stats.byStat).length },
    },
  };
  await writeJson("data/_meta.json", meta);

  const totalMs = (performance.now() - start).toFixed(0);
  console.log(`[sync] Done in ${totalMs}ms`);
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  const out = await fn();
  console.log(`  ✓ ${label} (${(performance.now() - t).toFixed(0)}ms)`);
  return out;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value, sortReplacer(value), 2);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json + "\n");
}

function sortReplacer(_root: unknown) {
  return function replacer(_key: string, value: unknown) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
      return sorted;
    }
    return value;
  };
}

main().catch((err) => {
  console.error("[sync] FAILED:", err);
  process.exit(1);
});
