import type { TreeConstants, TreeGroup, TreeNode } from "@/schemas/tree.js";

/**
 * Port of PathOfBuilding-PoE2's PassiveTree.lua:BuildConnector (lines 563-678).
 *
 * Returns an SVG path-data fragment (starting with M) for a single edge, or
 * null if either node is un-positioned. Caller concatenates fragments into a
 * single <path d="…">.
 *
 * Branches, in order:
 *   1. Either group is null                                   → null
 *   2. Same group, same orbit, edgeOrbit null                 → arc on group
 *   3. edgeOrbit non-null and a circle through both fits      → arc on derived center
 *   4. Default                                                → straight line
 */
export function buildConnectorPath(
  a: TreeNode,
  b: TreeNode,
  edgeOrbit: number | null,
  constants: TreeConstants,
  _groups: ReadonlyArray<TreeGroup | null>,
): string | null {
  if (a.group === null || b.group === null) return null;

  // Same-orbit-same-group arc (PoB branch 2).
  if (
    a.group === b.group &&
    a.orbit !== null &&
    b.orbit !== null &&
    a.orbit === b.orbit &&
    a.orbitIndex !== null &&
    b.orbitIndex !== null &&
    edgeOrbit === null
  ) {
    const orbit = a.orbit;
    const r = constants.orbitRadii[orbit];
    const angles = constants.orbitAnglesByOrbit[orbit];
    if (r !== undefined && angles !== undefined) {
      const θa = angles[a.orbitIndex];
      const θb = angles[b.orbitIndex];
      if (typeof r === "number" && typeof θa === "number" && typeof θb === "number") {
        return arcPath(a.x, a.y, b.x, b.y, r, θa, θb);
      }
    }
  }

  // Cross-orbit arc (PoB branch 1).
  if (edgeOrbit !== null) {
    const orbitAbs = Math.abs(edgeOrbit);
    const r = constants.orbitRadii[orbitAbs];
    if (typeof r === "number" && r > 0) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const chord = Math.hypot(dx, dy);
      if (chord > 0 && chord <= 2 * r) {
        const perpLen = Math.sqrt(r * r - (chord * chord) / 4);
        const sign = edgeOrbit > 0 ? 1 : -1;
        const cx = a.x + dx / 2 + sign * perpLen * (dy / chord);
        const cy = a.y + dy / 2 - sign * perpLen * (dx / chord);
        // Re-derive angles around the computed center, then sweep the short way.
        const θa = Math.atan2(a.y - cy, a.x - cx);
        const θb = Math.atan2(b.y - cy, b.x - cx);
        return arcByCenter(a.x, a.y, b.x, b.y, r, θa, θb);
      }
    }
  }

  // Straight line (PoB branch 3).
  return `M${num(a.x)} ${num(a.y)}L${num(b.x)} ${num(b.y)}`;
}

/**
 * Arc emitted from a's screen position to b's, using the shorter-way sweep
 * implied by the angular delta between the two source angles (measured at the
 * implicit arc center). Both endpoints are assumed to already be at distance r
 * from that center; we only need the angles to decide sweep direction.
 */
function arcPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  θa: number,
  θb: number,
): string {
  const sweep = shortSweepFlag(θa, θb);
  return `M${num(ax)} ${num(ay)}A${num(r)} ${num(r)} 0 0 ${sweep} ${num(bx)} ${num(by)}`;
}

/**
 * Same shape as arcPath but uses arctangent-derived angles around a derived
 * arc center (used by the cross-orbit branch where the center isn't a group).
 */
function arcByCenter(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  θa: number,
  θb: number,
): string {
  return arcPath(ax, ay, bx, by, r, θa, θb);
}

/**
 * Returns SVG sweep-flag ("0" | "1") choosing the shorter arc from θa to θb.
 * Works in PoB's screen-space angle convention: in our coordinate system
 * (y-down), increasing angle moves clockwise, which matches SVG sweep-flag=1.
 */
function shortSweepFlag(θa: number, θb: number): "0" | "1" {
  let delta = θb - θa;
  // Normalize to (-π, π]
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  return delta >= 0 ? "1" : "0";
}

function num(n: number): string {
  return n.toFixed(2);
}
