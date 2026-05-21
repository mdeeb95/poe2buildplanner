import { nodeRadius } from "./node-style";
import type { Tree, TreeNode } from "@/schemas/tree";

/**
 * JS hit-testing for passive nodes. Replaces the per-node transparent SVG hit
 * circles (~4.7k elements) with a uniform-grid lookup so the tree can render
 * its dots on a canvas without any per-node DOM.
 */

const HIT_PAD = 14;
const HIT_SCALE = 1.4;
const HIT_MIN = 30;

/** Click/hover target radius in tree units (generous — matches the old SVG hit circles). */
export function nodeHitRadius(node: TreeNode): number {
  return Math.max(nodeRadius(node) + HIT_PAD, HIT_MIN) * HIT_SCALE;
}

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface NodeHitIndex {
  cell: number;
  buckets: Map<string, PlacedNode[]>;
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function buildNodeHitIndex(tree: Tree): NodeHitIndex {
  const placed: PlacedNode[] = [];
  let maxR = 1;
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    const r = nodeHitRadius(node);
    if (r > maxR) maxR = r;
    placed.push({ id, x: node.x, y: node.y, r });
  }

  // Cell size >= the largest hit radius guarantees any hit only reaches into the
  // 8 neighboring cells, so a 3x3 query around the cursor is exhaustive.
  const cell = maxR;
  const buckets = new Map<string, PlacedNode[]>();
  for (const p of placed) {
    const k = cellKey(Math.floor(p.x / cell), Math.floor(p.y / cell));
    const arr = buckets.get(k);
    if (arr) arr.push(p);
    else buckets.set(k, [p]);
  }
  return { cell, buckets };
}

/** Returns the id of the closest node whose hit radius contains (x, y), or null. */
export function nodeAt(index: NodeHitIndex, x: number, y: number): string | null {
  const { cell, buckets } = index;
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  let best: string | null = null;
  let bestD = Infinity;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const arr = buckets.get(cellKey(gx, gy));
      if (!arr) continue;
      for (const p of arr) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= p.r * p.r && d2 < bestD) {
          bestD = d2;
          best = p.id;
        }
      }
    }
  }
  return best;
}
