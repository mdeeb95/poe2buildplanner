"use client";

import { memo, useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import {
  WEAPON_SET_TINT_RGBA,
  type WeaponSet,
} from "@/lib/build/weapon-set";
import {
  artDisplaySize,
  artIconDisplaySize,
  artZoomEnabled,
  frameSprite,
  frameStateFor,
  iconSprite,
  NODE_ART_DRAW_ORDER,
  NODE_ART_STYLES,
  visualRadius,
  type FrameState,
} from "@/lib/tree/art";
import { nodeRadius } from "@/lib/tree/node-style";
import type { TreeArtManifest } from "@/schemas/tree-art";
import type { Tree, TreeNode } from "@/schemas/tree";

interface View {
  tx: number;
  ty: number;
  scale: number;
}

export interface TreeArtCanvasHandle {
  draw(): void;
}

interface TreeArtCanvasProps {
  tree: Tree;
  art: TreeArtManifest;
  allocated: ReadonlySet<string>;
  frontier: ReadonlySet<string>;
  passiveWeaponSet: Readonly<Record<string, WeaponSet>>;
  searchMatches: ReadonlySet<string>;
  showArt: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  gRef: React.RefObject<SVGGElement | null>;
  getView: () => View;
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
}

interface NodeDrawItem {
  state: FrameState;
  node: TreeNode;
  cx: number;
  cy: number;
  frame: ReturnType<typeof frameSprite>;
  icon: ReturnType<typeof iconSprite>;
  weaponSet?: WeaponSet;
}

function visibleTreeBounds(view: View, vbX: number, vbY: number, vbW: number, vbH: number, pad: number) {
  const minX = (vbX - view.tx) / view.scale - pad;
  const maxX = (vbX + vbW - view.tx) / view.scale + pad;
  const minY = (vbY - view.ty) / view.scale - pad;
  const maxY = (vbY + vbH - view.ty) / view.scale + pad;
  return { minX, maxX, minY, maxY };
}

function nodeVisible(node: TreeNode, bounds: ReturnType<typeof visibleTreeBounds>): boolean {
  return node.x >= bounds.minX && node.x <= bounds.maxX && node.y >= bounds.minY && node.y <= bounds.maxY;
}

function drawNodeArt(
  ctx: CanvasRenderingContext2D,
  item: NodeDrawItem,
  images: Map<string, HTMLImageElement>,
  screenScale: number,
) {
  const { node, cx, cy, frame, icon, weaponSet } = item;

  if (weaponSet) {
    const tintR = visualRadius(node) * 1.35 * screenScale;
    ctx.beginPath();
    ctx.arc(cx, cy, tintR, 0, Math.PI * 2);
    ctx.fillStyle = WEAPON_SET_TINT_RGBA[weaponSet];
    ctx.fill();
  }

  if (icon) {
    const img = images.get(icon.href);
    if (img?.complete && img.naturalWidth > 0) {
      const iconSize = artIconDisplaySize(node) * screenScale;
      ctx.drawImage(
        img,
        icon.x,
        icon.y,
        icon.w,
        icon.h,
        cx - iconSize / 2,
        cy - iconSize / 2,
        iconSize,
        iconSize,
      );
    }
  }

  if (frame) {
    const img = images.get(frame.href);
    if (img?.complete && img.naturalWidth > 0) {
      const frameSize = artDisplaySize(node, frame) * screenScale;
      ctx.drawImage(
        img,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        cx - frameSize / 2,
        cy - frameSize / 2,
        frameSize,
        frameSize,
      );
    }
  }
}

const TreeArtCanvasImpl = forwardRef<TreeArtCanvasHandle, TreeArtCanvasProps>(function TreeArtCanvas(
  {
    tree,
    art,
    allocated,
    frontier,
    passiveWeaponSet,
    searchMatches,
    showArt,
    svgRef,
    gRef,
    getView,
    vbX,
    vbY,
    vbW,
    vbH,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const searchColorRef = useRef<string | null>(null);
  const propsRef = useRef({
    tree,
    art,
    allocated,
    frontier,
    passiveWeaponSet,
    searchMatches,
    showArt,
    svgRef,
    gRef,
    getView,
    vbX,
    vbY,
    vbW,
    vbH,
  });
  propsRef.current = {
    tree,
    art,
    allocated,
    frontier,
    passiveWeaponSet,
    searchMatches,
    showArt,
    svgRef,
    gRef,
    getView,
    vbX,
    vbY,
    vbW,
    vbH,
  };

  const draw = useCallback(() => {
    const {
      tree: t,
      art: a,
      allocated: alloc,
      frontier: front,
      passiveWeaponSet: pws,
      searchMatches: matches,
      svgRef: svgEl,
      gRef: gEl,
      getView: viewFn,
      vbX: x,
      vbY: y,
      vbW: w,
      vbH: h,
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const view = viewFn();
    if (!a || !artZoomEnabled(view.scale)) return;

    const bounds = visibleTreeBounds(view, x, y, w, h, 120);
    const ctm = g.getScreenCTM();
    if (!ctm) return;

    const screenScale = Math.hypot(ctm.a, ctm.b);
    const canvasRect = canvas.getBoundingClientRect();
    const images = imagesRef.current;

    const byState: Record<FrameState, NodeDrawItem[]> = {
      unalloc: [],
      path: [],
      alloc: [],
    };

    for (const [id, node] of Object.entries(t.nodes)) {
      if (node.group === null || !nodeVisible(node, bounds)) continue;

      const pt = svg.createSVGPoint();
      pt.x = node.x;
      pt.y = node.y;
      const screen = pt.matrixTransform(ctm);
      const state = frameStateFor(id, alloc, front);
      const frame = frameSprite(node, a, state);
      const icon = iconSprite(node.icon, a);
      if (!frame && !icon) continue;

      const ws = alloc.has(id) ? pws[id] : undefined;
      byState[state].push({
        state,
        node,
        cx: screen.x - canvasRect.left,
        cy: screen.y - canvasRect.top,
        frame,
        icon,
        weaponSet: state === "alloc" ? ws : undefined,
      });
    }

    for (const pass of NODE_ART_DRAW_ORDER) {
      const style = NODE_ART_STYLES[pass];
      for (const item of byState[pass]) {
        ctx.save();
        ctx.filter = style.filter;
        ctx.globalAlpha = style.alpha;
        drawNodeArt(ctx, item, images, screenScale);
        ctx.restore();
      }
    }

    // Search highlight rings. The SVG ring (z-index 2) sits below this canvas,
    // so node art would occlude it once zoomed in far enough to show art.
    // Re-draw the rings here, on top of the art, to match the zoomed-out look.
    if (matches.size > 0) {
      let color = searchColorRef.current;
      if (!color) {
        color =
          getComputedStyle(document.documentElement)
            .getPropertyValue("--color-search")
            .trim() || "#ffd54a";
        searchColorRef.current = color;
      }
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.95;
      for (const id of matches) {
        const node = t.nodes[id];
        if (!node || node.group === null || !nodeVisible(node, bounds)) continue;
        const pt = svg.createSVGPoint();
        pt.x = node.x;
        pt.y = node.y;
        const screen = pt.matrixTransform(ctm);
        const cx = screen.x - canvasRect.left;
        const cy = screen.y - canvasRect.top;
        const r = (nodeRadius(node) + 8) * screenScale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  useImperativeHandle(ref, () => ({ draw }), [draw]);

  useEffect(() => {
    const hrefs = new Set<string>();
    for (const atlas of Object.values(art.atlases)) hrefs.add(atlas.file);
    for (const frame of Object.values(art.frames)) hrefs.add(frame.file);

    let cancelled = false;
    for (const href of hrefs) {
      if (imagesRef.current.has(href)) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = href;
      imagesRef.current.set(href, img);
      img.onload = () => {
        if (!cancelled) draw();
      };
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [art, draw]);

  useEffect(() => {
    draw();
  }, [tree, allocated, frontier, passiveWeaponSet, searchMatches, showArt, draw]);

  return <canvas ref={canvasRef} className="tree-art-canvas" aria-hidden />;
});

export const TreeArtCanvas = memo(TreeArtCanvasImpl);
