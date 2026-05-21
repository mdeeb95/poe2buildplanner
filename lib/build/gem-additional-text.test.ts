import { describe, expect, it } from "vitest";
import {
  defaultSupportAdditionalText,
  syncBuildGemAdditionalText,
} from "./gem-additional-text";
import { createEmptyBuild } from "./defaults";
import type { SupportGem } from "@/schemas/gem";

function retreatCatalog(): SupportGem {
  return {
    kind: "support",
    id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
    name: "Retreat III",
    baseTypeName: "Retreat III",
    gameId: null,
    variantId: "RetreatSupportThree",
    grantedEffectId: null,
    color: "dex",
    gemType: "Support",
    tags: { support: true },
    tagString: null,
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
  };
}

describe("defaultSupportAdditionalText", () => {
  it("formats uncut tier and stat requirements from catalog", () => {
    expect(defaultSupportAdditionalText(retreatCatalog())).toBe(
      "Requires Uncut Support Tier 5 (+5 Dex)",
    );
  });
});

describe("syncBuildGemAdditionalText", () => {
  it("fills empty support additionalText from catalog", () => {
    const build = {
      ...createEmptyBuild(),
      skills: [
        {
          id: "s1",
          skillId: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          color: "green" as const,
          levelInterval: [14, 100] as [number, number],
          additionalText: "",
          supports: [
            {
              id: "sup1",
              skillId: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
              name: "Retreat III",
              color: "green" as const,
              levelInterval: [1, 100] as [number, number],
              additionalText: "",
            },
          ],
        },
      ],
    };
    const synced = syncBuildGemAdditionalText(build, {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      support: {
        "Metadata/Items/Gems/SkillGemRetreatSupportThree": retreatCatalog(),
      },
      byBaseTypeName: {},
    });
    expect(synced.skills[0]?.supports[0]?.additionalText).toBe(
      "Requires Uncut Support Tier 5 (+5 Dex)",
    );
  });

  it("does not overwrite user-edited support text", () => {
    const build = {
      ...createEmptyBuild(),
      skills: [
        {
          id: "s1",
          skillId: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          color: "green" as const,
          levelInterval: [14, 100] as [number, number],
          additionalText: "",
          supports: [
            {
              id: "sup1",
              skillId: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
              name: "Retreat III",
              color: "green" as const,
              levelInterval: [1, 100] as [number, number],
              additionalText: "My custom note",
            },
          ],
        },
      ],
    };
    const synced = syncBuildGemAdditionalText(build, {
      version: { pobCommit: "", fetchedAt: "" },
      active: {},
      support: {
        "Metadata/Items/Gems/SkillGemRetreatSupportThree": retreatCatalog(),
      },
      byBaseTypeName: {},
    });
    expect(synced).toBe(build);
    expect(synced.skills[0]?.supports[0]?.additionalText).toBe("My custom note");
  });
});
