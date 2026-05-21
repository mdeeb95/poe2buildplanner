import { memo, type ReactElement } from "react";
import { nodeRadius } from "@/lib/tree/node-style";
import type { Tree } from "@/schemas/tree";

interface TreeNodesSearchProps {
  tree: Tree;
  matches: ReadonlySet<string>;
}

/** Glowing rings on nodes matching the active search query. */
function TreeNodesSearchImpl({ tree, matches }: TreeNodesSearchProps) {
  if (matches.size === 0) return null;
  const rings: ReactElement[] = [];
  for (const id of matches) {
    const node = tree.nodes[id];
    if (!node || node.group === null) continue;
    const r = nodeRadius(node);
    rings.push(
      <circle
        key={id}
        cx={node.x}
        cy={node.y}
        r={r + 8}
        fill="none"
        stroke="var(--color-search)"
        strokeWidth={5}
        strokeOpacity={0.95}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g pointerEvents="none">{rings}</g>;
}

export const TreeNodesSearch = memo(TreeNodesSearchImpl);
