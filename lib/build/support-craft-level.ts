import { toLevelInterval } from "./levels";
import type { LevelInterval } from "@/schemas/build";
import {
  formatStatRequirements,
  getGemStatRequirementsAtLevel,
  type GemStatRequirements,
} from "./gem-stat-requirement";
import type { SupportGem } from "@/schemas/gem";

/**
 * Character level when zones start dropping uncut support gems of each tier.
 * Source: PoE2DB uncut support gem DropLevel values (US).
 * @see https://poe2db.tw/us/Uncut_Support_Gems
 */
export const UNCUT_SUPPORT_DROP_LEVEL: Readonly<Record<number, number>> = {
  1: 1,
  2: 16,
  3: 33,
  4: 45,
  5: 55,
};

export const UNCUT_SUPPORT_POE2DB_URL =
  "https://poe2db.tw/us/Uncut_Support_Gems";

type SupportTierInput = Pick<
  SupportGem,
  "id" | "variantId" | "baseTypeName" | "name" | "uncutTier" | "reqStr" | "reqDex" | "reqInt" | "levels"
>;

/** Uncut support gem tier (1–5) required to engrave this support variant. */
export function supportUncutTier(gem: SupportTierInput): number {
  if (gem.uncutTier != null && gem.uncutTier > 0) {
    return gem.uncutTier;
  }
  // Do not infer tier from variant suffix (e.g. Retreat III → SupportThree is tier 5).
  return 1;
}

/** Character level required to equip this support (always level 1 in catalog). */
export function defaultSupportEquipLevel(gem: SupportTierInput): number {
  const levelReq = gem.levels.find((l) => l.level === 1)?.levelRequirement ?? 0;
  return Math.max(1, levelReq);
}

/** Attribute requirements to socket this support. */
export function supportStatRequirements(gem: SupportTierInput): GemStatRequirements {
  const stored = gem.levels.find((l) => l.level === 1);
  if (stored?.reqStr != null || stored?.reqDex != null || stored?.reqInt != null) {
    return {
      reqStr: stored.reqStr ?? 0,
      reqDex: stored.reqDex ?? 0,
      reqInt: stored.reqInt ?? 0,
    };
  }
  return getGemStatRequirementsAtLevel(1, gem.reqStr, gem.reqDex, gem.reqInt, true);
}

/** `.build` `additional_text` for a support gem's uncut tier and stat requirements. */
export function formatSupportCraftAdditionalText(gem: SupportTierInput): string {
  const tier = supportUncutTier(gem);
  const stats = formatStatRequirements(supportStatRequirements(gem));
  const suffix = stats ? ` (${stats})` : "";
  return `Requires Uncut Support Tier ${tier}${suffix}`;
}

/** Default `.build` level_interval for a newly added support gem. */
export function defaultSupportLevelInterval(gem: SupportTierInput): LevelInterval {
  return toLevelInterval(defaultSupportEquipLevel(gem));
}

/** @deprecated Use defaultSupportEquipLevel. */
export function defaultSupportDropLevel(gem: SupportTierInput): number {
  return defaultSupportEquipLevel(gem);
}

/** @deprecated Use defaultSupportEquipLevel. */
export function supportCraftRequirementLevel(gem: SupportTierInput): number {
  return UNCUT_SUPPORT_DROP_LEVEL[supportUncutTier(gem)] ?? 1;
}

/** @deprecated Use defaultSupportEquipLevel. */
export function defaultSupportCraftLevel(gem: SupportTierInput): number {
  return defaultSupportEquipLevel(gem);
}
