import { toLevelInterval } from "./levels";
import type { LevelInterval } from "@/schemas/build";
import {
  formatStatRequirements,
  type GemStatRequirements,
} from "./gem-stat-requirement";
import type { ActiveGem, GemLevel } from "@/schemas/gem";

export const UNCUT_SKILL_POE2DB_URL = "https://poe2db.tw/us/Uncut_Skill_Gem";

type SkillTierInput = Pick<
  ActiveGem,
  "uncutTier" | "levels" | "reqStr" | "reqDex" | "reqInt"
>;

/** Uncut skill gem tier (1–20) required to engrave this skill. */
export function skillUncutTier(gem: SkillTierInput): number {
  if (gem.uncutTier != null && gem.uncutTier > 0) {
    return gem.uncutTier;
  }
  return 1;
}

/** Catalog level entry for the uncut tier used to obtain this skill. */
export function skillLevelAtUncutTier(gem: SkillTierInput): GemLevel | undefined {
  const tier = skillUncutTier(gem);
  return gem.levels.find((l) => l.level === tier) ?? gem.levels[0];
}

/** Character level required to equip this skill at its uncut-tier gem level. */
export function defaultSkillEquipLevel(gem: SkillTierInput): number {
  return skillLevelAtUncutTier(gem)?.levelRequirement ?? 1;
}

/** Attribute requirements at the uncut-tier gem level. */
export function skillStatRequirementsAtTier(gem: SkillTierInput): GemStatRequirements {
  const level = skillLevelAtUncutTier(gem);
  return {
    reqStr: level?.reqStr ?? 0,
    reqDex: level?.reqDex ?? 0,
    reqInt: level?.reqInt ?? 0,
  };
}

/** `.build` `additional_text` for a skill gem's uncut tier and stat requirements. */
export function formatSkillCraftAdditionalText(gem: SkillTierInput): string {
  const tier = skillUncutTier(gem);
  const stats = formatStatRequirements(skillStatRequirementsAtTier(gem));
  const suffix = stats ? ` (${stats})` : "";
  return `Requires Uncut Skill Gem Tier ${tier}${suffix}`;
}

/** Default `.build` level_interval for a newly added skill gem. */
export function defaultSkillLevelInterval(gem: SkillTierInput): LevelInterval {
  return toLevelInterval(defaultSkillEquipLevel(gem));
}
