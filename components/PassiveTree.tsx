"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { buildEdgeIndex } from "@/lib/tree/build-edge-index";
import {
  TreeSchema,
  type Tree,
  type TreeBounds,
  type TreeConstants,
} from "@/schemas/tree";
import { TreeEdges } from "@/components/TreeEdges";
import { TreeEdgesActive } from "@/components/TreeEdgesActive";
import { TreeNodes } from "@/components/TreeNodes";
import { TreeNodesActive } from "@/components/TreeNodesActive";
import { TreeTooltip, type TreeTooltipHandle } from "@/components/TreeTooltip";

interface PassiveTreeProps {
  seed: {
    version: { pobCommit: string; treeVersion: string; fetchedAt: string };
    bounds: TreeBounds;
    constants: TreeConstants;
  };
}

interface View {
  tx: number;
  ty: number;
  scale: number;
}

const INITIAL_VIEW: View = { tx: 0, ty: 0, scale: 1 };
const SCALE_MIN = 0.6;
const SCALE_MAX = 60;
const DRAG_THRESHOLD_PX = 4;

const HOVER_RING_RADIUS_BUMP = 8;

interface HoverRingSpec {
  cx: number;
  cy: number;
  r: number;
}

function hoverRingFor(tree: Tree | null, id: string | null): HoverRingSpec | null {
  if (!tree || id === null) return null;
  const node = tree.nodes[id];
  if (!node || node.group === null) return null;
  let baseR = 14;
  if (node.classesStart && node.classesStart.length > 0) baseR = 50;
  else if (node.isKeystone) baseR = 40;
  else if (node.isJewelSocket) baseR = 32;
  else if (node.isNotable) baseR = 26;
  return { cx: node.x, cy: node.y, r: baseR + HOVER_RING_RADIUS_BUMP };
}

