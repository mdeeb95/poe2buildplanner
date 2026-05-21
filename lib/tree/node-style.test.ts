import { describe, expect, it } from "vitest";
import { nodeFill, nodeRadius } from "./node-style";
import type { TreeNode } from "@/schemas/tree";

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

describe("nodeRadius", () => {
  it("returns the radius for each node type", () => {
    expect(nodeRadius(node({ classesStart: ["Witch"] }))).toBe(50);
    expect(nodeRadius(node({ isKeystone: true }))).toBe(40);
    expect(nodeRadius(node({ isJewelSocket: true }))).toBe(32);
    expect(nodeRadius(node({ isNotable: true }))).toBe(26);
    expect(nodeRadius(node({ ascendancyName: "Titan" }))).toBe(14);
    expect(nodeRadius(node({}))).toBe(14);
  });

  it("prioritizes class start over other flags", () => {
    expect(nodeRadius(node({ classesStart: ["Witch"], isKeystone: true }))).toBe(50);
  });
});

describe("nodeFill", () => {
  it("returns the fill var for each node type", () => {
    expect(nodeFill(node({ classesStart: ["Witch"] }))).toBe("var(--color-node-class-start)");
    expect(nodeFill(node({ isKeystone: true }))).toBe("var(--color-node-keystone)");
    expect(nodeFill(node({ isJewelSocket: true }))).toBe("var(--color-node-jewel)");
    expect(nodeFill(node({ isNotable: true }))).toBe("var(--color-node-notable)");
    expect(nodeFill(node({ ascendancyName: "Titan" }))).toBe("var(--color-node-ascendancy)");
    expect(nodeFill(node({}))).toBe("var(--color-node-normal)");
  });
});
