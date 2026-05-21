import { describe, expect, it } from "vitest";
import { createEmptyBuild } from "./defaults";
import {
  allocatableFrontier,
  buildMainTreeAdjacency,
  canAllocate,
  cascadeDeallocate,
  findClassStartId,
  mainTreeAllocated,
  reachableSet,
  shortestPath,
} from "./reachability";
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

/**
 * Fixture graph:
 *   S(start, Warrior) — A — B — C        (a path off the start)
 *   S — ASC(Titan ascendancy)            (cross-edge that must be filtered)
 *   D — E                                (disconnected island)
 */
function fixtureTree(): Tree {
  const nodes: Record<string, TreeNode> = {
    S: node({ neighbors: ["A", "ASC"], classesStart: ["Warrior"] }),
    A: node({ neighbors: ["S", "B"] }),
    B: node({ neighbors: ["A", "C"] }),
    C: node({ neighbors: ["B"] }),
    ASC: node({ neighbors: ["S"], ascendancyName: "Titan" }),
    D: node({ neighbors: ["E"] }),
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

function buildWith(allocated: string[], passiveWeaponSet: Record<string, 1 | 2> = {}): BuildState {
  return { ...createEmptyBuild(), className: "Warrior", allocated, passiveWeaponSet };
}

describe("findClassStartId", () => {
  it("finds the node whose classesStart includes the class", () => {
    const tree = fixtureTree();
    expect(findClassStartId(tree, "Warrior")).toBe("S");
  });
  it("returns null for empty or unknown class", () => {
    const tree = fixtureTree();
    expect(findClassStartId(tree, "")).toBeNull();
    expect(findClassStartId(tree, "Ranger")).toBeNull();
  });
});

describe("buildMainTreeAdjacency", () => {
  it("excludes ascendancy nodes and cross-edges", () => {
    const adj = buildMainTreeAdjacency(fixtureTree());
    expect(adj.has("ASC")).toBe(false); // ascendancy node absent entirely
    expect(adj.get("S")).toEqual(["A"]); // ASC cross-edge filtered out
    expect(adj.get("A")).toEqual(["S", "B"]);
  });
});

describe("reachableSet", () => {
  const adj = buildMainTreeAdjacency(fixtureTree());
  it("with nothing allocated, only the start is reachable", () => {
    expect([...reachableSet(adj, "S", new Set())]).toEqual(["S"]);
  });
  it("flows through allocated nodes", () => {
    expect(reachableSet(adj, "S", new Set(["A"]))).toEqual(new Set(["S", "A"]));
    expect(reachableSet(adj, "S", new Set(["A", "B"]))).toEqual(new Set(["S", "A", "B"]));
  });
  it("does not reach allocated nodes that aren't connected through allocated ones", () => {
    // B and C allocated but A is not → they're stranded from S.
    expect(reachableSet(adj, "S", new Set(["B", "C"]))).toEqual(new Set(["S"]));
  });
});

describe("canAllocate", () => {
  const adj = buildMainTreeAdjacency(fixtureTree());
  it("first pick must be adjacent to the start", () => {
    expect(canAllocate(adj, "S", new Set(), "A")).toBe(true);
    expect(canAllocate(adj, "S", new Set(), "B")).toBe(false);
    expect(canAllocate(adj, "S", new Set(), "D")).toBe(false);
  });
  it("extends the frontier as nodes are allocated", () => {
    expect(canAllocate(adj, "S", new Set(["A"]), "B")).toBe(true);
    expect(canAllocate(adj, "S", new Set(["A"]), "C")).toBe(false);
    expect(canAllocate(adj, "S", new Set(["A", "B"]), "C")).toBe(true);
  });
  it("is false with no class start", () => {
    expect(canAllocate(adj, null, new Set(), "A")).toBe(false);
  });
});

describe("allocatableFrontier", () => {
  const adj = buildMainTreeAdjacency(fixtureTree());
  it("is the start's neighbors when nothing is allocated", () => {
    expect(allocatableFrontier(adj, "S", new Set())).toEqual(new Set(["A"]));
  });
  it("advances with allocation", () => {
    expect(allocatableFrontier(adj, "S", new Set(["A"]))).toEqual(new Set(["B"]));
  });
  it("is empty with no class", () => {
    expect(allocatableFrontier(adj, null, new Set()).size).toBe(0);
  });
});

describe("cascadeDeallocate", () => {
  const tree = fixtureTree();
  const adj = buildMainTreeAdjacency(tree);

  it("removing an interior node drops everything orphaned past it", () => {
    const b = buildWith(["A", "B", "C"]);
    const out = cascadeDeallocate(tree, adj, "S", b, "A");
    expect(out.allocated.sort()).toEqual([]); // A removed; B,C orphaned from S
  });

  it("removing a leaf removes only the leaf", () => {
    const b = buildWith(["A", "B", "C"]);
    const out = cascadeDeallocate(tree, adj, "S", b, "C");
    expect(out.allocated.sort()).toEqual(["A", "B"]);
  });

  it("prunes passiveWeaponSet entries for removed nodes", () => {
    const b = buildWith(["A", "B", "C"], { B: 1, C: 2 });
    const out = cascadeDeallocate(tree, adj, "S", b, "A");
    expect(out.passiveWeaponSet).toEqual({});
  });

  it("keeps ascendancy-allocated nodes across a main-tree cascade", () => {
    const b = buildWith(["A", "B", "ASC"]);
    const out = cascadeDeallocate(tree, adj, "S", b, "A");
    expect(out.allocated).toContain("ASC"); // ascendancy preserved
    expect(out.allocated).not.toContain("A");
    expect(out.allocated).not.toContain("B");
  });
});

describe("mainTreeAllocated", () => {
  it("excludes ascendancy nodes", () => {
    const tree = fixtureTree();
    const b = buildWith(["A", "ASC"]);
    expect(mainTreeAllocated(tree, b)).toEqual(new Set(["A"]));
  });
});

describe("shortestPath", () => {
  const adj = buildMainTreeAdjacency(fixtureTree());

  it("returns [anchor, target] for an adjacent target", () => {
    expect(shortestPath(adj, "S", new Set(), "A")).toEqual(["S", "A"]);
  });

  it("returns the full chain to a distant target (new nodes via slice(1))", () => {
    // Nothing allocated → must path S→A→B→C.
    expect(shortestPath(adj, "S", new Set(), "C")).toEqual(["S", "A", "B", "C"]);
    // With A allocated, anchor is A.
    expect(shortestPath(adj, "S", new Set(["A"]), "C")).toEqual(["A", "B", "C"]);
  });

  it("returns null for a disconnected island", () => {
    expect(shortestPath(adj, "S", new Set(), "D")).toBeNull();
  });

  it("returns null with no class, for ascendancy, already-allocated, or the start itself", () => {
    expect(shortestPath(adj, null, new Set(), "A")).toBeNull();
    expect(shortestPath(adj, "S", new Set(), "ASC")).toBeNull(); // ascendancy not in main graph
    expect(shortestPath(adj, "S", new Set(["A"]), "A")).toBeNull(); // already allocated
    expect(shortestPath(adj, "S", new Set(), "S")).toBeNull(); // the start
  });

  it("picks the fewest-new-nodes route when alternatives exist", () => {
    // Diamond: S—A—B—T (3 new) vs S—X—T (2 new). Expect the 2-new route.
    const nodes: Record<string, TreeNode> = {
      S: node({ neighbors: ["A", "X"], classesStart: ["Warrior"] }),
      A: node({ neighbors: ["S", "B"] }),
      B: node({ neighbors: ["A", "T"] }),
      X: node({ neighbors: ["S", "T"] }),
      T: node({ neighbors: ["B", "X"] }),
    };
    const tree: Tree = {
      version: { pobCommit: "x".repeat(40), treeVersion: "0_4", fetchedAt: "2026-05-20T00:00:00.000Z" },
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      constants: { PSSCentreInnerRadius: 0, orbitRadii: [0], skillsPerOrbit: [1], orbitAnglesByOrbit: [[0]] },
      classes: [],
      groups: [{ x: 0, y: 0, orbits: [], nodes: [] }],
      nodes,
    };
    const dadj = buildMainTreeAdjacency(tree);
    expect(shortestPath(dadj, "S", new Set(), "T")).toEqual(["S", "X", "T"]);
  });
});
