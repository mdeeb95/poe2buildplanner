import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Tree, TreeNode } from "@/schemas/tree";
import { TreeNodes } from "./TreeNodes";

function fixtureNode(opts: Partial<TreeNode> & Pick<TreeNode, "x" | "y">): TreeNode {
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
    constants: { PSSCentreInnerRadius: 0, orbitRadii: [0], skillsPerOrbit: [1], orbitAnglesByOrbit: [[0]] },
    classes: [],
    groups: [{ x: 0, y: 0, orbits: [], nodes: [] }],
    nodes,
  };
}

describe("TreeNodes (position invariant)", () => {
  it("renders every node's <circle cx,cy> exactly at the node's (x, y)", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 100, y: 200 }),
      "2": fixtureNode({ x: -350.5, y: 42.7, isNotable: true }),
      "3": fixtureNode({ x: 0, y: 0, isKeystone: true }),
      "4": fixtureNode({ x: -8680.79, y: -5014.13 }),
      "5": fixtureNode({ x: 15156.66, y: 6190.62, isJewelSocket: true }),
    };
    const tree = fixtureTree(nodes);
    const svg = renderToStaticMarkup(
      <TreeNodes tree={tree} showArt={false} allocated={new Set()} frontier={new Set()} />,
    );
    for (const [id, n] of Object.entries(nodes)) {
      // Vitest doesn't ship a DOM, so we assert with regex against the markup.
      const cxPattern = new RegExp(`cx="${escapeForRegex(String(n.x))}"`);
      const cyPattern = new RegExp(`cy="${escapeForRegex(String(n.y))}"`);
      expect(svg, `node ${id} cx`).toMatch(cxPattern);
      expect(svg, `node ${id} cy`).toMatch(cyPattern);
      // data-node-id enables event delegation in PassiveTree.
      expect(svg, `node ${id} data-node-id`).toMatch(new RegExp(`data-node-id="${id}"`));
    }
  });

  it("skips nodes with group === null", () => {
    const nodes: Record<string, TreeNode> = {
      "1": fixtureNode({ x: 100, y: 200 }),
      "2": fixtureNode({ x: 999, y: 999, group: null, orbit: null, orbitIndex: null }),
    };
    const tree = fixtureTree(nodes);
    const svg = renderToStaticMarkup(
      <TreeNodes tree={tree} showArt={false} allocated={new Set()} frontier={new Set()} />,
    );
    expect(svg).toMatch(/cx="100"/);
    expect(svg).not.toMatch(/cx="999"/);
  });

  it("uses different fill colors and radii per node type", () => {
    const nodes: Record<string, TreeNode> = {
      keystone: fixtureNode({ x: 0, y: 0, isKeystone: true }),
      notable: fixtureNode({ x: 10, y: 0, isNotable: true }),
      jewel: fixtureNode({ x: 20, y: 0, isJewelSocket: true }),
      classStart: fixtureNode({ x: 30, y: 0, classesStart: ["Witch"] }),
      ascendancy: fixtureNode({ x: 40, y: 0, ascendancyName: "Stormweaver" }),
      normal: fixtureNode({ x: 60, y: 0 }),
    };
    const tree = fixtureTree(nodes);
    const svg = renderToStaticMarkup(
      <TreeNodes tree={tree} showArt={false} allocated={new Set()} frontier={new Set()} />,
    );
    expect(svg).toMatch(/r="40".*fill="var\(--color-node-keystone\)"/);
    expect(svg).toMatch(/r="26".*fill="var\(--color-node-notable\)"/);
    expect(svg).toMatch(/r="50".*fill="var\(--color-node-class-start\)"/);
    expect(svg).toMatch(/r="14".*fill="var\(--color-node-normal\)"/);
  });
});

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
