import { describe, expect, it } from "vitest";
import { buildEdgeIndex } from "./build-edge-index";
import type { Tree, TreeNode } from "@/schemas/tree";

function fixtureNode(opts: Partial<TreeNode> & Pick<TreeNode, "x" | "y">): TreeNode {
  return {
    skill: 0,
    name: "n",
    icon: null,
    isNotable: false,
    isKeystone: false,
    isJewelSocket: false,
    ascendancyName: null,
    classesStart: null,
    stats: [],
    group: 0,
    orbit: 0,
    orbitIndex: 0,
    out: [],
    neighbors: [],
    ...opts,
  };
}

function fixtureTree(nodes: Record<string, TreeNode>): Tree {
  return {
    version: { pobCommit: "x".repeat(40), treeVersion: "0_4", fetchedAt: "2026-05-20T00:00:00.000Z" },
    bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },
    constants: { PSSCentreInnerRadius: 0, orbitRadii: [0, 82], skillsPerOrbit: [1, 4], orbitAnglesByOrbit: [[0], [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]] },
    classes: [],
    groups: [{ x: 0, y: 0, orbits: [], nodes: [] }],
    nodes,
  };
}

describe("buildEdgeIndex", () => {
  it("emits one record per traversed edge, with both endpoints and a non-empty fragment", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 0, y: 0, out: [{ id: "2", orbit: null }] }),
      "2": fixtureNode({ x: 100, y: 0 }),
    };
    const tree = fixtureTree(nodes);
    const idx = buildEdgeIndex(tree);
    expect(idx).toHaveLength(1);
    expect(idx[0]!.a).toBe("1");
    expect(idx[0]!.b).toBe("2");
    expect(idx[0]!.fragment.length).toBeGreaterThan(0);
    expect(idx[0]!.fragment.startsWith("M")).toBe(true);
  });

  it("skips edges where either endpoint has group === null", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 0, y: 0, group: null, orbit: null, orbitIndex: null, out: [{ id: "2", orbit: null }] }),
      "2": fixtureNode({ x: 100, y: 0 }),
      "3": fixtureNode({ x: 200, y: 0, out: [{ id: "4", orbit: null }] }),
      "4": fixtureNode({ x: 300, y: 0, group: null, orbit: null, orbitIndex: null }),
    };
    const tree = fixtureTree(nodes);
    const idx = buildEdgeIndex(tree);
    expect(idx).toHaveLength(0);
  });

  it("filters out ascendancy ↔ main-tree edges", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 0, y: 0, out: [{ id: "2", orbit: null }] }), // main
      "2": fixtureNode({ x: 100, y: 0, ascendancyName: "Deadeye" }), // asc
      "3": fixtureNode({ x: 200, y: 0, out: [{ id: "4", orbit: null }] }), // main
      "4": fixtureNode({ x: 300, y: 0 }), // main
    };
    const tree = fixtureTree(nodes);
    const idx = buildEdgeIndex(tree);
    expect(idx).toHaveLength(1);
    expect(idx[0]!.a).toBe("3");
    expect(idx[0]!.b).toBe("4");
  });

  it("keeps ascendancy ↔ ascendancy edges (within the same panel)", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 0, y: 0, ascendancyName: "Deadeye", out: [{ id: "2", orbit: null }] }),
      "2": fixtureNode({ x: 100, y: 0, ascendancyName: "Deadeye" }),
    };
    const tree = fixtureTree(nodes);
    const idx = buildEdgeIndex(tree);
    expect(idx).toHaveLength(1);
  });
});