export function PassiveTree({ seed }: PassiveTreeProps) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allocatedIds, setAllocatedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<TreeTooltipHandle | null>(null);

  const viewRef = useRef<View>({ ...INITIAL_VIEW });
  const rafRef = useRef<number | null>(null);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    moved: boolean;
  } | null>(null);

  // ---- Data fetch ----
  useEffect(() => {
    let aborted = false;
    fetch("/tree", { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const parsed = TreeSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error(`Schema validation failed: ${parsed.error.message.slice(0, 200)}`);
        }
        if (!aborted) setTree(parsed.data);
      })
      .catch((e) => {
        if (!aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      aborted = true;
    };
  }, []);

  // ---- ViewBox math (depends only on seed, never on view) ----
  const { vbX, vbY, vbW, vbH } = useMemo(() => {
    const margin = Math.max(...seed.constants.orbitRadii) + 80;
    return {
      vbX: seed.bounds.minX - margin,
      vbY: seed.bounds.minY - margin,
      vbW: seed.bounds.maxX - seed.bounds.minX + 2 * margin,
      vbH: seed.bounds.maxY - seed.bounds.minY + 2 * margin,
    };
  }, [seed]);

  // ---- Edge index (one-shot per tree) ----
  const edgeIndex = useMemo(() => (tree ? buildEdgeIndex(tree) : []), [tree]);

  // ---- Imperative transform + tooltip update ----
  const applyTransform = useCallback(() => {
    const v = viewRef.current;
    gRef.current?.setAttribute(
      "transform",
      `translate(${v.tx} ${v.ty}) scale(${v.scale})`,
    );
    tooltipRef.current?.update();
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransform();
    });
  }, [applyTransform]);

  // Re-sync after every commit (covers initial mount, fast-refresh remounts).
  useLayoutEffect(() => {
    applyTransform();
  });

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---- Cursor → viewBox helper ----
  const clientToViewBox = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [],
  );

  // ---- Wheel: native listener with passive:false ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cursor = clientToViewBox(e.clientX, e.clientY);
      if (!cursor) return;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const v = viewRef.current;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, v.scale * factor));
      const k = newScale / v.scale;
      viewRef.current = {
        tx: cursor.x - (cursor.x - v.tx) * k,
        ty: cursor.y - (cursor.y - v.ty) * k,
        scale: newScale,
      };
      scheduleFlush();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clientToViewBox, scheduleFlush]);

  // ---- Pan: pointer handlers (still through React, low-frequency setup) ----
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const v = viewRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: v.tx,
      startTy: v.ty,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dxScreen, dyScreen) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }
    const dx = dxScreen / ctm.a;
    const dy = dyScreen / ctm.d;
    const v = viewRef.current;
    viewRef.current = { ...v, tx: drag.startTx + dx, ty: drag.startTy + dy };
    scheduleFlush();
  }, [scheduleFlush]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
  }, []);

  // ---- Reset view ----
  const resetView = useCallback(() => {
    viewRef.current = { ...INITIAL_VIEW };
    applyTransform();
  }, [applyTransform]);

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cursor = clientToViewBox(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!cursor) return;
      const factor = dir > 0 ? 1.12 : 0.89;
      const v = viewRef.current;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, v.scale * factor));
      const k = newScale / v.scale;
      viewRef.current = {
        tx: cursor.x - (cursor.x - v.tx) * k,
        ty: cursor.y - (cursor.y - v.ty) * k,
        scale: newScale,
      };
      scheduleFlush();
    },
    [clientToViewBox, scheduleFlush],
  );

  // ---- Delegated click / hover handlers on the interactive <g> ----
  const onTreeClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (dragRef.current?.moved) return; // suppress click after a drag
    const target = e.target as Element | null;
    const id = target?.getAttribute?.("data-node-id");
    if (!id) return;
    setAllocatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onTreePointerOver = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const target = e.target as Element | null;
    const id = target?.getAttribute?.("data-node-id");
    if (id) setHoveredNodeId(id);
  }, []);

  const onTreePointerOut = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const target = e.target as Element | null;
    const id = target?.getAttribute?.("data-node-id");
    if (id) setHoveredNodeId(null);
  }, []);

  const hoverRing = hoverRingFor(tree, hoveredNodeId);

  const getView = useCallback(() => viewRef.current, []);

  return (
    <div
      ref={containerRef}
      className="tree tree-curved"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-dragging={dragRef.current ? "1" : "0"}
      data-tree-loaded={tree ? "true" : "false"}
    >
      <svg
        ref={svgRef}
        className="tree-svg"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g ref={gRef} style={{ willChange: "transform" }}>
          <g pointerEvents="none">
            <TreeEdges edgeIndex={edgeIndex} />
            <TreeEdgesActive edgeIndex={edgeIndex} allocatedIds={allocatedIds} />
          </g>
          <g
            onClick={onTreeClick}
            onPointerOver={onTreePointerOver}
            onPointerOut={onTreePointerOut}
          >
            {tree && <TreeNodes tree={tree} />}
            {tree && <TreeNodesActive tree={tree} allocatedIds={allocatedIds} />}
            {hoverRing && (
              <circle
                cx={hoverRing.cx}
                cy={hoverRing.cy}
                r={hoverRing.r}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={4}
                strokeOpacity={0.9}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </g>
        </g>
      </svg>

      <TreeTooltip
        ref={tooltipRef}
        nodeId={hoveredNodeId}
        tree={tree}
        svgRef={svgRef}
        containerRef={containerRef}
        getView={getView}
      />

      <div className="tree-status">
        <div className="tree-stat-cluster">
          <span className="tree-stat-n">{allocatedIds.size}</span>
          <span className="tree-stat-l">allocated</span>
        </div>
        {!tree && !error && (
          <>
            <div className="tree-stat-divider" />
            <div className="tree-stat-cluster tree-stat-muted">
              <span className="tree-stat-l">loading tree…</span>
            </div>
          </>
        )}
        {error && (
          <>
            <div className="tree-stat-divider" />
            <div className="tree-stat-cluster tree-stat-muted">
              <span className="tree-stat-l">{error}</span>
            </div>
          </>
        )}
      </div>

      <div className="tree-zoom">
        <button type="button" onClick={() => zoomStep(1)} title="Zoom in">
          ＋
        </button>
        <button type="button" onClick={() => zoomStep(-1)} title="Zoom out">
          −
        </button>
        <button type="button" onClick={resetView} title="Reset view">
          ⟲
        </button>
      </div>

      {allocatedIds.size > 0 && (
        <div className="tree-legend">
          <div className="legend-row">
            <span className="dot dot-alloc" /> Allocated ({allocatedIds.size})
          </div>
          <button
            type="button"
            className="legend-row"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "inherit",
              font: "inherit",
              textAlign: "left",
            }}
            onClick={() => setAllocatedIds(new Set())}
          >
            Clear allocation
          </button>
        </div>
      )}
    </div>
  );
}
