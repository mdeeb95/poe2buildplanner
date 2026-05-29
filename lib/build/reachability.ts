import type { BuildState } from "@/schemas/build";
import type { Tree } from "@/schemas/tree";

/**
 * Passive-tree reachability: a main-tree node may only be allocated if it
 * connects back to the character's class start node through other allocated
 * nodes. Ascendancy nodes (`ascendancyName != null`) are excluded from this
 * graph entirely — they bypass reachability in v1 and are handled separately.
 *
 * IMPORTANT: the raw `neighbors` graph leaks main↔ascendancy (class starts link
 * directly into ascendancy clusters), so we always traverse the *filtered*
 * main-tree adjacency built by `buildMainTreeAdjacency`.
 */

export type MainTreeAdjacency = Map<string, string[]>;

/** The node whose `classesStart` lists `className`, or null if none / no class. */
export function findClassStartId(tree: Tree, className: string): string | null {
  if (!className) return null;
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.classesStart && node.classesStart.includes(className)) return id;
  }
  return null;
}

/**
 * The entry/root node of an ascendancy — the one node in the ascendancy that
 * links back to a class start node. Allocating it reveals the cluster as
 * connected. Falls back to the node whose `name` matches the ascendancy. Returns
 * null when the ascendancy is empty/unknown.
 */
export function findAscendancyStartId(tree: Tree, ascendancyName: string): string | null {
  if (!ascendancyName) return null;
  let nameMatch: string | null = null;
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.ascendancyName !== ascendancyName) continue;
    if (node.name === ascendancyName) nameMatch = id;
    if (node.neighbors.some((nb) => tree.nodes[nb]?.classesStart?.length)) return id;
  }
  return nameMatch;
}

/** Adjacency over main-tree nodes only (ascendancy nodes + cross-edges removed). */
export function buildMainTreeAdjacency(tree: Tree): MainTreeAdjacency {
  const adj: MainTreeAdjacency = new Map();
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.ascendancyName !== null) continue;
    const mainNeighbors = node.neighbors.filter(
      (nb) => tree.nodes[nb]?.ascendancyName === null,
    );
    adj.set(id, mainNeighbors);
  }
  return adj;
}

/** Allocated node ids that belong to the main tree (not ascendancy). */
export function mainTreeAllocated(tree: Tree, build: BuildState): Set<string> {
  const out = new Set<string>();
  for (const id of build.allocated) {
    if (tree.nodes[id]?.ascendancyName === null) out.add(id);
  }
  return out;
}

/**
 * BFS from the class start through allocated main-tree nodes. Returns the set of
 * reachable ids INCLUDING the start (the start is the implicit always-allocated
 * root). Allocated nodes not reachable from start are excluded.
 */
export function reachableSet(
  adjacency: MainTreeAdjacency,
  startId: string,
  mainAllocated: ReadonlySet<string>,
): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const neighbors = adjacency.get(cur);
    if (!neighbors) continue;
    for (const nb of neighbors) {
      if (!visited.has(nb) && mainAllocated.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited;
}

/** Whether an unallocated main-tree node `id` can be newly allocated. */
export function canAllocate(
  adjacency: MainTreeAdjacency,
  startId: string | null,
  mainAllocated: ReadonlySet<string>,
  id: string,
): boolean {
  if (startId === null) return false;
  if (id === startId) return false; // the root isn't user-allocated
  if (mainAllocated.has(id)) return false;
  const neighbors = adjacency.get(id);
  if (!neighbors) return false;
  const reachable = reachableSet(adjacency, startId, mainAllocated);
  for (const nb of neighbors) {
    if (reachable.has(nb)) return true;
  }
  return false;
}

/** Unallocated main-tree nodes adjacent to the reachable set (valid next picks). */
export function allocatableFrontier(
  adjacency: MainTreeAdjacency,
  startId: string | null,
  mainAllocated: ReadonlySet<string>,
): Set<string> {
  const frontier = new Set<string>();
  if (startId === null) return frontier;
  const reachable = reachableSet(adjacency, startId, mainAllocated);
  for (const cur of reachable) {
    const neighbors = adjacency.get(cur);
    if (!neighbors) continue;
    for (const nb of neighbors) {
      if (nb !== startId && !mainAllocated.has(nb)) frontier.add(nb);
    }
  }
  return frontier;
}

/**
 * Fewest-points path from the current reachable tree to `targetId`, over the
 * filtered main-tree adjacency. Returns `[anchor, n1, …, target]` where
 * `anchor` is the reachable node the path attaches to and `n1…target` are the
 * unallocated nodes that would be added (use `.slice(1)`). Returns null when:
 * no class, target is unknown/ascendancy, target already allocated, target is
 * the start, or the target is on a disconnected island.
 *
 * Multi-source BFS (FIFO) seeded with the whole reachable set at distance 0, so
 * the result minimizes the number of NEW nodes.
 */
export function shortestPath(
  adjacency: MainTreeAdjacency,
  startId: string | null,
  mainAllocated: ReadonlySet<string>,
  targetId: string,
): string[] | null {
  if (startId === null) return null;
  if (!adjacency.has(targetId)) return null; // ascendancy / unknown node
  if (targetId === startId) return null;
  if (mainAllocated.has(targetId)) return null; // already allocated

  const reachable = reachableSet(adjacency, startId, mainAllocated);
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const r of reachable) {
    parent.set(r, null);
    queue.push(r);
  }

  let head = 0;
  let found = false;
  while (head < queue.length) {
    const cur = queue[head++]!;
    if (cur === targetId) {
      found = true;
      break;
    }
    const neighbors = adjacency.get(cur);
    if (!neighbors) continue;
    for (const nb of neighbors) {
      if (!parent.has(nb)) {
        parent.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  if (!found) return null;

  const path: string[] = [];
  let cur: string | null = targetId;
  while (cur !== null) {
    path.push(cur);
    cur = parent.get(cur) ?? null;
  }
  path.reverse(); // [anchor (reachable), …new nodes…, target]
  return path;
}

/**
 * Deallocate `id` and cascade-remove any main-tree node that's now orphaned
 * (no longer reachable from the start). Ascendancy-allocated nodes are kept.
 * Prunes `passiveWeaponSet` entries for removed nodes.
 */
export function cascadeDeallocate(
  tree: Tree,
  adjacency: MainTreeAdjacency,
  startId: string | null,
  build: BuildState,
  id: string,
): BuildState {
  if (!build.allocated.includes(id)) return build;

  const remainingMain = mainTreeAllocated(tree, build);
  remainingMain.delete(id);

  let kept: Set<string>;
  if (startId === null) {
    kept = remainingMain; // no root to reason about; just drop `id`
  } else {
    const reachable = reachableSet(adjacency, startId, remainingMain);
    kept = new Set<string>();
    for (const n of remainingMain) {
      if (reachable.has(n)) kept.add(n);
    }
  }

  const ascAllocated = build.allocated.filter(
    (n) => tree.nodes[n]?.ascendancyName != null,
  );
  const newAllocated = [...kept, ...ascAllocated];

  const newWeaponSet: Record<string, 1 | 2> = {};
  for (const n of newAllocated) {
    const ws = build.passiveWeaponSet[n];
    if (ws != null) newWeaponSet[n] = ws;
  }

  return { ...build, allocated: newAllocated, passiveWeaponSet: newWeaponSet };
}
