import type { TreeArtManifest } from "@/schemas/tree-art";
import type { TreeNode } from "@/schemas/tree";

export interface SpriteRect {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  atlasW: number;
  atlasH: number;
}

export type FrameState = "unalloc" | "path" | "alloc";

/** Canvas filter + opacity per allocation state (drawn back-to-front: unalloc → path → alloc). */
export const NODE_ART_STYLES: Record<FrameState, { filter: string; alpha: number }> = {
  unalloc: { filter: "saturate(0.5) brightness(0.82)", alpha: 0.72 },
  path: { filter: "saturate(0.82) brightness(0.94)", alpha: 0.9 },
  alloc: { filter: "none", alpha: 1 },
};

export const NODE_ART_DRAW_ORDER: readonly FrameState[] = ["unalloc", "path", "alloc"];

export type NodeOverlayKind = "Normal" | "Notable" | "Keystone" | "Socket";

const ART_ZOOM_MIN = 0.75;

/** Multiplier for on-tree icon + frame ring size (1 ≈ original web renderer). */
export const ART_NODE_SCALE = 2;

const ICON_SIZE_FACTOR = 1.85;
const FRAME_SIZE_FACTOR = 2.4;

export function artZoomEnabled(scale: number): boolean {
  return scale >= ART_ZOOM_MIN;
}

export function iconSprite(
  icon: string | null,
  art: TreeArtManifest | null,
): SpriteRect | null {
  if (!icon || !art) return null;
  const ref = art.icons[icon];
  if (!ref) return null;
  const atlas = art.atlases[ref.atlas];
  if (!atlas) return null;

  const slice = ref.index - 1;
  const col = slice % atlas.cols;
  const row = Math.floor(slice / atlas.cols);
  const rows = Math.ceil(atlas.count / atlas.cols);

  return {
    href: atlas.file,
    x: col * atlas.cellW,
    y: row * atlas.cellH,
    w: atlas.cellW,
    h: atlas.cellH,
    atlasW: atlas.cols * atlas.cellW,
    atlasH: rows * atlas.cellH,
  };
}

export function overlayKindFor(node: TreeNode): NodeOverlayKind | null {
  if (node.classesStart && node.classesStart.length > 0) return null;
  if (node.isKeystone) return "Keystone";
  if (node.isJewelSocket) return "Socket";
  if (node.isNotable) return "Notable";
  return "Normal";
}

export function frameStateFor(
  nodeId: string,
  allocated: ReadonlySet<string>,
  frontier: ReadonlySet<string>,
): FrameState {
  if (allocated.has(nodeId)) return "alloc";
  if (frontier.has(nodeId)) return "path";
  return "unalloc";
}

export function frameSprite(
  node: TreeNode,
  art: TreeArtManifest | null,
  state: FrameState,
): SpriteRect | null {
  if (!art) return null;
  const kind = overlayKindFor(node);
  if (!kind) return null;
  const overlay = art.nodeOverlay[kind];
  if (!overlay) return null;

  const assetName = overlay[state];
  const frame = art.frames[assetName];
  if (!frame) return null;

  return {
    href: frame.file,
    x: 0,
    y: 0,
    w: frame.w,
    h: frame.h,
    atlasW: frame.w,
    atlasH: frame.h,
  };
}

export function visualRadius(node: TreeNode): number {
  if (node.classesStart && node.classesStart.length > 0) return 50;
  if (node.isKeystone) return 40;
  if (node.isJewelSocket) return 32;
  if (node.isNotable) return 26;
  return 14;
}

/** Display size for frame rings in tree units. */
export function artDisplaySize(node: TreeNode, sprite: SpriteRect): number {
  const r = visualRadius(node);
  const target = r * FRAME_SIZE_FACTOR * ART_NODE_SCALE;
  const scale = target / Math.max(sprite.w, sprite.h);
  return Math.max(sprite.w, sprite.h) * scale;
}

/** Display size for skill icons in tree units. */
export function artIconDisplaySize(node: TreeNode): number {
  return visualRadius(node) * ICON_SIZE_FACTOR * ART_NODE_SCALE;
}
