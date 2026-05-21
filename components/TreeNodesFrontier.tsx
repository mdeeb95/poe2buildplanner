import { memo, type ReactElement } from "react";
import { nodeRadius } from "@/lib/tree/node-style";
import type { Tree } from "@/schemas/tree";

interface TreeNodesFrontierProps {
  tree: Tree;
  frontier: ReadonlySet<string>;
}

/** Faint dashed rings on nodes that are valid next allocations (reachable frontier). */
function TreeNodesFrontierImpl({ tree, frontier }: TreeNodesFrontierProps) {
  if (frontier.size === 0) return null;
  const rings: ReactElement[] = [];
  for (const id of frontier) {
    const node = tree.nodes[id];
    if (!node || node.group === null) continue;
    const r = nodeRadius(node);
    rings.push(
      <circle
        key={id}
        cx={node.x}
        cy={node.y}
        r={r + 4}
        fill="none"
        stroke="var(--color-frontier)"
        strokeWidth={3}
        strokeOpacity={0.7}
        strokeDasharray="6 5"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g pointerEvents="none">{rings}</g>;
}

export const TreeNodesFrontier = memo(TreeNodesFrontierImpl);
