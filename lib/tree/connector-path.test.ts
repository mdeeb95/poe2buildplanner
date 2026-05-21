import { describe, expect, it } from "vitest";
import type { TreeConstants, TreeNode } from "@/schemas/tree.js";
import { buildConnectorPath } from "./connector-path.js";

// Mini fixture mirroring real tree.json constants (orbit 1 = 12 slots, r=82).
const CONSTANTS: TreeConstants = {
  PSSCentreInnerRadius: 130,
  orbitRadii: [0, 82, 162, 335, 493, 662, 846, 251, 1080, 1322],
  skillsPerOrbit: [1, 12, 24, 24, 72, 72, 72, 24, 72, 144],
  orbitAnglesByOrbit: [
    [0],
    [
      0,
      Math.PI / 6,
      Math.PI / 3,
      Math.PI / 2,
      (2 * Math.PI) / 3,
      (5 * Math.PI) / 6,
      Math.PI,
      (7 * Math.PI) / 6,
      (4 * Math.PI) / 3,
      (3 * Math.PI) / 2,
      (5 * Math.PI) / 3,
      (11 * Math.PI) / 6,
    ],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ],
};

const GROUPS = [
  { x: 0, y: 0, orbits: [1], nodes: ["a", "b", "c", "d"] },
  { x: 1000, y: 0, orbits: [1], nodes: ["e"] },
];

// Extracts the SVG arc sweep-flag from a path like "M… A rx ry rot large sweep x y".
// Splits on whitespace and reads the 5th token after the "A" command.
function sweepFlag(d: string): "0" | "1" {
  const m = d.match(/A([^ML]+)/);
  if (!m) throw new Error(`no arc command in path: ${d}`);
  const parts = m[1]!.trim().split(/\s+/);
  // parts = [rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y]
  const sweep = parts[4];
  if (sweep !== "0" && sweep !== "1") throw new Error(`unexpected sweep: ${sweep}`);
  return sweep;
}

function node(opts: Partial<TreeNode> & Pick<TreeNode, "x" | "y" | "group" | "orbit" | "orbitIndex">): TreeNode {
  return {
    skill: 0,
    name: "test",
    icon: null,
    isNotable: false,
    isKeystone: false,
    isJewelSocket: false,
    ascendancyName: null,
    classesStart: null,
    stats: [],
    out: [],
    neighbors: [],
    ...opts,
  };
}

