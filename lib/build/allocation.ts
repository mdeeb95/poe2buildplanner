import {
  applyAllocation,
  nodeAllocState,
  type AllocTarget,
  type WeaponSet,
} from "./weapon-set";
import {
  canAllocate,
  cascadeDeallocate,
  mainTreeAllocated,
  shortestPath,
  type MainTreeAdjacency,
} from "./reachability";
import { applyPassiveLevels } from "./passive-levels";
import type { BuildState } from "@/schemas/build";
import type { Tree } from "@/schemas/tree";

export type RejectReason = "no-class" | "unreachable" | WeaponSet;

export interface TreeActionResult {
  build: BuildState;
  rejected: RejectReason | null;
}

function finalize(prev: BuildState, build: BuildState, rejected: RejectReason | null): TreeActionResult {
  if (rejected !== null) return { build, rejected };
  return { build: applyPassiveLevels(prev, build), rejected: null };
}

/**
 * Single entry point for a passive-tree click/chord. Combines reachability
 * restrictions with the weapon-set allocation rules:
 *
 *  - Ascendancy nodes bypass reachability (delegate to weapon-set logic).
 *  - The class start node is the implicit root and is not user-toggleable.
 *  - Toggling a node off cascades (removes anything orphaned from the start).
 *  - Reassigning an already-allocated node between global/Set I/Set II keeps it
 *    allocated, so reachability is unaffected (weapon-set cap still applies).
 *  - Allocating a NEW main-tree node requires a chosen class and adjacency to
 *    the reachable allocated set.
 */
export function applyTreeAction(
  tree: Tree,
  adjacency: MainTreeAdjacency,
  startId: string | null,
  build: BuildState,
  id: string,
  target: AllocTarget,
  opts: { toggle: boolean },
): TreeActionResult {
  const node = tree.nodes[id];
  if (!node) return { build, rejected: null };

  // Ascendancy: bypass reachability for v1.
  if (node.ascendancyName !== null) {
    const r = applyAllocation(build, id, target, opts);
    return finalize(build, r.build, r.rejectedSet);
  }

  // Class start = implicit always-active root; clicking it is a no-op.
  if (id === startId) return { build, rejected: null };

  const current = nodeAllocState(build, id);

  // Toggle-off → cascade-remove orphans.
  if (opts.toggle && current === target) {
    return finalize(build, cascadeDeallocate(tree, adjacency, startId, build, id), null);
  }

  // Reassign between global/Set I/Set II → node stays allocated.
  if (current !== "unallocated") {
    const r = applyAllocation(build, id, target, opts);
    return finalize(build, r.build, r.rejectedSet);
  }

  // New allocation → needs a class.
  if (startId === null) return { build, rejected: "no-class" };
  const mainAllocated = mainTreeAllocated(tree, build);

  // Adjacent to the tree → single allocation, respects the active mode.
  if (canAllocate(adjacency, startId, mainAllocated, id)) {
    const r = applyAllocation(build, id, target, opts);
    return finalize(build, r.build, r.rejectedSet);
  }

  // Distant → smart-allocate path. Connectors are global; destination uses `target`.
  const path = shortestPath(adjacency, startId, mainAllocated, id);
  if (!path) return { build, rejected: "unreachable" };
  const nodes = path.slice(1);
  if (nodes.length === 0) return { build, rejected: "unreachable" };
  const dest = nodes[nodes.length - 1]!;
  const connectors = nodes.slice(0, -1);
  let next = allocateGlobalPath(build, connectors);
  const r = applyAllocation(next, dest, target, opts);
  return finalize(build, r.build, r.rejectedSet);
}

/** Append `nodes` to `build.allocated` as global (no weapon-set entries). Pure. */
function allocateGlobalPath(build: BuildState, nodes: string[]): BuildState {
  if (nodes.length === 0) return build;
  const allocated = [...build.allocated];
  for (const n of nodes) {
    if (!allocated.includes(n)) allocated.push(n);
  }
  return { ...build, allocated };
}
