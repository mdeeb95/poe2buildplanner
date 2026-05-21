import { computeNodePosition } from "@/geometry/tree-position.js";
import {
  TreeSchema,
  type OutEdge,
  type Tree,
  type TreeClass,
  type TreeConstants,
  type TreeNode,
} from "@/schemas/tree.js";
import type { Upstream } from "./fetch.js";

const INT_MAX_SENTINEL = 2147483647;

const TREE_PATH = "src/TreeData/0_4/tree.json";
const TREE_VERSION = "0_4";

interface UpstreamGroup {
  x: number;
  y: number;
  orbits?: number[];
  nodes?: (string | number)[];
}

interface UpstreamNode {
  skill: number;
  name?: string;
  icon?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isJewelSocket?: boolean;
  ascendancyName?: string;
  classesStart?: string[];
  stats?: string[];
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  connections?: Array<{ id: number; orbit: number }>;
}

interface UpstreamAscendancy {
  id?: string;
  name?: string;
  internalId?: string;
}

interface UpstreamClass {
  name?: string;
  integerId?: number;
  base_str?: number;
  base_dex?: number;
  base_int?: number;
  ascendancies?: UpstreamAscendancy[];
}

interface UpstreamConstants {
  PSSCentreInnerRadius: number;
  orbitRadii: number[];
  skillsPerOrbit: number[];
  orbitAnglesByOrbit: number[][];
}

interface UpstreamTree {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  constants: UpstreamConstants;
  classes: UpstreamClass[];
  groups: UpstreamGroup[];
  nodes: Record<string, UpstreamNode>;
}

export async function syncTree(upstream: Upstream): Promise<Tree> {
  const raw = await upstream.fetchFileAsString(TREE_PATH);
  const src = JSON.parse(raw) as UpstreamTree;

  const constants: TreeConstants = {
    PSSCentreInnerRadius: src.constants.PSSCentreInnerRadius,
    orbitRadii: src.constants.orbitRadii,
    skillsPerOrbit: src.constants.skillsPerOrbit,
    orbitAnglesByOrbit: src.constants.orbitAnglesByOrbit,
  };

  const groups = src.groups.map((g) =>
    g
      ? {
          x: g.x,
          y: g.y,
          orbits: g.orbits ?? [],
          nodes: (g.nodes ?? []).map((n) => String(n)),
        }
      : null,
  );

  const classes: TreeClass[] = src.classes.map((c) => ({
    name: c.name ?? "Unknown",
    integerId: c.integerId ?? -1,
    baseStr: c.base_str ?? 0,
    baseDex: c.base_dex ?? 0,
    baseInt: c.base_int ?? 0,
    ascendancies: (c.ascendancies ?? []).map((a) => ({
      id: a.id ?? a.internalId ?? "unknown",
      name: a.name ?? a.id ?? "Unknown",
    })),
  }));

  // CRITICAL: upstream `node.group` is stale/wrong for 4681/4701 nodes.
  // The source of truth for spatial group membership is groups[X].nodes[].
  // Build a nodeId → spatial group_id map by inverting that.
  const spatialGroupOfNode = new Map<string, number>();
  src.groups.forEach((g, gid) => {
    if (!g) return;
    for (const nid of g.nodes ?? []) {
      spatialGroupOfNode.set(String(nid), gid);
    }
  });

  // PoE2 has no mastery mechanic. PoB-PoE2's data still carries ~348 "<X> Mastery"
  // placeholder nodes with empty stats; they grant nothing and aren't real tree
  // nodes. Drop them entirely (the one legit exception — "Temporal Mastery", a
  // real Notable with a stat — is kept because it has non-empty stats).
  const droppedIds = new Set<string>();
  for (const [id, n] of Object.entries(src.nodes)) {
    if ((n.name ?? "").endsWith(" Mastery") && (n.stats?.length ?? 0) === 0) {
      droppedIds.add(id);
    }
  }

  const nodes: Record<string, TreeNode> = {};
  for (const [id, src_node] of Object.entries(src.nodes)) {
    if (droppedIds.has(id)) continue;
    const node = buildNode(
      id,
      src_node,
      groups,
      constants,
      spatialGroupOfNode.get(id) ?? null,
      droppedIds,
    );
    nodes[id] = node;
  }

  buildNeighbors(nodes);

  const tree: Tree = {
    version: {
      pobCommit: upstream.sha,
      treeVersion: TREE_VERSION,
      fetchedAt: new Date().toISOString(),
    },
    bounds: {
      minX: src.min_x,
      maxX: src.max_x,
      minY: src.min_y,
      maxY: src.max_y,
    },
    constants,
    classes,
    groups,
    nodes,
  };

  return TreeSchema.parse(tree);
}

function buildNode(
  id: string,
  src: UpstreamNode,
  groups: ReadonlyArray<{ x: number; y: number } | null>,
  constants: TreeConstants,
  spatialGroupId: number | null,
  droppedIds: ReadonlySet<string>,
): TreeNode {
  const out: OutEdge[] = (src.connections ?? [])
    .filter((c) => !droppedIds.has(String(c.id)))
    .map((c) => ({
      id: String(c.id),
      orbit:
        c.orbit === 0 || c.orbit === INT_MAX_SENTINEL || c.orbit == null
          ? null
          : c.orbit,
    }));

  let x = 0;
  let y = 0;
  let group: number | null = null;
  let orbit: number | null = null;
  let orbitIndex: number | null = null;

  if (
    spatialGroupId !== null &&
    spatialGroupId < groups.length &&
    typeof src.orbit === "number" &&
    typeof src.orbitIndex === "number"
  ) {
    const grp = groups[spatialGroupId];
    if (grp) {
      group = spatialGroupId;
      orbit = src.orbit;
      orbitIndex = src.orbitIndex;
      const pos = computeNodePosition(grp, { orbit, orbitIndex }, constants);
      x = pos.x;
      y = pos.y;
    }
  }

  return {
    skill: src.skill,
    name: src.name ?? "",
    icon: src.icon ?? null,
    isNotable: Boolean(src.isNotable),
    isKeystone: Boolean(src.isKeystone),
    isJewelSocket: Boolean(src.isJewelSocket),
    ascendancyName: src.ascendancyName ?? null,
    classesStart: src.classesStart ?? null,
    stats: src.stats ?? [],
    group,
    orbit,
    orbitIndex,
    x,
    y,
    out,
    neighbors: [],
  };
}

function buildNeighbors(nodes: Record<string, TreeNode>) {
  for (const [id, node] of Object.entries(nodes)) {
    for (const edge of node.out) {
      const targetNode = nodes[edge.id];
      if (!targetNode) continue;
      if (!node.neighbors.includes(edge.id)) node.neighbors.push(edge.id);
      if (!targetNode.neighbors.includes(id)) targetNode.neighbors.push(id);
    }
  }
}
