"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
} from "react";
import { nodeFill, nodeRadius } from "@/lib/tree/node-style";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";
import type { Tree } from "@/schemas/tree";

interface View {
  tx: number;
  ty: number;
  scale: number;
}

export interface TreeBaseCanvasHandle {
  draw(): void;
}

interface TreeBaseCanvasProps {
  tree: Tree;
  edgeIndex: ReadonlyArray<EdgeRecord>;
  allocated: ReadonlySet<string>;
  frontier: ReadonlySet<string>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  gRef: React.RefObject<SVGGElement | null>;
  getView: () => View;
}

const CULL_PAD = 80;

/**
 * Renders the static body of the tree — connector edges and the ~4.7k node dots
 * — onto a single canvas at every zoom level. This replaces the per-node SVG
 * circles whose re-rasterization made full zoom-out lag. Allocation rings,
 * search/preview highlights, hover, and (when zoomed in) art icons stay as
 * separate SVG/canvas layers above this one.
 */
const TreeBaseCanvasImpl = forwardRef<TreeBaseCanvasHandle, TreeBaseCanvasProps>(
  function TreeBaseCanvas(
    { tree, edgeIndex, allocated, frontier, svgRef, gRef, getView },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const colorCacheRef = useRef<Map<string, string>>(new Map());
    const edgePathRef = useRef<{ src: ReadonlyArray<EdgeRecord>; path: Path2D } | null>(
      null,
    );

    const propsRef = useRef({ tree, edgeIndex, allocated, frontier, svgRef, gRef, getView });
    propsRef.current = { tree, edgeIndex, allocated, frontier, svgRef, gRef, getView };

    const resolveColor = useCallback((expr: string): string => {
      const cache = colorCacheRef.current;
      const cached = cache.get(expr);
      if (cached) return cached;
      const m = expr.match(/var\((--[a-z0-9-]+)\)/i);
      let value = expr;
      const varName = m?.[1];
      if (varName) {
        value =
          getComputedStyle(document.documentElement).getPropertyValue(varName).trim() ||
          expr;
      }
      cache.set(expr, value);
      return value;
    }, []);

    const edgePath = useCallback((edges: ReadonlyArray<EdgeRecord>): Path2D => {
      const cached = edgePathRef.current;
      if (cached && cached.src === edges) return cached.path;
      const d = edges.map((e) => e.fragment).join("");
      const path = new Path2D(d);
      edgePathRef.current = { src: edges, path };
      return path;
    }, []);

    const draw = useCallback(() => {
      const {
        tree: t,
        edgeIndex: edges,
        allocated: alloc,
        frontier: front,
        svgRef: svgEl,
        gRef: gEl,
      } = propsRef.current;

      const canvas = canvasRef.current;
      const svg = svgEl.current;
      const g = gEl.current;
      if (!canvas || !svg || !g) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.max(1, Math.round(rect.width * dpr));
      const ch = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ctm = g.getScreenCTM();
      if (!ctm) return;

      // Map tree-space → canvas device pixels in one transform so we can draw in
      // tree coordinates directly.
      ctx.setTransform(
        dpr * ctm.a,
        dpr * ctm.b,
        dpr * ctm.c,
        dpr * ctm.d,
        dpr * (ctm.e - rect.left),
        dpr * (ctm.f - rect.top),
      );

      const screenScale = Math.hypot(ctm.a, ctm.b) || 1;

      // Visible tree bounds (for culling dots) via the inverse transform.
      const inv = ctm.inverse();
      const pt = svg.createSVGPoint();
      const toTree = (sx: number, sy: number) => {
        pt.x = sx;
        pt.y = sy;
        return pt.matrixTransform(inv);
      };
      const c0 = toTree(rect.left, rect.top);
      const c1 = toTree(rect.right, rect.top);
      const c2 = toTree(rect.left, rect.bottom);
      const c3 = toTree(rect.right, rect.bottom);
      const minX = Math.min(c0.x, c1.x, c2.x, c3.x) - CULL_PAD;
      const maxX = Math.max(c0.x, c1.x, c2.x, c3.x) + CULL_PAD;
      const minY = Math.min(c0.y, c1.y, c2.y, c3.y) - CULL_PAD;
      const maxY = Math.max(c0.y, c1.y, c2.y, c3.y) + CULL_PAD;

      // ---- Edges (one Path2D, constant on-screen width) ----
      ctx.lineWidth = 3 / screenScale;
      ctx.strokeStyle = resolveColor("var(--color-edge)");
      ctx.stroke(edgePath(edges));

      // ---- Node dots ----
      const dotStroke = resolveColor("var(--color-bg-0)");
      ctx.lineWidth = 2 / screenScale;
      ctx.strokeStyle = dotStroke;
      for (const [id, node] of Object.entries(t.nodes)) {
        if (node.group === null) continue;
        if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY) continue;
        const isAlloc = alloc.has(id);
        const onPath = !isAlloc && front.has(id);
        ctx.globalAlpha = isAlloc ? 1 : onPath ? 0.88 : 0.62;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius(node), 0, Math.PI * 2);
        ctx.fillStyle = resolveColor(nodeFill(node));
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, [edgePath, resolveColor]);

    useImperativeHandle(ref, () => ({ draw }), [draw]);

    useEffect(() => {
      draw();
    }, [tree, edgeIndex, allocated, frontier, draw]);

    return <canvas ref={canvasRef} className="tree-base-canvas" aria-hidden />;
  },
);

export const TreeBaseCanvas = memo(TreeBaseCanvasImpl);
