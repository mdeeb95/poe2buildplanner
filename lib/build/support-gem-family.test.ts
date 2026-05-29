import { describe, expect, it } from "vitest";
import {
  nextSupportTierId,
  normalizeSupportFamilyIntervals,
  supportFamilyKey,
  supportPickerRank,
  supportSetupsForAdd,
} from "./support-gem-family";
import type { GemsFile, SupportGem } from "@/schemas/gem";

function armament(partial: Partial<SupportGem> & Pick<SupportGem, "id" | "name">): SupportGem {
  return {
    kind: "support",
    baseTypeName: partial.baseTypeName ?? partial.name,
    description: partial.description ?? null,
    gameId: null,
    variantId: null,
    grantedEffectId: null,
    color: "str",
    gemType: "Support",
    tags: { support: true },
    tagString: "Attack",
    reqStr: 100,
    reqDex: 0,
    reqInt: 0,
    naturalMaxLevel: 1,
    levels: [{ level: 1, levelRequirement: 0, reqStr: 5, reqDex: 0, reqInt: 0 }],
    gemFamily: ["ElementalArmament"],
    requireSkillTypes: [],
    addSkillTypes: [],
    excludeSkillTypes: [],
    compatibleSkills: [],
    ...partial,
  };
}

describe("supportFamilyKey", () => {
  it("reads first gemFamily entry", () => {
    expect(
      supportFamilyKey(
        armament({
          id: "a",
          name: "Elemental Armament I",
          uncutTier: 1,
        }),
      ),
    ).toBe("ElementalArmament");
  });
});

describe("nextSupportTierId", () => {
  it("finds Elemental Armament II from I by family order", () => {
    const gems: GemsFile = {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      byBaseTypeName: {},
      support: {
        "Metadata/Items/Gems/SkillGemElementalArmamentSupport": armament({
          id: "Metadata/Items/Gems/SkillGemElementalArmamentSupport",
          name: "Elemental Armament I",
          uncutTier: 1,
        }),
        "Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo": armament({
          id: "Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo",
          name: "Elemental Armament II",
          uncutTier: 2,
        }),
      },
    };
    expect(
      nextSupportTierId(gems, "Metadata/Items/Gems/SkillGemElementalArmamentSupport"),
    ).toBe("Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo");
  });

  it("finds Rapid Attacks II from I (uncut tiers are not +1)", () => {
    const gems: GemsFile = {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      byBaseTypeName: {},
      support: {
        "Metadata/Items/Gems/SkillGemRapidAttacksSupport": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
          name: "Rapid Attacks I",
          gemFamily: ["RapidAttacks"],
          uncutTier: 1,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
          name: "Rapid Attacks II",
          gemFamily: ["RapidAttacks"],
          uncutTier: 4,
        }),
      },
    };
    expect(
      nextSupportTierId(gems, "Metadata/Items/Gems/SkillGemRapidAttacksSupport"),
    ).toBe("Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo");
  });
});

describe("supportPickerRank", () => {
  const tierOne = armament({
    id: "Metadata/Items/Gems/SkillGemElementalArmamentSupport",
    name: "Elemental Armament I",
    uncutTier: 1,
  });
  const tierTwo = armament({
    id: "Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo",
    name: "Elemental Armament II",
    uncutTier: 2,
  });
  const other = armament({
    id: "other",
    name: "Brutality I",
    gemFamily: ["Brutality"],
    uncutTier: 1,
  });

  it("ranks next tier first when replacing", () => {
    const ctx = {
      compatibleIds: new Set<string>(),
      replacing: {
        skillId: tierOne.id,
        familyKey: "ElementalArmament",
        nextTierId: tierTwo.id,
      },
    };
    expect(supportPickerRank(tierTwo.id, tierTwo, ctx)).toBe(0);
    expect(supportPickerRank(tierOne.id, tierOne, ctx)).toBe(2);
    expect(supportPickerRank(other.id, other, ctx)).toBe(3);
  });
});

