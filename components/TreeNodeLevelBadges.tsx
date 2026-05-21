"use client";

import {
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { passiveDisplayLevel } from "@/lib/build/levels";
import { nodeRadius } from "@/lib/tree/node-style";
import type { BuildState } from "@/schemas/build";
import type { Tree } from "@/schemas/tree";

export interface TreeNodeLevelBadgesHandle {
  update(): void;
}

interface TreeNodeLevelBadgesProps {
  tree: Tree | null;
  build: BuildState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getView: () => { tx: number; ty: number; scale: number };
}

/** Screen-space offset from node center toward top-right (tree units). */
function badgeTreeOffset(nodeId: string, tree: Tree): { dx: number; dy: number } | null {
  const node = tree.nodes[nodeId];
  if (!node || node.group === null) return null;
  const r = nodeRadius(node);
  return { dx: r * 0.72, dy: -r * 0.72 };
}

function TreeNodeLevelBadgesImpl(
  { tree, build, svgRef, containerRef, getView }: TreeNodeLevelBadgesProps,
  ref: React.Ref<TreeNodeLevelBadgesHandle>,
) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  const update = () => {
    const layer = layerRef.current;
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!layer || !svg || !container || !tree) return;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const v = getView();
    const rect = container.getBoundingClientRect();
    const badges = layer.querySelectorAll<HTMLElement>("[data-node-id]");

    for (const el of badges) {
      const id = el.dataset.nodeId;
      if (!id) continue;
      const node = tree.nodes[id];
      const offset = badgeTreeOffset(id, tree);
      if (!node || !offset) {
        el.style.transform = "translate(-9999px, -9999px)";
        continue;
      }

      const pt = svg.createSVGPoint();
      pt.x = (node.x + offset.dx) * v.scale + v.tx;
      pt.y = (node.y + offset.dy) * v.scale + v.ty;
      const screen = pt.matrixTransform(ctm);
      const x = screen.x - rect.left;
      const y = screen.y - rect.top;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  };

  useImperativeHandle(ref, () => ({ update }), [tree, build]);

  useLayoutEffect(() => {
    update();
  });

  if (!tree || build.allocated.length === 0) return null;

  return (
    <div ref={layerRef} className="tree-node-level-layer" aria-hidden>
      {build.allocated.map((id) => {
        const node = tree.nodes[id];
        if (!node || node.group === null) return null;
        return (
          <span
            key={id}
            data-node-id={id}
            className="tree-node-level-badge mono"
            style={{ transform: "translate(-9999px, -9999px)" }}
          >
            {passiveDisplayLevel(build, id)}
          </span>
        );
      })}
    </div>
  );
}

export const TreeNodeLevelBadges = memo(
  forwardRef<TreeNodeLevelBadgesHandle, TreeNodeLevelBadgesProps>(TreeNodeLevelBadgesImpl),
);
