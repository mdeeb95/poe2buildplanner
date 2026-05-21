import { describe, expect, it } from "vitest";
import {
  defaultSkillEquipLevel,
  defaultSkillLevelInterval,
  formatSkillCraftAdditionalText,
  skillUncutTier,
} from "./skill-craft-level";
import type { ActiveGem } from "@/schemas/gem";

function barrageLevels() {
  return [
    { level: 1, levelRequirement: 0, reqStr: 0, reqDex: 4, reqInt: 0 },
    { level: 2, levelRequirement: 3, reqStr: 0, reqDex: 9, reqInt: 0 },
    { level: 3, levelRequirement: 6, reqStr: 0, reqDex: 14, reqInt: 0 },
    { level: 4, levelRequirement: 10, reqStr: 0, reqDex: 21, reqInt: 0 },
    { level: 5, levelRequirement: 14, reqStr: 0, reqDex: 28, reqInt: 0 },
  ];
}

function active(partial: Partial<ActiveGem> & Pick<ActiveGem, "id">): ActiveGem {
  return {
    kind: "active",
    name: partial.name ?? "Test",
    baseTypeName: partial.baseTypeName ?? partial.name ?? "Test",
    gameId: null,
    variantId: partial.variantId ?? null,
    grantedEffectId: null,
    color: "dex",
    gemType: "Attack",
    tags: {},
    tagString: null,
    reqStr: 0,
    reqDex: 100,
    reqInt: 0,
    naturalMaxLevel: 20,
    levels: partial.levels ?? barrageLevels(),
    gemFamily: null,
    uncutTier: partial.uncutTier,
    skillTypes: [],
    weaponTypes: null,
    compatibleSupports: [],
    ...partial,
  };
}

describe("skillUncutTier", () => {
  it("reads PoB uncutTier", () => {
    expect(
      skillUncutTier(
        active({
          id: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          uncutTier: 5,
        }),
      ),
    ).toBe(5);
  });
});

describe("defaultSkillEquipLevel", () => {
  it("uses character level for the uncut-tier gem level", () => {
    expect(
      defaultSkillEquipLevel(
        active({
          id: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          uncutTier: 5,
        }),
      ),
    ).toBe(14);
  });
});

describe("formatSkillCraftAdditionalText", () => {
  it("includes uncut tier and stat requirements", () => {
    expect(
      formatSkillCraftAdditionalText(
        active({
          id: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          uncutTier: 5,
        }),
      ),
    ).toBe("Requires Uncut Skill Gem Tier 5 (+28 Dex)");
  });
});

describe("defaultSkillLevelInterval", () => {
  it("defaults to equip level at uncut tier", () => {
    expect(
      defaultSkillLevelInterval(
        active({
          id: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          uncutTier: 5,
        }),
      ),
    ).toEqual([14, 100]);
  });
});
