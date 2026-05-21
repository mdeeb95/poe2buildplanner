import type { BuildState, LevelInterval } from "@/schemas/build";

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 100;
export const DEFAULT_LEVEL_MAX = LEVEL_MAX;

/** Clamp a character level to the valid build-planner range. */
export function clampLevel(level: number): number {
  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(level)));
}

/** Editor single level → `.build` `level_interval` tuple. */
export function toLevelInterval(level: number): LevelInterval {
  return [clampLevel(level), DEFAULT_LEVEL_MAX];
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

/** Display string for a skill/support min level. */
export function formatGemLevel(levelInterval: LevelInterval): string {
  const min = levelInterval[0];
  const max = levelInterval[1];
  if (max < DEFAULT_LEVEL_MAX) return `L${min}+`;
  return `L${min}`;
}
