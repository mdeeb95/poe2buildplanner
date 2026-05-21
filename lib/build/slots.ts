export interface SlotLayout {
  id: string;
  label: string;
  set?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** PoE2 inventory grid (8×7). Weapon-set slots use `set` for I/II tabs. */
export const SLOT_LAYOUT: SlotLayout[] = [
  { id: "Weapon1", label: "Weapon", set: 1, x: 0, y: 0, w: 2, h: 4 },
  { id: "Offhand1", label: "Offhand", set: 1, x: 6, y: 0, w: 2, h: 4 },
  { id: "Weapon2", label: "Weapon", set: 2, x: 0, y: 0, w: 2, h: 4 },
  { id: "Offhand2", label: "Offhand", set: 2, x: 6, y: 0, w: 2, h: 4 },
  { id: "Helmet", label: "Helm", x: 3, y: 0, w: 2, h: 2 },
  { id: "Amulet", label: "Amulet", x: 5, y: 0, w: 1, h: 1 },
  { id: "BodyArmour", label: "Body", x: 3, y: 2, w: 2, h: 3 },
  { id: "Ring1", label: "Ring", x: 2, y: 3, w: 1, h: 1 },
  { id: "Ring2", label: "Ring", x: 5, y: 3, w: 1, h: 1 },
  { id: "Belt", label: "Belt", x: 3, y: 5, w: 2, h: 1 },
  { id: "Gloves", label: "Gloves", x: 0, y: 5, w: 2, h: 2 },
  { id: "Boots", label: "Boots", x: 6, y: 5, w: 2, h: 2 },
];

export function sizeClass(slot: SlotLayout): "micro" | "tiny" | "small" | "medium" | "large" {
  const area = slot.w * slot.h;
  if (slot.w === 1 && slot.h === 1) return "micro";
  if (area <= 2) return "tiny";
  if (area <= 4) return "small";
  if (area <= 6) return "medium";
  return "large";
}
