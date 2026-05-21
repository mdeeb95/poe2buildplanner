"use client";

import {
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { Tree, TreeNode } from "@/schemas/tree";

export interface TreeTooltipHandle {
  /** Reposition the tooltip to match the current view transform. Called from PassiveTree's RAF flush. */
  update(): void;
}

interface TreeTooltipProps {
  nodeId: string | null;
  tree: Tree | null;
  allocated?: boolean;
  level?: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getView: () => { tx: number; ty: number; scale: number };
}

const OFFSET_X = 18;
const OFFSET_Y = -18;

function TreeTooltipImpl(
  { nodeId, tree, allocated, level, svgRef, containerRef, getView }: TreeTooltipProps,
  ref: React.Ref<TreeTooltipHandle>,
) {
  const tipRef = useRef<HTMLDivElement | null>(null);

  const node: TreeNode | null = nodeId && tree ? (tree.nodes[nodeId] ?? null) : null;

  const update = () => {
    const tip = tipRef.current;
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!tip || !svg || !container || !node || node.group === null) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const v = getView();
    const pt = svg.createSVGPoint();
    pt.x = node.x * v.scale + v.tx;
    pt.y = node.y * v.scale + v.ty;
    const screen = pt.matrixTransform(ctm);
    const rect = container.getBoundingClientRect();
    tip.style.transform = `translate(${screen.x - rect.left + OFFSET_X}px, ${screen.y - rect.top + OFFSET_Y}px)`;
  };

  useImperativeHandle(ref, () => ({ update }), [node, tree]);

  // Reposition after every render (covers initial mount + nodeId change).
  useLayoutEffect(() => {
    update();
  });

  if (!node) return null;

  return (
    <div
      ref={tipRef}
      className="pointer-events-none absolute left-0 top-0 z-50 max-w-xs rounded border border-[color:var(--color-edge)] bg-[color:var(--color-bg-1)] px-3 py-2 text-xs text-[color:var(--color-text-primary)] shadow-lg"
      style={{ transform: "translate(-9999px, -9999px)" }}
    >
      <div className="mb-1 font-semibold text-[color:var(--color-accent)]">
        {node.name || "Unnamed node"}
      </div>
      {allocated && level != null && (
        <div className="mb-1 text-[color:var(--color-text-muted)]">
          Allocate at L{level}
          <span className="tree-tip-hint"> · Right-click to change</span>
        </div>
      )}
      {node.stats.length > 0 ? (
        <ul className="space-y-0.5">
          {node.stats.map((s, i) => (
            <li key={i} className="text-[color:var(--color-text-muted)]">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <div className="italic text-[color:var(--color-text-muted)]">No stats</div>
      )}
    </div>
  );
}

export const TreeTooltip = memo(forwardRef<TreeTooltipHandle, TreeTooltipProps>(TreeTooltipImpl));
