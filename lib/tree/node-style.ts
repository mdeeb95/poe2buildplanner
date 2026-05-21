import type { TreeNode } from "@/schemas/tree";

/**
 * Single source of truth for passive-node visual size and color, shared by the
 * SVG overlays (active / frontier / preview / search / hover) and the canvas
 * renderer so they can't drift apart on radii or fills.
 *
 * Radii are in tree-space units (the same space node.x / node.y live in).
 */

export function nodeRadius(node: TreeNode): number {
  if (node.classesStart && node.classesStart.length > 0) return 50;
  if (node.isKeystone) return 40;
  if (node.isJewelSocket) return 32;
  if (node.isNotable) return 26;
  return 14; // normal + ascendancy
}

export function nodeFill(node: TreeNode): string {
  if (node.classesStart && node.classesStart.length > 0) return "var(--color-node-class-start)";
  if (node.isKeystone) return "var(--color-node-keystone)";
  if (node.isJewelSocket) return "var(--color-node-jewel)";
  if (node.isNotable) return "var(--color-node-notable)";
  if (node.ascendancyName) return "var(--color-node-ascendancy)";
  return "var(--color-node-normal)";
}
