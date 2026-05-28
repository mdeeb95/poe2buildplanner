import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildConnectorPath } from "@/lib/tree/connector-path.js";
import { TreeSchema, type Tree, type TreeNode } from "@/schemas/tree.js";

const OUTPUT = "data/_verify/tree.svg";

const STYLE = {
  background: "#0c0e14",
  edge: "#3a3f4b",
  normal: "#cfd3da",
  notable: "#f0b400",
  keystone: "#e64545",
  jewel: "#5fb1ff",
  ascendancy: "#a06fff",
  classStart: "#7cf585",
};

const RADIUS = {
  normal: 14,
  notable: 26,
  keystone: 40,
  jewel: 32,
  ascendancy: 14,
  classStart: 50,
};

export async function renderTreeSvg(
  inputPath = "data/tree.json",
  outputPath = OUTPUT,
): Promise<{ outputPath: string; nodeCount: number; edgeCount: number }> {
  const tree = TreeSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
  const { svg, edgeCount } = buildSvg(tree);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg);

  const drawable = Object.values(tree.nodes).filter((n) => n.group !== null);
  return { outputPath, nodeCount: drawable.length, edgeCount };
}

function buildSvg(tree: Tree): { svg: string; edgeCount: number } {
  const { minX, maxX, minY, maxY } = tree.bounds;
  const margin = Math.max(...tree.constants.orbitRadii) + 80;
  const x = minX - margin;
  const y = minY - margin;
  const w = maxX - minX + 2 * margin;
  const h = maxY - minY + 2 * margin;

  const edgeFragments: string[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.group === null) continue;
    for (const edge of node.out) {
      const other = tree.nodes[edge.id];
      if (!other) continue;
      const d = buildConnectorPath(node, other, edge);
      if (d) edgeFragments.push(d);
    }
  }
  const combinedEdgePath = edgeFragments.join("");

  const nodes: string[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.group === null) continue;
    const { fill, r } = nodeStyle(node);
    nodes.push(
      `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r}" fill="${fill}"/>`,
    );
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(0)} ${y.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid meet" style="background:${STYLE.background}">
  <path d="${combinedEdgePath}" stroke="${STYLE.edge}" stroke-width="3" fill="none" opacity="0.6"/>
  <g stroke="${STYLE.background}" stroke-width="2">
    ${nodes.join("\n    ")}
  </g>
</svg>
`;

  return { svg, edgeCount: edgeFragments.length };
}

function nodeStyle(node: TreeNode): { fill: string; r: number } {
  if (node.classesStart && node.classesStart.length > 0) {
    return { fill: STYLE.classStart, r: RADIUS.classStart };
  }
  if (node.isKeystone) return { fill: STYLE.keystone, r: RADIUS.keystone };
  if (node.isJewelSocket) return { fill: STYLE.jewel, r: RADIUS.jewel };
  if (node.isNotable) return { fill: STYLE.notable, r: RADIUS.notable };
  if (node.ascendancyName) return { fill: STYLE.ascendancy, r: RADIUS.ascendancy };
  return { fill: STYLE.normal, r: RADIUS.normal };
}