describe("supportSetupsForAdd", () => {
  const gems: GemsFile = {
    version: { pobCommit: "", fetchedAt: "" },
    active: {},
    byBaseTypeName: {},
    support: {
      "Metadata/Items/Gems/SkillGemElementalArmamentSupport": armament({
        id: "Metadata/Items/Gems/SkillGemElementalArmamentSupport",
        name: "Elemental Armament I",
        uncutTier: 1,
      }),
      "Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo": armament({
        id: "Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo",
        name: "Elemental Armament II",
        uncutTier: 2,
      }),
    },
  };

  it("adds picked tier and all higher family tiers", () => {
    const seeds = supportSetupsForAdd(
      "Metadata/Items/Gems/SkillGemElementalArmamentSupport",
      gems,
      { name: "Elemental Armament I", color: "red" },
      [],
    );
    expect(seeds).toHaveLength(2);
    expect(seeds[0]?.levelInterval).toEqual([1, 15]);
    expect(seeds[1]?.skillId).toBe("Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo");
    expect(seeds[1]?.levelInterval).toEqual([16, 100]);
  });

  it("skips higher tiers already socketed", () => {
    const seeds = supportSetupsForAdd(
      "Metadata/Items/Gems/SkillGemElementalArmamentSupport",
      gems,
      { name: "Elemental Armament I", color: "red" },
      ["Metadata/Items/Gems/SkillGemElementalArmamentSupportTwo"],
    );
    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.skillId).toBe("Metadata/Items/Gems/SkillGemElementalArmamentSupport");
  });

  it("adds Rapid Attacks I through III", () => {
    const rapidGems: GemsFile = {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      byBaseTypeName: {},
      support: {
        "Metadata/Items/Gems/SkillGemRapidAttacksSupport": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
          name: "Rapid Attacks I",
          gemFamily: ["RapidAttacks"],
          uncutTier: 1,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
          name: "Rapid Attacks II",
          gemFamily: ["RapidAttacks"],
          uncutTier: 4,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
          name: "Rapid Attacks III",
          gemFamily: ["RapidAttacks"],
          uncutTier: 5,
        }),
      },
    };
    const seeds = supportSetupsForAdd(
      "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
      rapidGems,
      { name: "Rapid Attacks I", color: "green" },
      [],
    );
    expect(seeds.map((s) => s.skillId)).toEqual([
      "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
    ]);
  });

  it("adding the top tier also fills in the lower tiers, ordered low-to-high", () => {
    const rapidGems: GemsFile = {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      byBaseTypeName: {},
      support: {
        "Metadata/Items/Gems/SkillGemRapidAttacksSupport": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
          name: "Rapid Attacks I",
          gemFamily: ["RapidAttacks"],
          uncutTier: 1,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
          name: "Rapid Attacks II",
          gemFamily: ["RapidAttacks"],
          uncutTier: 4,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
          name: "Rapid Attacks III",
          gemFamily: ["RapidAttacks"],
          uncutTier: 5,
        }),
      },
    };
    const seeds = supportSetupsForAdd(
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
      rapidGems,
      { name: "Rapid Attacks III", color: "green" },
      [],
    );
    expect(seeds.map((s) => s.skillId)).toEqual([
      "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
    ]);
  });

  it("skips lower tiers already socketed when adding a higher tier", () => {
    const rapidGems: GemsFile = {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      byBaseTypeName: {},
      support: {
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
          name: "Rapid Attacks II",
          gemFamily: ["RapidAttacks"],
          uncutTier: 4,
        }),
        "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree": armament({
          id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
          name: "Rapid Attacks III",
          gemFamily: ["RapidAttacks"],
          uncutTier: 5,
        }),
      },
    };
    const seeds = supportSetupsForAdd(
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
      rapidGems,
      { name: "Rapid Attacks III", color: "green" },
      ["Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo"],
    );
    expect(seeds.map((s) => s.skillId)).toEqual([
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
    ]);
  });
});

describe("normalizeSupportFamilyIntervals", () => {
  const rapidGems: GemsFile = {
    version: { pobCommit: "", fetchedAt: "" },
    active: {},
    byBaseTypeName: {},
    support: {
      "Metadata/Items/Gems/SkillGemRapidAttacksSupport": armament({
        id: "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
        name: "Rapid Attacks I",
        gemFamily: ["RapidAttacks"],
        uncutTier: 1,
      }),
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo": armament({
        id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
        name: "Rapid Attacks II",
        gemFamily: ["RapidAttacks"],
        uncutTier: 4,
      }),
      "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree": armament({
        id: "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
        name: "Rapid Attacks III",
        gemFamily: ["RapidAttacks"],
        uncutTier: 5,
      }),
    },
  };

  it("fixes out-of-order adds (III, II, I) to contiguous ranges", () => {
    const normalized = normalizeSupportFamilyIntervals(
      [
        {
          skillId: "Metadata/Items/Gems/SkillGemRapidAttacksSupportThree",
          levelInterval: [55, 100],
        },
        {
          skillId: "Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo",
          levelInterval: [45, 54],
        },
        {
          skillId: "Metadata/Items/Gems/SkillGemRapidAttacksSupport",
          levelInterval: [1, 100],
        },
      ],
      rapidGems,
    );
    const byId = Object.fromEntries(normalized.map((r) => [r.skillId, r.levelInterval]));
    expect(byId["Metadata/Items/Gems/SkillGemRapidAttacksSupport"]).toEqual([1, 44]);
    expect(byId["Metadata/Items/Gems/SkillGemRapidAttacksSupportTwo"]).toEqual([45, 54]);
    expect(byId["Metadata/Items/Gems/SkillGemRapidAttacksSupportThree"]).toEqual([55, 100]);
  });
});
