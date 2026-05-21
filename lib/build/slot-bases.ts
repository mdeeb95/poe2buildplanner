import type { BasesFile } from "@/schemas/base";

const WEAPON_SLOTS = [
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
  "shield",
  "quiver",
  "focus",
  "talisman",
  "traptool",
  "incursionlimb",
  "soulcore",
] as const;

const SLOT_TO_BASE_KEYS: Record<string, readonly string[]> = {
  Helmet: ["helmet"],
  BodyArmour: ["body"],
  Gloves: ["gloves"],
  Boots: ["boots"],
  Belt: ["belt"],
  Amulet: ["amulet"],
  Ring1: ["ring"],
  Ring2: ["ring"],
  Weapon1: WEAPON_SLOTS,
  Weapon2: WEAPON_SLOTS,
  Offhand1: ["shield", "quiver", "focus"],
  Offhand2: ["shield", "quiver", "focus"],
};

export function baseNamesForSlot(bases: BasesFile, slotId: string): string[] {
  const keys = SLOT_TO_BASE_KEYS[slotId];
  if (!keys) return [];
  const names = new Set<string>();
  for (const key of keys) {
    const list = bases.bySlot[key];
    if (list) {
      for (const name of list) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function baseItemForName(bases: BasesFile, name: string) {
  return bases.bases[name];
}
