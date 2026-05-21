import { describe, expect, it } from "vitest";
import { activeToPickerRow, supportToPickerRow } from "./gem-ui";
import type { ActiveGem, SupportGem } from "@/schemas/gem";

function active(partial: Partial<ActiveGem> & Pick<ActiveGem, "id">): ActiveGem {
  return {
    kind: "active",
    name: "Barrage",
    baseTypeName: "Barrage",
    gameId: null,
    variantId: null,
    grantedEffectId: null,
    color: "dex",
    gemType: "Attack",
    tags: {},
    tagString: "Attack",
    reqStr: 0,
    reqDex: 100,
    reqInt: 0,
    naturalMaxLevel: 20,
    levels: [
      { level: 5, levelRequirement: 14, reqStr: 0, reqDex: 28, reqInt: 0 },
    ],
    gemFamily: null,
    uncutTier: 5,
    skillTypes: [],
    weaponTypes: null,
    compatibleSupports: [],
    ...partial,
  };
}

function support(partial: Partial<SupportGem> & Pick<SupportGem, "id">): SupportGem {
  return {
    kind: "support",
    name: "Retreat III",
    baseTypeName: "Retreat III",
    gameId: null,
    variantId: null,
    grantedEffectId: null,
    color: "dex",
    gemType: "Support",
    tags: { support: true },
    tagString: "Support",
    reqStr: 0,
    reqDex: 100,
    reqInt: 0,
    naturalMaxLevel: 1,
    levels: [{ level: 1, levelRequirement: 0, reqStr: 0, reqDex: 5, reqInt: 0 }],
    gemFamily: ["Retreat"],
    uncutTier: 5,
    requireSkillTypes: [],
    addSkillTypes: [],
    excludeSkillTypes: [],
    compatibleSkills: [],
    ...partial,
  };
}

describe("activeToPickerRow", () => {
  it("uses craft additional text as desc", () => {
    const row = activeToPickerRow(
      active({ id: "Metadata/Items/Gems/SkillGemBarrage", name: "Barrage" }),
    );
    expect(row.desc).toBe("Requires Uncut Skill Gem Tier 5 (28 Dex)");
  });
});

describe("supportToPickerRow", () => {
  it("uses craft additional text as desc", () => {
    const row = supportToPickerRow(
      support({ id: "Metadata/Items/Gems/SkillGemRetreatSupportThree" }),
    );
    expect(row.desc).toBe("Requires Uncut Support Tier 5 (+5 Dex)");
  });
});
