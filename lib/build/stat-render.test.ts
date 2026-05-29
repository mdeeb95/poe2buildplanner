import { describe, expect, it } from "vitest";
import { renderStatLines, resolveGemLevel, type StatDescriptions } from "./stat-render";
import type { GemStatValues } from "@/schemas/gem-stat-block";

// Mirrors the real Retreat II support data emitted into gem-stat-blocks.json.
const RETREAT_DESCRIPTIONS: StatDescriptions = {
  "support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_8_seconds": {
    stats: ["support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_8_seconds"],
    lines: [
      {
        limit: [{ min: 1, max: "#" }],
        text: "Supported Skills deal {0}% more Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last eight seconds",
      },
      {
        limit: [{ min: "#", max: -1 }],
        text: "Supported Skills deal {0}% less Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last eight seconds",
        transforms: [{ index: 0, op: "negate" }],
      },
    ],
  },
  "support_retreating_assault_melee_damage_+%_final": {
    stats: ["support_retreating_assault_melee_damage_+%_final"],
    lines: [
      { limit: [{ min: -100, max: -100 }], text: "Supported Skills deal no Melee damage" },
      { limit: [{ min: 1, max: "#" }], text: "Supported Skills deal {0}% more Melee damage" },
      {
        limit: [{ min: "#", max: -1 }],
        text: "Supported Skills deal {0}% less Melee damage",
        transforms: [{ index: 0, op: "negate" }],
      },
    ],
  },
};

describe("renderStatLines", () => {
  it("renders the Retreat II support stat block matching the in-game text", () => {
    const block: GemStatValues = {
      constant: [
        ["support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_8_seconds", 25],
        ["support_retreating_assault_melee_damage_+%_final", -100],
      ],
      dynamic: null,
    };
    expect(renderStatLines(block, 1, RETREAT_DESCRIPTIONS)).toEqual([
      "Supported Skills deal 25% more Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last eight seconds",
      "Supported Skills deal no Melee damage",
    ]);
  });

  it("applies the negate transform on the 'less' variant", () => {
    const block: GemStatValues = {
      constant: [["support_retreating_assault_melee_damage_+%_final", -30]],
      dynamic: null,
    };
    expect(renderStatLines(block, 1, RETREAT_DESCRIPTIONS)).toEqual([
      "Supported Skills deal 30% less Melee damage",
    ]);
  });

  it("converts milliseconds to seconds and honours the :+d sign hint", () => {
    const descriptions: StatDescriptions = {
      base_skill_effect_duration: {
        stats: ["base_skill_effect_duration"],
        lines: [
          {
            limit: null,
            text: "{0:+d} second to Skill Duration",
            transforms: [{ index: 0, op: "milliseconds_to_seconds" }],
          },
        ],
      },
    };
    const block: GemStatValues = { constant: [["base_skill_effect_duration", 5000]], dynamic: null };
    expect(renderStatLines(block, 1, descriptions)).toEqual(["+5 second to Skill Duration"]);
  });

  it("selects the per-level value for dynamic stats and skips undescribed flags", () => {
    const descriptions: StatDescriptions = {
      cooldown_pct: {
        stats: ["cooldown_pct"],
        lines: [{ limit: null, text: "Cooldown is {0}% of attack time" }],
      },
    };
    const block: GemStatValues = {
      constant: [],
      dynamic: {
        statIds: ["cooldown_pct", "can_perform_skill_while_moving"],
        byLevel: { "1": [600], "20": [410] },
      },
    };
    expect(renderStatLines(block, 20, descriptions)).toEqual(["Cooldown is 410% of attack time"]);
    // unknown level falls back to the nearest defined level at or below it
    expect(renderStatLines(block, 5, descriptions)).toEqual(["Cooldown is 600% of attack time"]);
  });
});

describe("resolveGemLevel", () => {
  const levels = [
    { level: 1, levelRequirement: 0 },
    { level: 2, levelRequirement: 3 },
    { level: 3, levelRequirement: 6 },
    { level: 20, levelRequirement: 90 },
  ];

  it("maps a character level to the highest reachable gem level", () => {
    expect(resolveGemLevel(levels, 5, 20)).toBe(2);
    expect(resolveGemLevel(levels, 100, 20)).toBe(20);
  });

  it("caps at the natural max level", () => {
    expect(resolveGemLevel(levels, 100, 3)).toBe(3);
  });
});
