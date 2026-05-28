import type { OutEdge, TreeNode } from "@/schemas/tree.js";

// Radius mismatch tolerance for treating an edge as an arc: both endpoints must
// sit within this fraction of the same radius around the given arc centre.
const ARC_TOL = 0.14;

/**
 * Returns an SVG path-data fragment (starting with M) for a single edge, or
 * null if either node is un-positioned.
 *
 * GGG's edge export gives the arc centre (arcX/arcY) for orbit-following
 * connectors. When present and both endpoints lie on a common circle around it,
 * we emit the short arc; otherwise a straight line.
 */
export function buildConnectorPath(
  a: TreeNode,
  b: TreeNode,
  edge: Pick<OutEdge, "orbit" | "arcX" | "arcY">,
): string | null {
  if (a.group === null || b.group === null) return null;

  if (edge.orbit && edge.arcX != null && edge.arcY != null) {
    const cx = edge.arcX;
    const cy = edge.arcY;
    const r = Math.hypot(a.x - cx, a.y - cy);
    const r2 = Math.hypot(b.x - cx, b.y - cy);
    if (r > 1 && Math.abs(r2 - r) / r < ARC_TOL) {
      const θa = Math.atan2(a.y - cy, a.x - cx);
      const θb = Math.atan2(b.y - cy, b.x - cx);
      let delta = θb - θa;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      if (Math.abs(delta) > 0.001) {
        // y-down screen space: positive angular delta sweeps clockwise = flag 1.
        const sweep = delta >= 0 ? "1" : "0";
        return `M${num(a.x)} ${num(a.y)}A${num(r)} ${num(r)} 0 0 ${sweep} ${num(b.x)} ${num(b.y)}`;
      }
    }
  }

  return `M${num(a.x)} ${num(a.y)}L${num(b.x)} ${num(b.y)}`;
}

function num(n: number): string {
  return n.toFixed(2);
}
