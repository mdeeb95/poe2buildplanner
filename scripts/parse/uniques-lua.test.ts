import { describe, expect, it } from "vitest";
import { parseUniquesLua } from "./uniques-lua.js";

const RING_SNIPPET = `-- Item data (c) Grinding Gear Games

return {
-- Ring
[[
Andvarius
Gold Ring
Implicits: 1
(6-15)% increased Rarity of Items found
]],
[[
Blackheart
Iron Ring
Implicits: 1
Adds 1 to 4 Physical Damage to Attacks
]],
}`;

const AMULET_SNIPPET = `return {
[[
The Anvil
Bloodstone Amulet
Variant: Pre 0.2.0
Implicits: 1
+(30-40) to maximum Life
]],
}`;

describe("parseUniquesLua", () => {
  it("extracts name and base from ring blocks", () => {
    const out = parseUniquesLua(RING_SNIPPET, "ring");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      name: "Andvarius",
      base: "Gold Ring",
      slot: "ring",
    });
    expect(out[1]).toEqual({
      name: "Blackheart",
      base: "Iron Ring",
      slot: "ring",
    });
  });

  it("extracts amulet uniques", () => {
    const out = parseUniquesLua(AMULET_SNIPPET, "amulet");
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("The Anvil");
    expect(out[0]!.base).toBe("Bloodstone Amulet");
  });
});
