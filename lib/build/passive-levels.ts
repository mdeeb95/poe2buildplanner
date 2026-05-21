import type { BuildState } from "@/schemas/build";
import type { WeaponSet } from "./weapon-set";
import { LEVEL_MIN } from "./levels";

/** Highest stored level among currently allocated nodes. */
export function maxAllocatedLevel(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
): number {
  let max = 0;
  for (const id of allocated) {
    const lvl = nodeLevels[id];
    if (lvl != null && lvl > max) max = lvl;
  }
  return max;
}

/** Max level among global (non-weapon-set) allocated passives. */
export function maxGlobalLevel(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
): number {
  let max = 0;
  for (const id of allocated) {
    const ws = passiveWeaponSet[id];
    if (ws === 1 || ws === 2) continue;
    const lvl = nodeLevels[id];
    if (lvl != null && lvl > max) max = lvl;
  }
  return max;
}

/** Weapon-set node ids in allocation (pick) order. */
export function weaponSetNodesInOrder(
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  set: WeaponSet,
): string[] {
  const out: string[] = [];
  for (const id of allocated) {
    if (passiveWeaponSet[id] === set) out.push(id);
  }
  return out;
}

/**
 * Base character level before the first weapon-set slot (slot 1 → base+1).
 * Uses the minimum implied origin across weapon-set nodes so a survivor at
 * slot 2 after dealloc still leaves slot 1 open for parallel fill.
 */
export function weaponSetOriginLevel(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
): number {
  let origin: number | null = null;
  for (const set of [1, 2] as const) {
    const ids = weaponSetNodesInOrder(allocated, passiveWeaponSet, set);
    for (let i = 0; i < ids.length; i++) {
      const lvl = nodeLevels[ids[i]!];
      if (lvl == null) continue;
      const implied = lvl - (i + 1);
      origin = origin == null ? implied : Math.min(origin, implied);
    }
  }
  return origin ?? 0;
}

/** Effective base for slot math (locked origin, else global baseline). */
export function weaponSetLevelBase(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  globalBaseline: number,
): number {
  const origin = weaponSetOriginLevel(nodeLevels, allocated, passiveWeaponSet);
  return origin > 0 ? origin : globalBaseline;
}

/** Slot indices (1-based) already used in a weapon set, inferred from levels. */
export function weaponSetOccupiedSlots(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  set: WeaponSet,
  globalBaseline: number,
): Set<number> {
  const base = weaponSetLevelBase(nodeLevels, allocated, passiveWeaponSet, globalBaseline);
  const slots = new Set<number>();
  for (const id of weaponSetNodesInOrder(allocated, passiveWeaponSet, set)) {
    const lvl = nodeLevels[id];
    if (lvl != null && lvl > base) slots.add(lvl - base);
  }
  return slots;
}

/** Level for the parallel slot in the opposite weapon set, if allocated. */
export function parallelWeaponSetLevel(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  set: WeaponSet,
  slotIndex: number,
): number | null {
  const other: WeaponSet = set === 1 ? 2 : 1;
  const otherIds = weaponSetNodesInOrder(allocated, passiveWeaponSet, other);
  const parallelId = otherIds[slotIndex - 1];
  if (parallelId == null) return null;
  const lvl = nodeLevels[parallelId];
  return lvl ?? null;
}

/**
 * Level for a weapon-set node at 1-based `slotIndex` (explicit slot).
 * Prefer parallel match; otherwise origin/baseline + slot.
 */
export function levelForWeaponSetSlot(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  set: WeaponSet,
  slotIndex: number,
  globalBaseline: number,
): number {
  const parallel = parallelWeaponSetLevel(
    nodeLevels,
    allocated,
    passiveWeaponSet,
    set,
    slotIndex,
  );
  if (parallel != null) return parallel;

  const base = weaponSetLevelBase(nodeLevels, allocated, passiveWeaponSet, globalBaseline);
  return Math.max(base + slotIndex, LEVEL_MIN);
}

/**
 * Level for a newly allocated weapon-set node.
 * Fills the lowest empty slot that has a parallel level first (handles re-add
 * after dealloc); otherwise extends to the next slot index.
 */
