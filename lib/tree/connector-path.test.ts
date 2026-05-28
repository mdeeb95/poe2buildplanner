import { describe, expect, it } from "vitest";
import type { OutEdge, TreeNode } from "@/schemas/tree.js";
import { buildConnectorPath } from "./connector-path.js";

// Extracts the SVG arc sweep-flag from a path like "M… A rx ry rot large sweep x y".
function sweepFlag(d: string): "0" | "1" {
  const m = d.match(/A([^ML]+)/);
  if (!m) throw new Error(`no arc command in path: ${d}`);
  const parts = m[1]!.trim().split(/\s+/);
  const sweep = parts[4];
  if (sweep !== "0" && sweep !== "1") throw new Error(`unexpected sweep: ${sweep}`);
  return sweep;
}

function node(opts: Partial<TreeNode> & Pick<TreeNode, "x" | "y" | "group">): TreeNode {
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
    orbit: 0,
    orbitIndex: 0,
    out: [],
    neighbors: [],
    ...opts,
  };
}

function edge(opts: Partial<OutEdge> = {}): OutEdge {
  return { id: "x", orbit: null, arcX: null, arcY: null, ...opts };
}

describe("buildConnectorPath", () => {
  it("returns null when either node has no group", () => {
    const a = node({ x: 0, y: 0, group: null });
    const b = node({ x: 82, y: 0, group: 0 });
    expect(buildConnectorPath(a, b, edge())).toBeNull();
    expect(buildConnectorPath(b, a, edge())).toBeNull();
  });

  it("emits a straight line when the edge has no arc centre", () => {
    const a = node({ x: 0, y: 0, group: 0 });
    const b = node({ x: 1000, y: 0, group: 1 });
    expect(buildConnectorPath(a, b, edge({ orbit: null }))).toBe("M0.00 0.00L1000.00 0.00");
  });

  it("emits a straight line when orbit is set but no centre is given", () => {
    const a = node({ x: 0, y: 0, group: 0 });
    const b = node({ x: 1000, y: 0, group: 1 });
    expect(buildConnectorPath(a, b, edge({ orbit: 2 }))).toBe("M0.00 0.00L1000.00 0.00");
  });

  it("emits an arc around the given centre with radius = distance to centre", () => {
    // Centre at origin, both endpoints at radius 82: 12 o'clock -> 3 o'clock.
    const a = node({ x: 0, y: -82, group: 0 });
    const b = node({ x: 82, y: 0, group: 0 });
    const d = buildConnectorPath(a, b, edge({ orbit: 1, arcX: 0, arcY: 0 }));
    expect(d).toBe("M0.00 -82.00A82.00 82.00 0 0 1 82.00 0.00");
  });

  it("flips the sweep flag when traversed in the opposite direction", () => {
    const a = node({ x: 0, y: -82, group: 0 });
    const b = node({ x: 82, y: 0, group: 0 });
    const ab = buildConnectorPath(a, b, edge({ orbit: 1, arcX: 0, arcY: 0 }))!;
    const ba = buildConnectorPath(b, a, edge({ orbit: 1, arcX: 0, arcY: 0 }))!;
    expect(sweepFlag(ab)).not.toBe(sweepFlag(ba));
  });

  it("falls back to a straight line when endpoints are not on a common circle", () => {
    // a is at radius 82 from centre, b is far off it — radius mismatch > tolerance.
    const a = node({ x: 0, y: -82, group: 0 });
    const b = node({ x: 600, y: 0, group: 1 });
    const d = buildConnectorPath(a, b, edge({ orbit: 1, arcX: 0, arcY: 0 }));
    expect(d).toBe("M0.00 -82.00L600.00 0.00");
  });
});
