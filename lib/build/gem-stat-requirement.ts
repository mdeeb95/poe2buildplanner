/**
 * Attribute requirements at a gem level. Active gems scale with level; supports
 * use a flat requirement derived from the gem's attribute multiplier (multi / 20).
 * Active formula ported from PoB CalcTools.lua, adjusted for PoE2 low levels.
 */

export interface GemStatRequirements {
  reqStr: number;
  reqDex: number;
  reqInt: number;
}

/** Flat support requirement from PoB attribute multiplier (100 → +5). */
export function getSupportStatRequirement(multi: number): number {
  if (multi <= 0) return 0;
  return Math.round(multi / 20);
}

/** Active skill gem attribute requirement at a given gem level. */
export function getActiveGemStatRequirement(level: number, multi: number): number {
  if (multi <= 0) return 0;
  // PoE2 low levels: 4, 9, 14, 21, 28… at multi 100 (levels 1–5).
  if (level <= 6) {
    return Math.round(
      (4 + 5 * (level - 1) + 2 * Math.max(0, level - 3)) * (multi / 100),
    );
  }
  // PoB in-game formula for higher levels.
  const req = Math.round((5 + (level - 3) * 1.7) * (multi / 100) ** 0.9) + 4;
  return req < 8 ? 0 : req;
}

export function getGemStatRequirementsAtLevel(
  level: number,
  reqStr: number,
  reqDex: number,
  reqInt: number,
  isSupport: boolean,
): GemStatRequirements {
  if (isSupport) {
    return {
      reqStr: getSupportStatRequirement(reqStr),
      reqDex: getSupportStatRequirement(reqDex),
      reqInt: getSupportStatRequirement(reqInt),
    };
  }
  return {
    reqStr: getActiveGemStatRequirement(level, reqStr),
    reqDex: getActiveGemStatRequirement(level, reqDex),
    reqInt: getActiveGemStatRequirement(level, reqInt),
  };
}

export type StatRequirementStyle = "additive" | "absolute";

/** Display string for non-zero attribute requirements. */
export function formatStatRequirements(
  stats: GemStatRequirements,
  style: StatRequirementStyle = "additive",
): string {
  const parts: string[] = [];
  const fmt = (n: number, label: string) =>
    style === "additive" ? `+${n} ${label}` : `${n} ${label}`;
  if (stats.reqStr > 0) parts.push(fmt(stats.reqStr, "Str"));
  if (stats.reqDex > 0) parts.push(fmt(stats.reqDex, "Dex"));
  if (stats.reqInt > 0) parts.push(fmt(stats.reqInt, "Int"));
  return parts.join(", ");
}
