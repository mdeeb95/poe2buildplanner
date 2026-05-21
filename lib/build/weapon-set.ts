import type { BuildState } from "@/schemas/build";

/**
 * PoE2 weapon-set passive allocation.
 *
 * A node is in one of four states: unallocated, global (always active), or
 * assigned to weapon Set I / Set II (active only when that weapon set is
 * equipped). Weapon-set assignment is stored in `BuildState.passiveWeaponSet`
 * (a node id → 1 | 2 map); presence in `allocated` without an entry there means
 * global. This maps 1:1 to the `.build` format's optional per-passive
 * `weapon_set` uint (omitted = global).
 *
 * NOTE: the internal values 1 / 2 match the GearPanel's existing set numbering.
 * The real `.build` uint encoding is undocumented and gets pinned at export time.
 */

export const WEAPON_SET_MAX = 24;

export type WeaponSet = 1 | 2;
export type AllocTarget = "global" | "set1" | "set2";
export type NodeAllocState = "unallocated" | "global" | "set1" | "set2";

/** SVG stroke for allocated edges / node rings per weapon set. */
export const WEAPON_SET_STROKE: Record<WeaponSet, string> = {
  1: "var(--color-weapon-set-1)",
  2: "var(--color-weapon-set-2)",
};

/** Canvas fill tint behind set-assigned node art (matches theme colors). */
export const WEAPON_SET_TINT_RGBA: Record<WeaponSet, string> = {
  1: "rgba(224, 82, 74, 0.32)",
  2: "rgba(87, 196, 106, 0.32)",
};

export type AllocatedEdgeRole = "global" | WeaponSet;

/**
 * In-game keybind for quick-assigning a node to a weapon set (per the user's
 * recollection — could not be verified against public docs, so kept here as a
 * single configurable source of truth). Ctrl+Shift + left/right mouse button.
 */
export const WEAPON_SET_CHORD = {
  requireCtrl: true,
  requireShift: true,
  /** target for ctrl+shift+LEFT-click */
  leftButton: "set1",
  /** target for ctrl+shift+RIGHT-click */
  rightButton: "set2",
} as const;

/** True when ctrl+shift (weapon-set chord modifiers) are held. */
export function weaponSetChordActive(e: { ctrlKey: boolean; shiftKey: boolean; metaKey?: boolean }): boolean {
  const ctrl = e.ctrlKey || e.metaKey === true;
  if (WEAPON_SET_CHORD.requireCtrl && !ctrl) return false;
  if (WEAPON_SET_CHORD.requireShift && !e.shiftKey) return false;
  return true;
}

export function weaponSetChordTarget(
  e: { ctrlKey: boolean; shiftKey: boolean; metaKey?: boolean },
  button: "left" | "right",
): AllocTarget | null {
  if (!weaponSetChordActive(e)) return null;
  return button === "left" ? WEAPON_SET_CHORD.leftButton : WEAPON_SET_CHORD.rightButton;
}

export function targetToWeaponSet(target: AllocTarget): WeaponSet | null {
  if (target === "set1") return 1;
  if (target === "set2") return 2;
  return null;
}

export function nodeAllocState(build: BuildState, id: string): NodeAllocState {
  if (!build.allocated.includes(id)) return "unallocated";
  const ws = build.passiveWeaponSet[id];
  if (ws === 1) return "set1";
  if (ws === 2) return "set2";
  return "global";
}

export function setCount(build: BuildState, set: WeaponSet): number {
  let n = 0;
  for (const v of Object.values(build.passiveWeaponSet)) {
    if (v === set) n++;
  }
  return n;
}

export function globalCount(build: BuildState): number {
  return build.allocated.length - setCount(build, 1) - setCount(build, 2);
}

/**
 * How an allocated edge should be drawn. Global = both endpoints are global
 * passives. Set I/II = both endpoints participate in that set's tree (global
 * connectors count toward either set when paired with a set node).
 */
export function allocatedEdgeRole(
  a: string,
  b: string,
  allocated: ReadonlySet<string>,
  passiveWeaponSet: Readonly<Record<string, WeaponSet>>,
): AllocatedEdgeRole | null {
  if (!allocated.has(a) || !allocated.has(b)) return null;

  const wa = passiveWeaponSet[a];
  const wb = passiveWeaponSet[b];

  if (wa === undefined && wb === undefined) return "global";

  const inSet1 = wa !== 2 && wb !== 2 && (wa === 1 || wb === 1);
  if (inSet1) return 1;

  const inSet2 = wa !== 1 && wb !== 1 && (wa === 2 || wb === 2);
  if (inSet2) return 2;

  return null;
}

export interface AllocResult {
  build: BuildState;
  /** The weapon set that was full and blocked the change, for UI feedback. null if applied. */
  rejectedSet: WeaponSet | null;
}

/**
 * Apply an allocation action toward `target` on node `id`.
 *
 * - `toggle: true`: if the node is already in `target`'s state, unallocate it;
 *   otherwise set it to `target`. Used for both plain clicks and chords so the
 *   same gesture that allocated a node also clears it.
 * - `toggle: false`: always set the node to `target` (idempotent), never
 *   unallocate. (Library capability; not currently used by the UI.)
 *
 * Setting a node *into* a weapon set is rejected (build unchanged) when that set
 * already holds WEAPON_SET_MAX nodes and the node isn't already in it. Moving a
 * node out of a set (to global / unallocated) is always allowed.
 */
export function applyAllocation(
  build: BuildState,
  id: string,
  target: AllocTarget,
  opts: { toggle: boolean },
): AllocResult {
  const current = nodeAllocState(build, id);

  if (opts.toggle && current === target) {
    return { build: unallocate(build, id), rejectedSet: null };
  }

  const ws = targetToWeaponSet(target);
  if (ws !== null && current !== target && setCount(build, ws) >= WEAPON_SET_MAX) {
    return { build, rejectedSet: ws };
  }

  const allocated = build.allocated.includes(id)
    ? build.allocated
    : [...build.allocated, id];
  const passiveWeaponSet = { ...build.passiveWeaponSet };
  if (ws === null) {
    delete passiveWeaponSet[id];
  } else {
    passiveWeaponSet[id] = ws;
  }
  return { build: { ...build, allocated, passiveWeaponSet }, rejectedSet: null };
}

export function unallocate(build: BuildState, id: string): BuildState {
  if (!build.allocated.includes(id)) return build;
  const allocated = build.allocated.filter((x) => x !== id);
  const passiveWeaponSet = { ...build.passiveWeaponSet };
  delete passiveWeaponSet[id];
  return { ...build, allocated, passiveWeaponSet };
}

export function clearAllocation(build: BuildState): BuildState {
  return { ...build, allocated: [], passiveWeaponSet: {} };
}
