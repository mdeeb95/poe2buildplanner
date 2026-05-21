import { describe, expect, it } from "vitest";
import { searchNodes } from "./node-search";
import type { Tree, TreeNode } from "@/schemas/tree";

function node(opts: Partial<TreeNode> & Pick<TreeNode, "name">): TreeNode {
  return {
    skill: 0,
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
    x: 0,
    y: 0,
    out: [],
    neighbors: [],
    ...opts,
  };
}

function tree(nodes: Record<string, TreeNode>): Tree {
  return {
    version: { pobCommit: "x".repeat(40), treeVersion: "0_4", fetchedAt: "2026-05-20T00:00:00.000Z" },
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    constants: { PSSCentreInnerRadius: 0, orbitRadii: [0], skillsPerOrbit: [1], orbitAnglesByOrbit: [[0]] },
    classes: [],
    groups: [{ x: 0, y: 0, orbits: [], nodes: [] }],
    nodes,
  };
}

const fixture = tree({
  "1": node({ name: "Spreading Shocks", stats: ["20% increased Lightning Damage"] }),
  "2": node({ name: "Heavy Armour", stats: ["+30 to Strength"] }),
  "3": node({ name: "Lightning Mastery", stats: [] }),
  "4": node({ name: "Floating", stats: ["x"], group: null, orbit: null, orbitIndex: null }),
});

describe("searchNodes", () => {
  it("matches on node name (fuzzy, multi-token)", () => {
    expect(searchNodes(fixture, "spread shock")).toEqual(new Set(["1"]));
  });

  it("matches on stat text", () => {
    // "lightning" appears in node 1's stat and node 3's name.
    expect(searchNodes(fixture, "lightning")).toEqual(new Set(["1", "3"]));
  });

  it("matches strength via its stat line", () => {
    expect(searchNodes(fixture, "strength")).toEqual(new Set(["2"]));
  });

  it("returns nothing for queries shorter than the minimum", () => {
    expect(searchNodes(fixture, "l").size).toBe(0);
    expect(searchNodes(fixture, " ").size).toBe(0);
  });

  it("skips un-positioned (group === null) nodes", () => {
    expect(searchNodes(fixture, "floating").size).toBe(0);
  });
});
