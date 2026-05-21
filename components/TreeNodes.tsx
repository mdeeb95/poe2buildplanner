import { memo, type ReactElement } from "react";
import { frameStateFor } from "@/lib/tree/art";
import type { Tree, TreeNode } from "@/schemas/tree";

interface TreeNodesProps {
  tree: Tree;
  showArt: boolean;
  allocated: ReadonlySet<string>;
  frontier: ReadonlySet<string>;
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

const HIT_TARGET_SCALE = 1.4;

function hitRadius(visualR: number): number {
  return Math.max(visualR + 14, 30) * HIT_TARGET_SCALE;
}

function circleOpacity(id: string, allocated: ReadonlySet<string>, frontier: ReadonlySet<string>): number {
  const state = frameStateFor(id, allocated, frontier);
  if (state === "alloc") return 1;
  if (state === "path") return 0.88;
  return 0.62;
}

function TreeNodesImpl({ tree, showArt, allocated, frontier }: TreeNodesProps) {
  const visible: ReactElement[] = [];
  const hits: ReactElement[] = [];

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    const { fill, r } = styleFor(node);

    if (!showArt) {
      visible.push(
        <circle
          key={id}
          cx={node.x}
          cy={node.y}
          r={r}
          fill={fill}
          fillOpacity={circleOpacity(id, allocated, frontier)}
        />,
      );
    }

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
