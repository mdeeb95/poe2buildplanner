import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { decompress } from "fzstd";
import sharp from "sharp";
import {
  TreeArtManifestSchema,
  type TreeArtManifest,
} from "../../src/schemas/tree-art.js";
import { decodeDdsSlice, parseDdsTextureArray } from "./dds-texture-array.js";
import type { Upstream } from "./fetch.js";

const TREE_VERSION = "0_4";
const TREE_DATA_PREFIX = `src/TreeData/${TREE_VERSION}`;
const SKILLS_ATLASES = [
  { key: "skills_64", pobFile: "skills_64_64_BC1.dds.zst", cols: 16 },
  { key: "skills_128", pobFile: "skills_128_128_BC1.dds.zst", cols: 16 },
] as const;

interface RawTreeJson {
  ddsCoords?: Record<string, Record<string, number>>;
  nodeOverlay?: Record<string, { alloc: string; path: string; unalloc: string }>;
}

interface FrameSource {
  name: string;
  pobFile: string;
  index: number;
}

export interface TreeArtSyncResult {
  manifest: TreeArtManifest;
  iconCount: number;
  frameCount: number;
}

export async function syncTreeArt(upstream: Upstream): Promise<TreeArtSyncResult> {
  const rawText = await upstream.fetchFileAsString(`${TREE_DATA_PREFIX}/tree.json`);
  const raw = JSON.parse(rawText) as RawTreeJson;

  await mkdir("public/tree/frames", { recursive: true });

  const icons: TreeArtManifest["icons"] = {};
  for (const spec of SKILLS_ATLASES) {
    const coords = raw.ddsCoords?.[spec.pobFile];
    if (!coords) continue;
    for (const [iconPath, index] of Object.entries(coords)) {
      icons[iconPath] = { atlas: spec.key, index };
    }
  }

  const frameSources = collectFrameSources(raw);
  const frames: TreeArtManifest["frames"] = {};

  for (const src of frameSources) {
    const dds = await loadDdsZst(upstream, `${TREE_DATA_PREFIX}/${src.pobFile}`);
    const meta = parseDdsTextureArray(dds);
    const rgba = decodeDdsSlice(dds, meta, src.index);
    const outName = `${src.name}.webp`;
    const outPath = path.join("public/tree/frames", outName);
    await sharp(Buffer.from(rgba), {
      raw: { width: meta.width, height: meta.height, channels: 4 },
    })
      .webp({ quality: 90 })
      .toFile(outPath);
    frames[src.name] = { file: `/tree/frames/${outName}`, w: meta.width, h: meta.height };
  }

  const atlases: TreeArtManifest["atlases"] = {};
  for (const spec of SKILLS_ATLASES) {
    atlases[spec.key] = await buildSkillsAtlas(upstream, spec);
  }

  const manifest: TreeArtManifest = {
    version: {
      pobCommit: upstream.sha,
      treeVersion: TREE_VERSION,
      fetchedAt: new Date().toISOString(),
    },
    atlases,
    icons,
    frames,
    nodeOverlay: raw.nodeOverlay ?? {},
  };

  TreeArtManifestSchema.parse(manifest);
  await writeFile("data/tree-art.json", JSON.stringify(manifest, null, 2) + "\n");

  return {
    manifest,
    iconCount: Object.keys(icons).length,
    frameCount: Object.keys(frames).length,
  };
}

function collectFrameSources(raw: RawTreeJson): FrameSource[] {
  const names = new Set<string>();
  for (const overlay of Object.values(raw.nodeOverlay ?? {})) {
    names.add(overlay.alloc);
    names.add(overlay.path);
    names.add(overlay.unalloc);
  }

  const out: FrameSource[] = [];
  for (const name of names) {
    for (const [pobFile, coords] of Object.entries(raw.ddsCoords ?? {})) {
      if (!pobFile.startsWith("group-background_")) continue;
      const index = coords[name];
      if (index === undefined) continue;
      out.push({ name, pobFile, index });
      break;
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadDdsZst(upstream: Upstream, pobPath: string): Promise<Buffer> {
  const zst = await upstream.fetchFile(pobPath);
  return Buffer.from(decompress(new Uint8Array(zst)));
}

async function buildSkillsAtlas(
  upstream: Upstream,
  spec: (typeof SKILLS_ATLASES)[number],
): Promise<TreeArtManifest["atlases"][string]> {
  const dds = await loadDdsZst(upstream, `${TREE_DATA_PREFIX}/${spec.pobFile}`);
  const meta = parseDdsTextureArray(dds);
  const cols = spec.cols;
  const rows = Math.ceil(meta.arraySize / cols);
  const atlasW = meta.width * cols;
  const atlasH = meta.height * rows;

  const canvas = Buffer.alloc(atlasW * atlasH * 4, 0);

  for (let slice = 0; slice < meta.arraySize; slice++) {
    const rgba = decodeDdsSlice(dds, meta, slice + 1);
    const col = slice % cols;
    const row = Math.floor(slice / cols);
    const dstX = col * meta.width;
    const dstY = row * meta.height;
    for (let y = 0; y < meta.height; y++) {
      const srcOff = y * meta.width * 4;
      const dstOff = ((dstY + y) * atlasW + dstX) * 4;
      canvas.set(rgba.subarray(srcOff, srcOff + meta.width * 4), dstOff);
    }
  }

  const outPath = `public/tree/${spec.key.replace("_", "-")}.webp`;
  await mkdir(path.dirname(outPath), { recursive: true });
  // Lossless — lossy webp bleeds between atlas cells and shows wrong icons.
  await sharp(canvas, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .webp({ lossless: true })
    .toFile(outPath);

  return {
    file: `/tree/${spec.key.replace("_", "-")}.webp`,
    cellW: meta.width,
    cellH: meta.height,
    cols,
    count: meta.arraySize,
  };
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
