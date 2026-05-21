import type { ActiveGem, SupportGem } from "@/schemas/gem";

export type GemUiColor = "red" | "green" | "blue" | "white";
export type GemPickerKind = "skill" | "support";

export interface GemPickerRow {
  id: string;
  name: string;
  color: GemUiColor;
  kind: GemPickerKind;
  desc: string;
}

export function gemColorToUi(color: ActiveGem["color"]): GemUiColor {
  switch (color) {
    case "str":
      return "red";
    case "dex":
      return "green";
    case "int":
      return "blue";
    default:
      return "white";
  }
}

export function activeToPickerRow(gem: ActiveGem): GemPickerRow {
  return {
    id: gem.id,
    name: gem.name,
    color: gemColorToUi(gem.color),
    kind: "skill",
    desc: gem.tagString ?? gem.gemType,
  };
}

export function supportToPickerRow(gem: SupportGem): GemPickerRow {
  return {
    id: gem.id,
    name: gem.name,
    color: gemColorToUi(gem.color),
    kind: "support",
    desc: gem.tagString ?? gem.gemType,
  };
}
