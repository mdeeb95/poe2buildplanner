import type { BasesFile } from "@/schemas/base";
import type { UniquesFile } from "@/schemas/unique";
import { fuzzyMatchAny } from "@/lib/build/fuzzy-search";

const WEAPON_SLOT_KEYS = [
  "sword",
  "axe",
  "mace",
  "bow",
  "crossbow",
  "spear",
  "dagger",
  "claw",
  "flail",
  "staff",
  "wand",
  "sceptre",
  "talisman",
  "traptool",
  "incursionlimb",
  "soulcore",
] as const;

const OFFHAND_SLOT_KEYS = ["shield", "quiver", "focus"] as const;

const SLOT_TO_UNIQUE_KEYS: Record<string, readonly string[]> = {
  Helmet: ["helmet"],
  BodyArmour: ["body"],
  Gloves: ["gloves"],
  Boots: ["boots"],
  Belt: ["belt"],
  Amulet: ["amulet"],
  Ring1: ["ring"],
  Ring2: ["ring"],
  Weapon1: WEAPON_SLOT_KEYS,
  Weapon2: WEAPON_SLOT_KEYS,
  Offhand1: OFFHAND_SLOT_KEYS,
  Offhand2: OFFHAND_SLOT_KEYS,
};

export function uniqueNamesForSlot(uniques: UniquesFile, slotId: string): string[] {
  const keys = SLOT_TO_UNIQUE_KEYS[slotId];
  if (!keys) return [];
  const names = new Set<string>();
  for (const key of keys) {
    const list = uniques.bySlot[key];
    if (list) {
      for (const name of list) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function uniqueForName(uniques: UniquesFile, name: string) {
  return uniques.uniques[name];
}

export function baseNameForUnique(
  uniques: UniquesFile,
  bases: BasesFile | null,
  uniqueName: string,
): string | undefined {
  const unique = uniques.uniques[uniqueName];
  if (!unique) return undefined;
  if (bases?.bases[unique.base]) return unique.base;
  return unique.base;
}

export function uniqueMatchesForSlot(
  uniques: UniquesFile,
  slotId: string,
  query: string,
): Array<{ name: string; base: string }> {
  const names = uniqueNamesForSlot(uniques, slotId);
  return names
    .filter((name) => {
      const u = uniques.uniques[name];
      return fuzzyMatchAny([name, u?.base ?? ""], query);
    })
    .map((name) => {
      const u = uniques.uniques[name];
      return { name, base: u?.base ?? "" };
    });
}
