import type { BuildState } from "@/schemas/build";

export const BUILD_HISTORY_MAX = 80;

export function cloneBuild(build: BuildState): BuildState {
  return structuredClone(build);
}

function recordsEqual(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function weaponSetsEqual(
  a: BuildState["passiveWeaponSet"],
  b: BuildState["passiveWeaponSet"],
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** True when undo/redo should treat two snapshots as the same. */
export function buildStatesEqual(a: BuildState, b: BuildState): boolean {
  if (a === b) return true;
  if (
    a.name !== b.name ||
    a.description !== b.description ||
    a.className !== b.className ||
    a.ascendancy !== b.ascendancy
  ) {
    return false;
  }
  if (a.allocated.length !== b.allocated.length) return false;
  for (let i = 0; i < a.allocated.length; i++) {
    if (a.allocated[i] !== b.allocated[i]) return false;
  }
  if (!weaponSetsEqual(a.passiveWeaponSet, b.passiveWeaponSet)) return false;
  if (!recordsEqual(a.nodeLevels, b.nodeLevels)) return false;
  if (a.skills.length !== b.skills.length || a.items.length !== b.items.length) {
    return false;
  }
  return JSON.stringify(a.skills) === JSON.stringify(b.skills)
    && JSON.stringify(a.items) === JSON.stringify(b.items);
}
