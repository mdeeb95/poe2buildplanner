import { memo, type ReactElement } from "react";
import type { Tree, TreeNode } from "@/schemas/tree";

interface TreeNodesProps {
  tree: Tree;
}

interface NodeStyle {
  fill: string;
  r: number;
}

function styleFor(node: TreeNode): NodeStyle {
  if (node.classesStart && node.classesStart.length > 0) {
    return { fill: "var(--color-node-class-start)", r: 50 };
  }
  if (node.isKeystone) return { fill: "var(--color-node-keystone)", r: 40 };
  if (node.isJewelSocket) return { fill: "var(--color-node-jewel)", r: 32 };
  if (node.isNotable) return { fill: "var(--color-node-notable)", r: 26 };
  if (node.ascendancyName) return { fill: "var(--color-node-ascendancy)", r: 14 };
  return { fill: "var(--color-node-normal)", r: 14 };
}

// Hit-target radius is generous so small nodes are easy to click even at
// moderate zoom. Tiny nodes (r=14) get ~2× their visual radius; bigger nodes
// get a fixed padding. The hit circles are transparent and rendered above the
// visible layer; they carry data-node-id for event delegation in PassiveTree.
function hitRadius(visualR: number): number {
  return Math.max(visualR + 14, 30);
}

function TreeNodesImpl({ tree }: TreeNodesProps) {
  const visible: ReactElement[] = [];
  const hits: ReactElement[] = [];

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    const { fill, r } = styleFor(node);
    visible.push(
      <circle key={id} cx={node.x} cy={node.y} r={r} fill={fill} />,
    );
    hits.push(
      <circle
        key={id}
        data-node-id={id}
        cx={node.x}
        cy={node.y}
        r={hitRadius(r)}
      />,
    );
  }

  return (
    <>
      <g stroke="var(--color-bg-0)" strokeWidth={2} pointerEvents="none">
        {visible}
      </g>
      <g fill="transparent" stroke="transparent" pointerEvents="all">
        {hits}
      </g>
    </>
  );
}

export const TreeNodes = memo(TreeNodesImpl);
