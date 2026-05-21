import { memo, type ReactElement } from "react";
import { nodeRadius } from "@/lib/tree/node-style";
import type { Tree } from "@/schemas/tree";

interface TreeNodesPreviewProps {
  tree: Tree;
  previewNodes: ReadonlySet<string>;
}

/** Solid accent rings on the nodes a smart-allocate click would add. */
function TreeNodesPreviewImpl({ tree, previewNodes }: TreeNodesPreviewProps) {
  if (previewNodes.size === 0) return null;
  const rings: ReactElement[] = [];
  for (const id of previewNodes) {
    const node = tree.nodes[id];
    if (!node || node.group === null) continue;
    const r = nodeRadius(node);
    rings.push(
      <circle
        key={id}
        cx={node.x}
        cy={node.y}
        r={r + 5}
        fill="none"
        stroke="var(--color-preview)"
        strokeWidth={4}
        strokeOpacity={0.95}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g pointerEvents="none">{rings}</g>;
}

export const TreeNodesPreview = memo(TreeNodesPreviewImpl);
