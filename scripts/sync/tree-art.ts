import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  TreeArtManifestSchema,
  type TreeArtManifest,
} from "../../src/schemas/tree-art.js";
import type { Upstream } from "./fetch.js";

const TREE_VERSION = "0_5";

// GGG packs skill icons into one sprite sheet with three uniform tiers (by node
// kind). Each tier becomes one uniform-grid atlas in our manifest. The icon art
// is identical across tiers, so a path that appears in several tiers resolves to
// the highest-resolution one (keystone > notable > normal).
const ICON_TIERS = [
  { state: "normalActive", atlas: "skills_normal" },
  { state: "notableActive", atlas: "skills_notable" },
  { state: "keystoneActive", atlas: "skills_keystone" },
] as const;
const ATLAS_COLS = 16;

// Frame ring sprites per node kind × allocation state. Names index frame.json.
const NODE_OVERLAY: TreeArtManifest["nodeOverlay"] = {
  Normal: { unalloc: "PSSkillFrame", path: "PSSkillFrameHighlighted", alloc: "PSSkillFrameActive" },
  Notable: {
    unalloc: "NotableFrameUnallocated",
    path: "NotableFrameCanAllocate",
    alloc: "NotableFrameAllocated",
  },
  Keystone: {
    unalloc: "KeystoneFrameUnallocated",
    path: "KeystoneFrameCanAllocate",
    alloc: "KeystoneFrameAllocated",
  },
  Socket: {
    unalloc: "JewelFrameUnallocated",
    path: "JewelFrameCanAllocate",
    alloc: "JewelFrameAllocated",
  },
};

interface SpriteSheet {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
}

export interface TreeArtSyncResult {
  manifest: TreeArtManifest;
  iconCount: number;
  frameCount: number;
}

export async function syncTreeArt(upstream: Upstream): Promise<TreeArtSyncResult> {
  await mkdir("public/tree/frames", { recursive: true });

  const skillsSheet = await loadSheet(upstream, "assets/skills.json");
  const skillsImg = await upstream.fetchFile("assets/skills.webp");

  const { atlases, icons } = await buildIconAtlases(skillsSheet, skillsImg);
  const frames = await buildFrames(upstream);

  const manifest: TreeArtManifest = {
    version: {
      pobCommit: upstream.sha,
      treeVersion: TREE_VERSION,
      fetchedAt: new Date().toISOString(),
    },
    atlases,
    icons,
    frames,
    nodeOverlay: NODE_OVERLAY,
  };

  TreeArtManifestSchema.parse(manifest);
  await writeFile("data/tree-art.json", JSON.stringify(manifest, null, 2) + "\n");

  return {
    manifest,
    iconCount: Object.keys(icons).length,
    frameCount: Object.keys(frames).length,
  };
}

/** Re-pack GGG's irregular icon sheet into uniform-grid atlases by tier. */
async function buildIconAtlases(
  sheet: SpriteSheet,
  image: Buffer,
): Promise<{ atlases: TreeArtManifest["atlases"]; icons: TreeArtManifest["icons"] }> {
  const atlases: TreeArtManifest["atlases"] = {};
  const icons: TreeArtManifest["icons"] = {};

  for (const tier of ICON_TIERS) {
    const prefix = `${tier.state}:`;
    const entries = Object.entries(sheet.frames)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, val]) => ({ iconPath: key.slice(prefix.length), ...val.frame }));
    if (entries.length === 0) continue;

    const cellW = Math.max(...entries.map((e) => e.w));
    const cellH = Math.max(...entries.map((e) => e.h));
    const cols = ATLAS_COLS;
    const rows = Math.ceil(entries.length / cols);

    const composites = await Promise.all(
      entries.map(async (e, i) => ({
        input: await sharp(image)
          .extract({ left: e.x, top: e.y, width: e.w, height: e.h })
          .png()
          .toBuffer(),
        left: (i % cols) * cellW,
        top: Math.floor(i / cols) * cellH,
      })),
    );

    const file = `/tree/${tier.atlas.replace(/_/g, "-")}.webp`;
    await sharp({
      create: {
        width: cols * cellW,
        height: rows * cellH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      // Lossless — lossy webp bleeds between atlas cells and shows wrong icons.
      .webp({ lossless: true })
      .toFile(`public${file}`);

    atlases[tier.atlas] = { file, cellW, cellH, cols, count: entries.length };
    entries.forEach((e, i) => {
      // 1-based index; later (higher-res) tiers overwrite shared icon paths.
      icons[e.iconPath] = { atlas: tier.atlas, index: i + 1 };
    });
  }

  return { atlases, icons };
}

/** Extract the frame rings referenced by nodeOverlay into individual webp files. */
async function buildFrames(upstream: Upstream): Promise<TreeArtManifest["frames"]> {
  const sheet = await loadSheet(upstream, "assets/frame.json");
  const image = await upstream.fetchFile("assets/frame.webp");

  const wanted = new Set<string>();
  for (const overlay of Object.values(NODE_OVERLAY)) {
    wanted.add(overlay.unalloc);
    wanted.add(overlay.path);
    wanted.add(overlay.alloc);
  }

  const frames: TreeArtManifest["frames"] = {};
  for (const name of [...wanted].sort()) {
    const rect = sheet.frames[`frame:${name}`]?.frame;
    if (!rect) {
      console.warn(`        [tree-art] frame not found in GGG sheet: ${name}`);
      continue;
    }
    const outName = `${name}.webp`;
    await sharp(image)
      .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
      .webp({ quality: 90 })
      .toFile(path.join("public/tree/frames", outName));
    frames[name] = { file: `/tree/frames/${outName}`, w: rect.w, h: rect.h };
  }
  return frames;
}

async function loadSheet(upstream: Upstream, file: string): Promise<SpriteSheet> {
  const text = await upstream.fetchFileAsString(file);
  return JSON.parse(text) as SpriteSheet;
}

/** Log icon coverage against tree.json nodes. */
export function logIconCoverage(
  manifest: TreeArtManifest,
  treeNodes: Record<string, { icon?: string | null }>,
): void {
  let withIcon = 0;
  let mapped = 0;
  const misses: string[] = [];

  for (const node of Object.values(treeNodes)) {
    if (!node.icon) continue;
    withIcon++;
    if (manifest.icons[node.icon]) mapped++;
    else if (misses.length < 5) misses.push(node.icon);
  }

  const pct = withIcon ? ((mapped / withIcon) * 100).toFixed(1) : "100.0";
  console.log(`        tree-art icons: ${mapped}/${withIcon} mapped (${pct}%)`);
  if (misses.length) console.log(`        sample misses: ${misses.join(", ")}`);
}
