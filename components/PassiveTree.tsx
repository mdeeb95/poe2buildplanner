"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { buildEdgeIndex } from "@/lib/tree/build-edge-index";
import { nodeRadius } from "@/lib/tree/node-style";
import {
  WEAPON_SET_MAX,
  globalCount,
  setCount,
  type AllocTarget,
  type WeaponSet,
  weaponSetChordActive,
  weaponSetChordTarget,
} from "@/lib/build/weapon-set";
import { applyTreeAction } from "@/lib/build/allocation";
import { searchNodes } from "@/lib/build/node-search";
import {
  allocatableFrontier,
  buildMainTreeAdjacency,
  findClassStartId,
  mainTreeAllocated,
  shortestPath,
} from "@/lib/build/reachability";
import type { BuildState } from "@/schemas/build";
import { TreeArtManifestSchema, type TreeArtManifest } from "@/schemas/tree-art";
import {
  TreeSchema,
  type Tree,
  type TreeBounds,
  type TreeConstants,
} from "@/schemas/tree";
import { TreeEdges } from "@/components/TreeEdges";
import { TreeEdgesActive } from "@/components/TreeEdgesActive";
import { TreeNodes } from "@/components/TreeNodes";
import { TreeArtCanvas, type TreeArtCanvasHandle } from "@/components/TreeArtCanvas";
import { TreeNodesActive } from "@/components/TreeNodesActive";
import { TreeNodesFrontier } from "@/components/TreeNodesFrontier";
import { TreeNodesPreview } from "@/components/TreeNodesPreview";
import { TreeEdgesPreview } from "@/components/TreeEdgesPreview";
import { TreeNodesSearch } from "@/components/TreeNodesSearch";
import { TreeTooltip, type TreeTooltipHandle } from "@/components/TreeTooltip";

interface PassiveTreeProps {
  seed: {
    version: { pobCommit: string; treeVersion: string; fetchedAt: string };
    bounds: TreeBounds;
    constants: TreeConstants;
  };
  build: BuildState;
  setBuild: Dispatch<SetStateAction<BuildState>>;
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
const FLASH_MS = 600;
const MESSAGE_MS = 1400;

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
  return { cx: node.x, cy: node.y, r: nodeRadius(node) + HOVER_RING_RADIUS_BUMP };
}

