import { readFile } from "node:fs/promises";
import { TreeSchema, type Tree } from "@/schemas/tree.js";

export interface VerificationFailure {
  layer: string;
  message: string;
}

export interface VerificationResult {
  ok: boolean;
  failures: VerificationFailure[];
  stats: Record<string, number>;
}

export async function verifyTreeIntegrity(path = "data/tree.json"): Promise<VerificationResult> {
  const tree = TreeSchema.parse(JSON.parse(await readFile(path, "utf8")));
  const failures: VerificationFailure[] = [];
  const stats: Record<string, number> = {};

  failOrCollect(failures, () => checkOrbitRanges(tree, stats));
  failOrCollect(failures, () => checkGroupRefs(tree, stats));
  failOrCollect(failures, () => checkPositionBounds(tree, stats));
  failOrCollect(failures, () => checkAdjacencySymmetry(tree, stats));
  failOrCollect(failures, () => checkNodeCounts(tree, stats));
  failOrCollect(failures, () => checkUniquePolarCoords(tree, stats));

  return { ok: failures.length === 0, failures, stats };
}

function failOrCollect(failures: VerificationFailure[], fn: () => VerificationFailure | null): void {
  const result = fn();
  if (result) failures.push(result);
}

function checkOrbitRanges(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  const { orbitRadii, skillsPerOrbit } = tree.constants;
  let invalid = 0;
  let invalidExample = "";
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.orbit === null || node.orbitIndex === null) continue;
    if (node.orbit < 0 || node.orbit >= orbitRadii.length) {
      invalid++;
      if (!invalidExample) invalidExample = `node ${id}: orbit ${node.orbit} (max ${orbitRadii.length - 1})`;
      continue;
    }
    const max = skillsPerOrbit[node.orbit]!;
    if (node.orbitIndex < 0 || node.orbitIndex >= max) {
      invalid++;
      if (!invalidExample) invalidExample = `node ${id}: orbit ${node.orbit} oidx ${node.orbitIndex} (max ${max - 1})`;
    }
  }
  stats.invalidOrbits = invalid;
  return invalid > 0
    ? { layer: "orbit-ranges", message: `${invalid} nodes have invalid orbit/orbitIndex (e.g. ${invalidExample})` }
    : null;
}

function checkGroupRefs(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  let bad = 0;
  let example = "";
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    if (node.group < 0 || node.group >= tree.groups.length) {
      bad++;
      if (!example) example = `node ${id} → group ${node.group} (max ${tree.groups.length - 1})`;
      continue;
    }
    if (tree.groups[node.group] === null) {
      bad++;
      if (!example) example = `node ${id} → group ${node.group} is null`;
    }
  }
  stats.badGroupRefs = bad;
  return bad > 0
    ? { layer: "group-refs", message: `${bad} nodes reference invalid groups (e.g. ${example})` }
    : null;
}

function checkPositionBounds(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  const { minX, maxX, minY, maxY } = tree.bounds;
  const margin = Math.max(...tree.constants.orbitRadii) + 100;
  let oob = 0;
  let example = "";
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    if (
      node.x < minX - margin || node.x > maxX + margin ||
      node.y < minY - margin || node.y > maxY + margin
    ) {
      oob++;
      if (!example) example = `node ${id} at (${node.x.toFixed(0)},${node.y.toFixed(0)}) outside [${minX.toFixed(0)},${maxX.toFixed(0)}] x [${minY.toFixed(0)},${maxY.toFixed(0)}]`;
    }
  }
  stats.outOfBounds = oob;
  return oob > 0
    ? { layer: "bounds", message: `${oob} nodes out of bounds (e.g. ${example})` }
    : null;
}

function checkAdjacencySymmetry(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  let asym = 0;
  let example = "";
  for (const [id, node] of Object.entries(tree.nodes)) {
    for (const nb of node.neighbors) {
      const other = tree.nodes[nb];
      if (!other) {
        asym++;
        if (!example) example = `node ${id} → ${nb} but ${nb} not in nodes`;
        continue;
      }
      if (!other.neighbors.includes(id)) {
        asym++;
        if (!example) example = `node ${id} → ${nb} but ${nb} does not link back`;
      }
    }
  }
  stats.asymmetricEdges = asym;
  return asym > 0
    ? { layer: "adjacency", message: `${asym} asymmetric neighbor edges (e.g. ${example})` }
    : null;
}

function checkNodeCounts(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  const count = Object.keys(tree.nodes).length;
  stats.nodeCount = count;
  if (count < 1000) {
    return { layer: "counts", message: `Suspiciously few nodes: ${count} (expected ~4500+ for PoE2 0.4 tree)` };
  }
  return null;
}

function checkUniquePolarCoords(tree: Tree, stats: Record<string, number>): VerificationFailure | null {
  // Every positioned node should occupy a unique (group, orbit, orbitIndex).
  // The former exception (PoE2 "masteries" sharing a notable's slot) is gone —
  // those phantom nodes are now dropped during sync.
  const seen = new Map<string, string>();
  let collisions = 0;
  let example = "";
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null || node.orbit === null || node.orbitIndex === null) continue;
    const key = `${node.group}/${node.orbit}/${node.orbitIndex}`;
    const prior = seen.get(key);
    if (prior !== undefined) {
      collisions++;
      if (!example) {
        const otherNode = tree.nodes[prior]!;
        example = `${prior} (${otherNode.name}) and ${id} (${node.name}) both at ${key}`;
      }
    } else {
      seen.set(key, id);
    }
  }
  stats.polarCollisions = collisions;
  return collisions > 0
    ? { layer: "unique-coords", message: `${collisions} (group,orbit,orbitIndex) collisions (e.g. ${example})` }
    : null;
}