describe("buildConnectorPath", () => {
  it("returns null when either node has no group", () => {
    const a = node({ x: 0, y: 0, group: null, orbit: null, orbitIndex: null });
    const b = node({ x: 82, y: 0, group: 0, orbit: 1, orbitIndex: 3 });
    expect(buildConnectorPath(a, b, null, CONSTANTS, GROUPS)).toBeNull();
    expect(buildConnectorPath(b, a, null, CONSTANTS, GROUPS)).toBeNull();
  });

  it("emits a straight line for edgeOrbit=null across different groups", () => {
    const a = node({ x: 0, y: 0, group: 0, orbit: 1, orbitIndex: 0 });
    const b = node({ x: 1000, y: 0, group: 1, orbit: 1, orbitIndex: 0 });
    const d = buildConnectorPath(a, b, null, CONSTANTS, GROUPS);
    expect(d).toBe("M0.00 0.00L1000.00 0.00");
  });

  it("emits same-orbit-same-group arc with sweep=1 going 12→3 o'clock (clockwise short way)", () => {
    // orbit 1, r=82, group at (0,0). orbitIndex 0 = 12 o'clock = (0, -82).
    // orbitIndex 3 = 3 o'clock = (82, 0). Short way is CW = sweep flag 1.
    const a = node({ x: 0, y: -82, group: 0, orbit: 1, orbitIndex: 0 });
    const b = node({ x: 82, y: 0, group: 0, orbit: 1, orbitIndex: 3 });
    const d = buildConnectorPath(a, b, null, CONSTANTS, GROUPS);
    expect(d).toBe("M0.00 -82.00A82.00 82.00 0 0 1 82.00 0.00");
  });

  it("emits same-orbit-same-group arc with sweep=0 going 3→12 o'clock (CCW short way)", () => {
    const a = node({ x: 82, y: 0, group: 0, orbit: 1, orbitIndex: 3 });
    const b = node({ x: 0, y: -82, group: 0, orbit: 1, orbitIndex: 0 });
    const d = buildConnectorPath(a, b, null, CONSTANTS, GROUPS);
    expect(d).toBe("M82.00 0.00A82.00 82.00 0 0 0 0.00 -82.00");
  });

  it("emits cross-orbit arc with positive edgeOrbit", () => {
    // Two nodes at (0,0) and (100,0). With edgeOrbit=2 (r=162), they sit on a
    // circle whose center is perpendicular-offset above/below the chord midpoint.
    // The sign of edgeOrbit decides which side.
    const a = node({ x: 0, y: 0, group: 0, orbit: 0, orbitIndex: 0 });
    const b = node({ x: 100, y: 0, group: 1, orbit: 0, orbitIndex: 0 });
    const d = buildConnectorPath(a, b, 2, CONSTANTS, GROUPS);
    expect(d).toMatch(/^M0\.00 0\.00A162\.00 162\.00 0 0 [01] 100\.00 0\.00$/);
  });

  it("cross-orbit arc with opposite-sign edgeOrbit flips sweep direction", () => {
    const a = node({ x: 0, y: 0, group: 0, orbit: 0, orbitIndex: 0 });
    const b = node({ x: 100, y: 0, group: 1, orbit: 0, orbitIndex: 0 });
    const dPos = buildConnectorPath(a, b, 2, CONSTANTS, GROUPS)!;
    const dNeg = buildConnectorPath(a, b, -2, CONSTANTS, GROUPS)!;
    expect(sweepFlag(dPos)).not.toBe(sweepFlag(dNeg));
  });

  it("falls back to straight line when cross-orbit chord exceeds 2r", () => {
    // edgeOrbit=1, r=82. Chord of 1000 >> 2*82 — no circle fits.
    const a = node({ x: 0, y: 0, group: 0, orbit: 0, orbitIndex: 0 });
    const b = node({ x: 1000, y: 0, group: 1, orbit: 0, orbitIndex: 0 });
    const d = buildConnectorPath(a, b, 1, CONSTANTS, GROUPS);
    expect(d).toBe("M0.00 0.00L1000.00 0.00");
  });

  it("falls back to straight line for edgeOrbit pointing at an undefined orbit slot", () => {
    const a = node({ x: 0, y: 0, group: 0, orbit: 0, orbitIndex: 0 });
    const b = node({ x: 50, y: 0, group: 1, orbit: 0, orbitIndex: 0 });
    const d = buildConnectorPath(a, b, 99, CONSTANTS, GROUPS);
    expect(d).toBe("M0.00 0.00L50.00 0.00");
  });

  it("falls back to straight line for same-orbit-same-group nodes when edgeOrbit is non-null (PoB skips the in-orbit branch)", () => {
    const a = node({ x: 0, y: -82, group: 0, orbit: 1, orbitIndex: 0 });
    const b = node({ x: 82, y: 0, group: 0, orbit: 1, orbitIndex: 3 });
    // Chord = sqrt(82² + 82²) ≈ 116. Cross-orbit branch requires chord ≤ 2r.
    // edgeOrbit=1 gives r=82, 2r=164, so the cross-orbit arc branch applies.
    const d = buildConnectorPath(a, b, 1, CONSTANTS, GROUPS)!;
    // Should be an arc with r=82 (from cross-orbit branch), not the orbit-1 r=82 group arc.
    expect(d).toMatch(/^M0\.00 -82\.00A82\.00 82\.00 0 0 [01] 82\.00 0\.00$/);
  });
});
