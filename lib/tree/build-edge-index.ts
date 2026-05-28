import { buildConnectorPath } from "./connector-path";
import type { Tree } from "@/schemas/tree";

export interface EdgeRecord {
  /** SVG path fragment starting with M, ready to concatenate into a single `<path d>`. */
  readonly fragment: string;
  /** Source node id (the node that lists this edge in its `out`). */
  readonly a: string;
  /** Target node id. */
  readonly b: string;
}

/**
 * Walks every node's `out` edges, applies the ascendancy↔main-tree filter,
 * and returns one record per rendered edge with its precomputed SVG fragment
 * and both endpoint ids. Computed once per tree; consumed by both
 * `<TreeEdges>` (base layer) and `<TreeEdgesActive>` (allocated overlay).
 */
export function buildEdgeIndex(tree: Tree): EdgeRecord[] {
  const out: EdgeRecord[] = [];
  for (const [aId, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    for (const edge of node.out) {
      const other = tree.nodes[edge.id];
      if (!other) continue;
      // Hide ascendancy↔main-tree entry edges in the default view. PoB only
      // shows these when an ascendancy is active; for the catalog view they
      // visually cross the main tree and look like noise.
      const aIsAsc = node.ascendancyName !== null;
      const bIsAsc = other.ascendancyName !== null;
      if (aIsAsc !== bIsAsc) continue;
      const fragment = buildConnectorPath(node, other, edge);
      if (fragment === null) continue;
      out.push({ fragment, a: aId, b: edge.id });
    }
  }
  return out;
}