export function levelForNewWeaponSetNode(
  nodeLevels: Readonly<Record<string, number>>,
  allocated: ReadonlyArray<string>,
  passiveWeaponSet: Readonly<Record<string, 1 | 2>>,
  set: WeaponSet,
  globalBaseline: number,
): number {
  const occupied = weaponSetOccupiedSlots(
    nodeLevels,
    allocated,
    passiveWeaponSet,
    set,
    globalBaseline,
  );
  const other: WeaponSet = set === 1 ? 2 : 1;
  const otherCount = weaponSetNodesInOrder(allocated, passiveWeaponSet, other).length;
  const scanThrough = Math.max(otherCount, occupied.size + 1, 1);

  for (let slot = 1; slot <= scanThrough; slot++) {
    if (occupied.has(slot)) continue;
    const parallel = parallelWeaponSetLevel(
      nodeLevels,
      allocated,
      passiveWeaponSet,
      set,
      slot,
    );
    if (parallel != null) return parallel;
  }

  let nextSlot = 1;
  while (occupied.has(nextSlot)) nextSlot++;
  return levelForWeaponSetSlot(
    nodeLevels,
    allocated,
    passiveWeaponSet,
    set,
    nextSlot,
    globalBaseline,
  );
}

/** Ids newly present in `next.allocated`, in allocation order. */
export function newlyAllocatedIds(
  prev: ReadonlyArray<string>,
  next: ReadonlyArray<string>,
): string[] {
  const prevSet = new Set(prev);
  const added: string[] = [];
  for (const id of next) {
    if (!prevSet.has(id)) added.push(id);
  }
  return added;
}

/**
 * After a tree action: prune levels for deallocated nodes; assign levels to
 * newly allocated nodes.
 *
 * - Global passives: sequential (max+1, max+2, …) in pick order.
 * - Weapon set I / II: nth slot in each set shares the same level. Picking
 *   globals after weapon-set nodes does not bump the weapon-set origin.
 */
export function applyPassiveLevels(prev: BuildState, next: BuildState): BuildState {
  const added = newlyAllocatedIds(prev.allocated, next.allocated);
  const allocSet = new Set(next.allocated);
  const nodeLevels: Record<string, number> = {};

  for (const id of next.allocated) {
    const lvl = next.nodeLevels[id];
    if (lvl != null) nodeLevels[id] = lvl;
  }

  for (const id of Object.keys(nodeLevels)) {
    if (!allocSet.has(id)) delete nodeLevels[id];
  }

  if (added.length === 0) {
    return { ...next, nodeLevels };
  }

  /** Global max before this action — weapon-set slots anchor here, not mid-batch globals. */
  const wsGlobalBaseline = maxGlobalLevel(
    prev.nodeLevels,
    prev.allocated,
    prev.passiveWeaponSet,
  );

  const allocatedSoFar = [...prev.allocated];

  for (const id of added) {
    const ws = next.passiveWeaponSet[id];
    if (ws === 1 || ws === 2) {
      nodeLevels[id] = levelForNewWeaponSetNode(
        nodeLevels,
        allocatedSoFar,
        next.passiveWeaponSet,
        ws,
        wsGlobalBaseline,
      );
    } else {
      const nextLevel = Math.max(maxAllocatedLevel(nodeLevels, next.allocated), 0) + 1;
      nodeLevels[id] = Math.max(nextLevel, LEVEL_MIN);
    }
    allocatedSoFar.push(id);
  }

  return { ...next, nodeLevels };
}

/** Test helper: stepwise applyPassiveLevels for multi-click scenarios. */
export function applyPassiveLevelsStep(
  build: BuildState,
  patch: Partial<BuildState> & Pick<BuildState, "allocated">,
): BuildState {
  const next: BuildState = {
    ...build,
    ...patch,
    passiveWeaponSet: patch.passiveWeaponSet ?? build.passiveWeaponSet,
    nodeLevels: patch.nodeLevels ?? build.nodeLevels,
  };
  return applyPassiveLevels(build, next);
}
