import { describe, expect, it } from "vitest";
import { createEmptyBuild } from "./defaults";
import { applyTreeAction } from "./allocation";
import { buildMainTreeAdjacency, findClassStartId } from "./reachability";
import { WEAPON_SET_MAX, nodeAllocState } from "./weapon-set";
import type { BuildState } from "@/schemas/build";
import type { Tree, TreeNode } from "@/schemas/tree";

interface NodeSpec {
  neighbors: string[];
  ascendancyName?: string | null;
  classesStart?: string[] | null;
}

function node(spec: NodeSpec): TreeNode {
  return {
    skill: 0,
    name: "n",
    icon: null,
    isNotable: false,
    isKeystone: false,
    isJewelSocket: false,
    ascendancyName: spec.ascendancyName ?? null,
    classesStart: spec.classesStart ?? null,
    stats: [],
    group: 0,
    orbit: 0,
    orbitIndex: 0,
    x: 0,
    y: 0,
    out: [],
    neighbors: spec.neighbors,
  };
}

function fixtureTree(): Tree {
  const nodes: Record<string, TreeNode> = {
    S: node({ neighbors: ["A", "ASC"], classesStart: ["Warrior"] }),
    A: node({ neighbors: ["S", "B"] }),
    B: node({ neighbors: ["A", "C"] }),
    C: node({ neighbors: ["B"] }),
    ASC: node({ neighbors: ["S"], ascendancyName: "Titan" }),
    D: node({ neighbors: ["E"] }), // disconnected island
    E: node({ neighbors: ["D"] }),
  };
  return {
    version: { pobCommit: "x".repeat(40), treeVersion: "0_4", fetchedAt: "2026-05-20T00:00:00.000Z" },
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    constants: { PSSCentreInnerRadius: 0, orbitRadii: [0], skillsPerOrbit: [1], orbitAnglesByOrbit: [[0]] },
    classes: [],
    groups: [{ x: 0, y: 0, orbits: [], nodes: [] }],
    nodes,
  };
}

const tree = fixtureTree();
const adj = buildMainTreeAdjacency(tree);
const startId = findClassStartId(tree, "Warrior"); // "S"

function freshBuild(): BuildState {
  return { ...createEmptyBuild(), className: "Warrior" };
}

describe("applyTreeAction — reachability", () => {
  it("blocks allocation when no class is chosen", () => {
    const r = applyTreeAction(tree, adj, null, freshBuild(), "A", "global", { toggle: true });
    expect(r.rejected).toBe("no-class");
    expect(r.build.allocated).toEqual([]);
  });

  it("auto-paths to a distant but connected node (smart allocate)", () => {
    // C is connected via S→A→B→C, just not adjacent → smart-allocate the path.
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "C", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated.sort()).toEqual(["A", "B", "C"]);
  });

  it("allows a node adjacent to the start, then extends outward", () => {
    let b = freshBuild();
    let r = applyTreeAction(tree, adj, startId, b, "A", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    b = r.build;
    expect(b.allocated).toContain("A");

    r = applyTreeAction(tree, adj, startId, b, "B", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    b = r.build;

    r = applyTreeAction(tree, adj, startId, b, "C", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated.sort()).toEqual(["A", "B", "C"]);
  });

  it("clicking the start node is a no-op", () => {
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "S", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated).toEqual([]);
  });
});

describe("applyTreeAction — deallocation cascade", () => {
  it("toggling off an interior node cascades the orphaned branch", () => {
    let b = freshBuild();
    for (const id of ["A", "B", "C"]) {
      b = applyTreeAction(tree, adj, startId, b, id, "global", { toggle: true }).build;
    }
    const r = applyTreeAction(tree, adj, startId, b, "A", "global", { toggle: true });
    expect(r.build.allocated).toEqual([]); // A off → B,C orphaned
  });

  it("toggling off a leaf removes only the leaf", () => {
    let b = freshBuild();
    for (const id of ["A", "B", "C"]) {
      b = applyTreeAction(tree, adj, startId, b, id, "global", { toggle: true }).build;
    }
    const r = applyTreeAction(tree, adj, startId, b, "C", "global", { toggle: true });
    expect(r.build.allocated.sort()).toEqual(["A", "B"]);
  });
});

describe("applyTreeAction — reassignment does not touch reachability", () => {
  it("reassigning an allocated node global→set1 keeps it and never rejects as unreachable", () => {
    let b = freshBuild();
    b = applyTreeAction(tree, adj, startId, b, "A", "global", { toggle: true }).build;
    const r = applyTreeAction(tree, adj, startId, b, "A", "set1", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(nodeAllocState(r.build, "A")).toBe("set1");
    expect(r.build.allocated).toContain("A");
  });
});

describe("applyTreeAction — weapon-set cap still enforced", () => {
  it("rejects allocating a reachable node into a full set", () => {
    // Pre-fill Set I to the cap with synthetic ids (not in the graph; cap is global accounting).
    const passiveWeaponSet: Record<string, 1 | 2> = {};
    const allocated: string[] = [];
    for (let i = 0; i < WEAPON_SET_MAX; i++) {
      allocated.push(`x${i}`);
      passiveWeaponSet[`x${i}`] = 1;
    }
    const b: BuildState = { ...freshBuild(), allocated, passiveWeaponSet };
    // A is reachable from start; allocating it into Set I should hit the cap.
    const r = applyTreeAction(tree, adj, startId, b, "A", "set1", { toggle: true });
    expect(r.rejected).toBe(1);
    expect(r.build.allocated).not.toContain("A");
  });
});

describe("applyTreeAction — ascendancy bypass", () => {
  it("allocates an ascendancy node even without a connected path", () => {
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "ASC", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated).toContain("ASC");
  });
});

describe("applyTreeAction — smart-allocate (shortest path)", () => {
  it("clicking a distant node allocates the whole connector path", () => {
    // Fresh build, click C (not adjacent to S) → path S→A→B→C, adds A,B,C.
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "C", "global", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated.sort()).toEqual(["A", "B", "C"]);
  });

  it("smart-allocate: connectors global, destination gets weapon set", () => {
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "C", "set1", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated.sort()).toEqual(["A", "B", "C"]);
    expect(r.build.passiveWeaponSet).toEqual({ C: 1 });
    expect(nodeAllocState(r.build, "A")).toBe("global");
    expect(nodeAllocState(r.build, "B")).toBe("global");
  });

  it("rejects a target on a disconnected island", () => {
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "D", "global", { toggle: true });
    expect(r.rejected).toBe("unreachable");
    expect(r.build.allocated).toEqual([]);
  });

  it("an adjacent click still allocates a single node respecting the mode", () => {
    const r = applyTreeAction(tree, adj, startId, freshBuild(), "A", "set1", { toggle: true });
    expect(r.rejected).toBeNull();
    expect(r.build.allocated).toEqual(["A"]);
    expect(r.build.passiveWeaponSet).toEqual({ A: 1 }); // single adjacent click respects mode
  });
});
