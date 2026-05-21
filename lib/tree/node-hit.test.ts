import { describe, expect, it } from "vitest";
import { buildNodeHitIndex, nodeAt, nodeHitRadius } from "./node-hit";
import type { Tree, TreeNode } from "@/schemas/tree";

function node(opts: Partial<TreeNode>): TreeNode {
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
    x: 0,
    y: 0,
    out: [],
    neighbors: [],
    ...opts,
  };
}

function tree(nodes: Record<string, TreeNode>): Tree {
  return { nodes } as unknown as Tree;
}

describe("nodeAt", () => {
  it("returns the node whose hit radius contains the point", () => {
    const t = tree({
      a: node({ x: 0, y: 0 }),
      b: node({ x: 1000, y: 0 }),
    });
    const idx = buildNodeHitIndex(t);
    expect(nodeAt(idx, 0, 0)).toBe("a");
    expect(nodeAt(idx, 1000, 5)).toBe("b");
  });

  it("returns null when the point is outside every hit radius", () => {
    const t = tree({ a: node({ x: 0, y: 0 }) });
    const idx = buildNodeHitIndex(t);
    expect(nodeAt(idx, 5000, 5000)).toBeNull();
  });

  it("picks the nearest node when two overlap", () => {
    const t = tree({
      a: node({ x: 0, y: 0 }),
      b: node({ x: 20, y: 0 }),
    });
    const idx = buildNodeHitIndex(t);
    expect(nodeAt(idx, 2, 0)).toBe("a");
    expect(nodeAt(idx, 18, 0)).toBe("b");
  });

  it("skips nodes with a null group", () => {
    const t = tree({ a: node({ x: 0, y: 0, group: null }) });
    const idx = buildNodeHitIndex(t);
    expect(nodeAt(idx, 0, 0)).toBeNull();
  });

  it("uses a larger hit radius for bigger node types", () => {
    expect(nodeHitRadius(node({ isKeystone: true }))).toBeGreaterThan(
      nodeHitRadius(node({})),
    );
  });
});
