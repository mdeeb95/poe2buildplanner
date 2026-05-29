import type { BuildState, LevelInterval } from "@/schemas/build";

export const LEVEL_MIN = 1;
/** Character-level cap (1–100). Used for gem/item `level_interval` annotations,
 *  where the max doubles as the "rest of campaign" sentinel. */
export const LEVEL_MAX = 100;
export const DEFAULT_LEVEL_MAX = LEVEL_MAX;

/** Passive-point cap: 99 from character levels 2–100 plus ~24 quest rewards.
 *  Because points outnumber character levels, the passive snapshot axis counts
 *  points spent (the Nth allocated node lights up at point N), running
 *  LEVEL_MIN..PASSIVE_POINTS_MAX rather than tracking character level. */
export const PASSIVE_POINTS_MAX = 123;

/** Clamp a character level to the valid build-planner range. */
export function clampLevel(level: number): number {
  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(level)));
}

/** Clamp a passive-point ordinal to the valid range (1..PASSIVE_POINTS_MAX). */
export function clampPassivePoint(point: number): number {
  return Math.max(LEVEL_MIN, Math.min(PASSIVE_POINTS_MAX, Math.round(point)));
}

/** Passive point → `.build` `level_interval` tuple (open-ended max). */
export function toPassiveLevelInterval(point: number): LevelInterval {
  return [clampPassivePoint(point), PASSIVE_POINTS_MAX];
}

/** `.build` passive `level_interval` → editor point ordinal (min only). */
export function fromPassiveLevelInterval(interval: LevelInterval): number {
  return clampPassivePoint(interval[0]);
}

/** Editor single level → `.build` `level_interval` tuple (open-ended max). */
export function toLevelInterval(level: number): LevelInterval;
export function toLevelInterval(min: number, max: number): LevelInterval;
export function toLevelInterval(min: number, max?: number): LevelInterval {
  const lo = clampLevel(min);
  const hi = max != null ? clampLevel(max) : DEFAULT_LEVEL_MAX;
  return normalizeLevelInterval(lo, hi);
}

/** Clamp and order a level interval so min ≤ max. */
export function normalizeLevelInterval(min: number, max: number): LevelInterval {
  const lo = clampLevel(min);
  const hi = clampLevel(max);
  return lo <= hi ? [lo, hi] : [hi, lo];
}

/** `.build` `level_interval` → editor single level (min only). */
export function fromLevelInterval(interval: LevelInterval): number {
  return clampLevel(interval[0]);
}

/** Display level for an allocated passive (stored or sequence fallback). */
export function passiveDisplayLevel(build: BuildState, nodeId: string): number {
  const stored = build.nodeLevels[nodeId];
  if (stored != null) return stored;
  const idx = build.allocated.indexOf(nodeId);
  return idx >= 0 ? idx + 1 : LEVEL_MIN;
}

/** Export level for a passive node (defaults to 1 when unset). */
export function passiveExportLevel(build: BuildState, nodeId: string): number {
  return build.nodeLevels[nodeId] ?? LEVEL_MIN;
}

/** Display string for a skill/support level range. */
export function formatGemLevel(levelInterval: LevelInterval): string {
  const min = levelInterval[0];
  const max = levelInterval[1];
  if (max >= DEFAULT_LEVEL_MAX) return `L${min}`;
  if (min === max) return `L${min}`;
  return `L${min}–${max}`;
}
