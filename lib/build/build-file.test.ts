import { describe, expect, it } from "vitest";
import { createEmptyBuild } from "./defaults";
import { buildFromFile, buildToFile } from "./build-file";
import type { BuildState } from "@/schemas/build";
import type { TreeClass } from "@/schemas/tree";

const classes: TreeClass[] = [
  {
    name: "Warrior",
    integerId: 1,
    ascendancies: [{ id: "asc1", name: "Titan" }],
    baseStr: 0,
    baseDex: 0,
    baseInt: 0,
  },
];

describe("build-file round-trip", () => {
  it("exports and imports passives with weapon sets", () => {
    const build: BuildState = {
      ...createEmptyBuild(),
      name: "Test",
      className: "Warrior",
      ascendancy: "Titan",
      allocated: ["10", "20"],
      passiveWeaponSet: { "20": 2 },
      nodeLevels: { "10": 5 },
      skills: [],
      items: [],
    };
    const file = buildToFile(build);
    expect(file.passives).toEqual([
      { id: "10", level_interval: [5, 123], weapon_set: 0, additional_text: "" },
      { id: "20", level_interval: [1, 123], weapon_set: 2, additional_text: "" },
    ]);
    const back = buildFromFile(file, classes);
    expect(back.allocated).toEqual(["10", "20"]);
    expect(back.passiveWeaponSet).toEqual({ "20": 2 });
    expect(back.nodeLevels).toEqual({ "10": 5, "20": 1 });
    expect(back.className).toBe("Warrior");
  });

  it("defaults passive level_interval to [1, 123] when nodeLevels unset", () => {
    const build: BuildState = {
      ...createEmptyBuild(),
      allocated: ["a", "b"],
      nodeLevels: { a: 12 },
      skills: [],
      items: [],
    };
    const file = buildToFile(build);
    expect(file.passives).toEqual([
      { id: "a", level_interval: [12, 123], weapon_set: 0, additional_text: "" },
      { id: "b", level_interval: [1, 123], weapon_set: 0, additional_text: "" },
    ]);
  });

  it("round-trips passive points past level 100 (quest-reward points)", () => {
    const build: BuildState = {
      ...createEmptyBuild(),
      allocated: ["x"],
      nodeLevels: { x: 118 },
      skills: [],
      items: [],
    };
    const file = buildToFile(build);
    expect(file.passives[0]?.level_interval).toEqual([118, 123]);
    const back = buildFromFile(file, classes);
    expect(back.nodeLevels.x).toBe(118);
  });

  it("round-trips skill and support level_interval and additional_text", () => {
    const back = buildFromFile(
      {
        name: "Skills",
        skills: [
          {
            id: "Metadata/Items/Gems/SkillGemBarrage",
            level_interval: [14, 100],
            additional_text: "Requires Uncut Skill Gem Tier 5 (28 Dex)",
            support_skills: [
              {
                id: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
                level_interval: [1, 100],
                additional_text: "Requires Uncut Support Tier 5 (+5 Dex)",
              },
            ],
          },
        ],
      },
      classes,
    );
    expect(back.skills[0]?.levelInterval).toEqual([14, 100]);
    expect(back.skills[0]?.additionalText).toBe("Requires Uncut Skill Gem Tier 5 (28 Dex)");
    expect(back.skills[0]?.supports[0]?.levelInterval).toEqual([1, 100]);
    expect(back.skills[0]?.supports[0]?.additionalText).toBe(
      "Requires Uncut Support Tier 5 (+5 Dex)",
    );
    const file = buildToFile(back);
    expect(file.skills[0]?.level_interval).toEqual([14, 100]);
    expect(file.skills[0]?.additional_text).toBe("Requires Uncut Skill Gem Tier 5 (28 Dex)");
    expect(file.skills[0]?.support_skills[0]?.level_interval).toEqual([1, 100]);
    expect(file.skills[0]?.support_skills[0]?.additional_text).toBe(
      "Requires Uncut Support Tier 5 (+5 Dex)",
    );
  });

  it("exports user-edited additional_text without catalog override", () => {
    const build: BuildState = {
      ...createEmptyBuild(),
      skills: [
        {
          id: "skill-row-1",
          skillId: "Metadata/Items/Gems/SkillGemBarrage",
          name: "Barrage",
          color: "green",
          levelInterval: [14, 100],
          additionalText: "Custom skill note",
          supports: [
            {
              id: "sup-row-1",
              skillId: "Metadata/Items/Gems/SkillGemRetreatSupportThree",
              name: "Retreat III",
              color: "green",
              levelInterval: [55, 100],
              additionalText: "Custom support note",
            },
          ],
        },
      ],
    };
    const file = buildToFile(build);
    expect(file.skills[0]?.additional_text).toBe("Custom skill note");
    expect(file.skills[0]?.support_skills[0]?.additional_text).toBe("Custom support note");
  });

  it("imports gear unique and rare modes from inventory_slots", () => {
    const back = buildFromFile(
      {
        name: "Gear test",
        inventory_slots: [
          {
            inventory_id: "Weapon1",
            unique_name: "Ngamahu's Chosen",
            additional_text: "",
          },
          {
            inventory_id: "BodyArmour",
            unique_name: "",
            additional_text: "80+ life, two resists",
          },
        ],
      },
      classes,
    );
    expect(back.items).toHaveLength(2);
    expect(back.items[0]).toMatchObject({
      slot: "Weapon1",
      mode: "unique",
      unique_name: "Ngamahu's Chosen",
    });
    expect(back.items[1]).toMatchObject({
      slot: "BodyArmour",
      mode: "rare",
      desc: "80+ life, two resists",
    });
  });

  it("imports gear from the legacy `items` field as a fallback", () => {
    const back = buildFromFile(
      {
        name: "Legacy gear",
        items: [{ inventory_id: "Helmet", unique_name: "Goldrim", additional_text: "" }],
      },
      classes,
    );
    expect(back.items).toHaveLength(1);
    expect(back.items[0]).toMatchObject({ slot: "Helmet", mode: "unique", unique_name: "Goldrim" });
  });

  it("exports gear to the spec-named `inventory_slots` array", () => {
    const build: BuildState = {
      ...createEmptyBuild(),
      name: "Gear export",
      items: [
        { slot: "Weapon1", mode: "unique", unique_name: "Goldrim", levelInterval: [1, 100] },
        { slot: "BodyArmour", mode: "rare", desc: "life + resists", levelInterval: [1, 100] },
      ],
    };
    const file = buildToFile(build);
    expect(file).not.toHaveProperty("items");
    expect(file.inventory_slots).toEqual([
      {
        inventory_id: "Weapon1",
        level_interval: [1, 100],
        unique_name: "Goldrim",
        additional_text: "",
      },
      {
        inventory_id: "BodyArmour",
        level_interval: [1, 100],
        unique_name: "",
        additional_text: "life + resists",
      },
    ]);
  });

  it("rejects invalid JSON shape", () => {
    expect(() => buildFromFile({ passives: "nope" }, classes)).toThrow(/Invalid .build/);
  });
});
