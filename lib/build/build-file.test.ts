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
      { id: "10", level_interval: [5, 100], weapon_set: 0, additional_text: "" },
      { id: "20", level_interval: [1, 100], weapon_set: 2, additional_text: "" },
    ]);
    const back = buildFromFile(file, classes);
    expect(back.allocated).toEqual(["10", "20"]);
    expect(back.passiveWeaponSet).toEqual({ "20": 2 });
    expect(back.nodeLevels).toEqual({ "10": 5, "20": 1 });
    expect(back.className).toBe("Warrior");
  });

  it("imports gear unique and rare modes", () => {
    const back = buildFromFile(
      {
        name: "Gear test",
        items: [
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

  it("rejects invalid JSON shape", () => {
    expect(() => buildFromFile({ passives: "nope" }, classes)).toThrow(/Invalid .build/);
  });
});
