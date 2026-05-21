import { describe, expect, it } from "vitest";
import {
  defaultSupportEquipLevel,
  defaultSupportLevelInterval,
  formatSupportCraftAdditionalText,
  supportStatRequirements,
  supportUncutTier,
} from "./support-craft-level";
import type { SupportGem } from "@/schemas/gem";

function support(partial: Partial<SupportGem> & Pick<SupportGem, "id">): SupportGem {
  return {
    kind: "support",
    name: partial.name ?? "Test",
    baseTypeName: partial.baseTypeName ?? partial.name ?? "Test",
    gameId: null,
    variantId: partial.variantId ?? null,
    grantedEffectId: null,
    color: "str",
    gemType: "Support",
    tags: { support: true },
    tagString: null,
    reqStr: partial.reqStr ?? 0,
    reqDex: partial.reqDex ?? 0,
    reqInt: partial.reqInt ?? 0,
    naturalMaxLevel: 1,
    levels: partial.levels ?? [{ level: 1, levelRequirement: 0, reqStr: 0, reqDex: 5, reqInt: 0 }],
    gemFamily: null,
    uncutTier: partial.uncutTier ?? null,
    requireSkillTypes: [],
    addSkillTypes: [],
    excludeSkillTypes: [],
    compatibleSkills: [],
    ...partial,
  };
}

describe("supportUncutTier", () => {
  it("uses PoB uncutTier and ignores SupportThree suffix", () => {
    expect(
      supportUncutTier(
        support({
          id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
          variantId: "RetreatSupportThree",
          baseTypeName: "Retreat III",
          uncutTier: 5,
        }),
      ),
    ).toBe(5);
  });

  it("does not infer tier from SupportThree when uncutTier is missing", () => {
    expect(
      supportUncutTier(
        support({
          id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
          variantId: "RetreatSupportThree",
          baseTypeName: "Retreat III",
          uncutTier: null,
        }),
      ),
    ).toBe(1);
  });
});

describe("supportStatRequirements", () => {
  it("reads stored level-1 stat requirements", () => {
    expect(
      supportStatRequirements(
        support({
          id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
          reqDex: 100,
          levels: [{ level: 1, levelRequirement: 0, reqStr: 0, reqDex: 5, reqInt: 0 }],
        }),
      ),
    ).toEqual({ reqStr: 0, reqDex: 5, reqInt: 0 });
  });
});

describe("formatSupportCraftAdditionalText", () => {
  it("includes uncut tier and stat requirements", () => {
    expect(
      formatSupportCraftAdditionalText(
        support({
          id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
          variantId: "RetreatSupportThree",
          baseTypeName: "Retreat III",
          uncutTier: 5,
          reqDex: 100,
        }),
      ),
    ).toBe("Requires Uncut Support Tier 5 (+5 Dex)");
  });
});

describe("defaultSupportLevelInterval", () => {
  it("defaults min to drop level and max to 100 when no next tier", () => {
    expect(
      defaultSupportLevelInterval(
        support({
          id: "b",
          variantId: "BrutalitySupportTwo",
          baseTypeName: "Brutality II",
          uncutTier: 2,
        }),
      ),
    ).toEqual([16, 100]);
  });

  it("caps max at next tier drop minus one", () => {
    expect(
      defaultSupportLevelInterval(
        support({
          id: "a",
          variantId: "BrutalitySupport",
          baseTypeName: "Brutality I",
          uncutTier: 1,
        }),
        16,
      ),
    ).toEqual([1, 15]);
  });
});

describe("defaultSupportEquipLevel", () => {
  it("never goes below 1", () => {
    expect(
      defaultSupportEquipLevel(
        support({
          id: "a",
          levels: [{ level: 1, levelRequirement: 0, reqStr: 0, reqDex: 5, reqInt: 0 }],
        }),
      ),
    ).toBe(1);
  });
});