export function PassiveTree({ seed, build, setBuild }: PassiveTreeProps) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [treeArt, setTreeArt] = useState<TreeArtManifest | null>(null);
  const [showArt, setShowArt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [allocMode, setAllocMode] = useState<AllocTarget>("global");
  const [flashSet, setFlashSet] = useState<WeaponSet | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const artCanvasRef = useRef<TreeArtCanvasHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<TreeTooltipHandle | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);

  // Latest values, readable synchronously from event handlers without stale closures.
  const buildRef = useRef(build);
  buildRef.current = build;
  const treeRef = useRef<Tree | null>(null);
  const adjacencyRef = useRef<ReturnType<typeof buildMainTreeAdjacency> | null>(null);
  const startIdRef = useRef<string | null>(null);

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
  const chordRightHandledRef = useRef(false);

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
    fetch("/tree-art", { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const parsed = TreeArtManifestSchema.safeParse(data);
        if (!aborted && parsed.success) setTreeArt(parsed.data);
      })
      .catch(() => {
        /* tree art optional */
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

  // ---- Allocation derived from build ----
  const allocatedIds = useMemo(() => new Set(build.allocated), [build.allocated]);
  const gCount = globalCount(build);
  const s1Count = setCount(build, 1);
  const s2Count = setCount(build, 2);

  // ---- Reachability (restriction system) ----
  const adjacency = useMemo(() => (tree ? buildMainTreeAdjacency(tree) : null), [tree]);
  const startId = useMemo(
    () => (tree ? findClassStartId(tree, build.className) : null),
    [tree, build.className],
  );
  const frontier = useMemo(() => {
    if (!tree || !adjacency || startId === null) return new Set<string>();
    return allocatableFrontier(adjacency, startId, mainTreeAllocated(tree, build));
  }, [tree, adjacency, startId, build]);

  // ---- Search highlight (matches node name or stats) ----
  const searchMatches = useMemo(
    () => (tree ? searchNodes(tree, searchQuery) : new Set<string>()),
    [tree, searchQuery],
  );

  // ---- Hover path preview (nodes + route a smart-allocate click would add) ----
  const { previewNodes, previewEdgeKeys } = useMemo(() => {
    const empty = { previewNodes: new Set<string>(), previewEdgeKeys: new Set<string>() };
    if (!tree || !adjacency || startId === null || hoveredNodeId === null) return empty;
    const node = tree.nodes[hoveredNodeId];
    if (!node || node.ascendancyName !== null) return empty;
    if (build.allocated.includes(hoveredNodeId)) return empty;
    const path = shortestPath(adjacency, startId, mainTreeAllocated(tree, build), hoveredNodeId);
    if (!path || path.length < 2) return empty;
    const previewNodes = new Set<string>(path.slice(1));
    const previewEdgeKeys = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      previewEdgeKeys.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    return { previewNodes, previewEdgeKeys };
  }, [tree, adjacency, startId, hoveredNodeId, build]);

  treeRef.current = tree;
  adjacencyRef.current = adjacency;
  startIdRef.current = startId;

  // ---- Imperative transform + tooltip update ----
  const applyTransform = useCallback(() => {
    const v = viewRef.current;
    gRef.current?.setAttribute(
      "transform",
      `translate(${v.tx} ${v.ty}) scale(${v.scale})`,
    );
    const artOn = v.scale >= 0.75;
    setShowArt((prev) => (prev === artOn ? prev : artOn));
    artCanvasRef.current?.draw();
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransform();
      tooltipRef.current?.update();
    });
  }, [applyTransform]);

  // Re-sync after every commit (covers initial mount, fast-refresh remounts).
  useLayoutEffect(() => {
    applyTransform();
  });

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
      if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current);
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

  // ---- Pan: pointer handlers ----
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Ctrl+shift+click assigns weapon sets — don't start a pan gesture.
    if (weaponSetChordActive(e)) return;
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

  // ---- Allocation ----
  const flashRejected = useCallback((set: WeaponSet) => {
    setFlashSet(set);
    if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlashSet(null), FLASH_MS);
  }, []);

  const flashMessage = useCallback((msg: string) => {
    setMessage(msg);
    if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => setMessage(null), MESSAGE_MS);
  }, []);

  const allocateNode = useCallback(
    (id: string, target: AllocTarget, toggle: boolean) => {
      if (!treeRef.current || !adjacencyRef.current) return;
      const res = applyTreeAction(
        treeRef.current,
        adjacencyRef.current,
        startIdRef.current,
        buildRef.current,
        id,
        target,
        { toggle },
      );
      if (res.rejected === "no-class") {
        flashMessage("Select a class to allocate");
        return;
      }
      if (res.rejected === "unreachable") {
        flashMessage("Not connected to your tree");
        return;
      }
      if (res.rejected === 1 || res.rejected === 2) {
        flashRejected(res.rejected);
        return;
      }
      setBuild(res.build);
    },
    [setBuild, flashRejected, flashMessage],
  );

  const onTreeClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      if (dragRef.current?.moved) return; // suppress click after a drag
      const id = (e.target as Element)?.getAttribute?.("data-node-id");
      if (!id) return;
      const chord = weaponSetChordTarget(e, "left");
      if (chord) allocateNode(id, chord, true);
      else allocateNode(id, allocMode, true);
    },
    [allocateNode, allocMode],
  );

  const onTreePointerDown = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 2) return;
      const id = (e.target as Element)?.getAttribute?.("data-node-id");
      if (!id) return;
      const chord = weaponSetChordTarget(e, "right");
      if (!chord) return;
      e.preventDefault();
      chordRightHandledRef.current = true;
      allocateNode(id, chord, true);
    },
    [allocateNode],
  );

  const onTreeContextMenu = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.preventDefault();
      if (chordRightHandledRef.current) {
        chordRightHandledRef.current = false;
        return;
      }
      const id = (e.target as Element)?.getAttribute?.("data-node-id");
      if (!id) return;
      const chord = weaponSetChordTarget(e, "right");
      if (chord) allocateNode(id, chord, true);
    },
    [allocateNode],
  );

  const onTreePointerOver = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const id = (e.target as Element)?.getAttribute?.("data-node-id");
    if (id) setHoveredNodeId(id);
  }, []);

  const onTreePointerOut = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const id = (e.target as Element)?.getAttribute?.("data-node-id");
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
            <TreeEdgesActive
              edgeIndex={edgeIndex}
              allocatedIds={allocatedIds}
              passiveWeaponSet={build.passiveWeaponSet}
            />
            {tree && frontier.size > 0 && (
              <TreeNodesFrontier tree={tree} frontier={frontier} />
            )}
            {tree && previewNodes.size > 0 && (
              <>
                <TreeEdgesPreview edgeIndex={edgeIndex} previewEdgeKeys={previewEdgeKeys} />
                <TreeNodesPreview tree={tree} previewNodes={previewNodes} />
              </>
            )}
            {tree && searchMatches.size > 0 && (
              <TreeNodesSearch tree={tree} matches={searchMatches} />
            )}
          </g>
          <g
            onClick={onTreeClick}
            onPointerDown={onTreePointerDown}
            onContextMenu={onTreeContextMenu}
            onPointerOver={onTreePointerOver}
            onPointerOut={onTreePointerOut}
          >
            {tree && (
              <TreeNodes
                tree={tree}
                showArt={showArt && treeArt !== null}
                allocated={allocatedIds}
                frontier={frontier}
              />
            )}
            {tree && (
              <TreeNodesActive
                tree={tree}
                allocated={build.allocated}
                passiveWeaponSet={build.passiveWeaponSet}
              />
            )}
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

      <div className="tree-search" onPointerDown={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          spellCheck={false}
          aria-label="Search passive nodes"
        />
        {searchQuery.trim().length >= 2 && (
          <span className="tree-search-count">{searchMatches.size}</span>
        )}
        {searchQuery && (
          <button
            type="button"
            className="tree-search-clear"
            onClick={() => setSearchQuery("")}
            title="Clear search"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {tree && treeArt && (
        <TreeArtCanvas
          ref={artCanvasRef}
          tree={tree}
          art={treeArt}
          allocated={allocatedIds}
          frontier={frontier}
          passiveWeaponSet={build.passiveWeaponSet}
          showArt={showArt}
          svgRef={svgRef}
          gRef={gRef}
          getView={getView}
          vbX={vbX}
          vbY={vbY}
          vbW={vbW}
          vbH={vbH}
        />
      )}

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
          <span
            className="tree-stat-n"
            style={build.className ? undefined : { color: "var(--color-weapon-set-1)" }}
          >
            {build.className || "no class"}
          </span>
          <span className="tree-stat-l">class</span>
        </div>
        <div className="tree-stat-divider" />
        <div className="tree-stat-cluster">
          <span className="tree-stat-n">{build.allocated.length}</span>
          <span className="tree-stat-l">allocated</span>
        </div>
        <div className="tree-stat-divider" />
        <div className="tree-stat-cluster">
          <span className="tree-stat-n">{gCount}</span>
          <span className="tree-stat-l">global</span>
        </div>
        <div className="tree-stat-cluster">
          <span
            key={`s1-${flashSet === 1 ? "f" : "n"}`}
            className={`tree-stat-n${flashSet === 1 ? " tree-stat-flash" : ""}`}
            style={{ color: "var(--color-weapon-set-1)" }}
          >
            {s1Count}/{WEAPON_SET_MAX}
          </span>
          <span className="tree-stat-l">set I</span>
        </div>
        <div className="tree-stat-cluster">
          <span
            key={`s2-${flashSet === 2 ? "f" : "n"}`}
            className={`tree-stat-n${flashSet === 2 ? " tree-stat-flash" : ""}`}
            style={{ color: "var(--color-weapon-set-2)" }}
          >
            {s2Count}/{WEAPON_SET_MAX}
          </span>
          <span className="tree-stat-l">set II</span>
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

      {message && <div className="tree-msg">{message}</div>}

      <div className="tree-mode" role="group" aria-label="Allocation mode">
        <button
          type="button"
          data-active={allocMode === "global"}
          onClick={() => setAllocMode("global")}
          title="Allocate global (always active) passives"
        >
          Global
        </button>
        <button
          type="button"
          data-set="1"
          data-active={allocMode === "set1"}
          onClick={() => setAllocMode("set1")}
          title="Allocate Weapon Set I passives (Ctrl+Shift+Left-click)"
        >
          Set I
        </button>
        <button
          type="button"
          data-set="2"
          data-active={allocMode === "set2"}
          onClick={() => setAllocMode("set2")}
          title="Allocate Weapon Set II passives (Ctrl+Shift+Right-click)"
        >
          Set II
        </button>
      </div>

    </div>
  );
}
