import { formatSkillCraftAdditionalText } from "./skill-craft-level";
import { formatSupportCraftAdditionalText } from "./support-craft-level";
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

function pickerDesc(craft: string, fallback: string | null): string {
  if (craft.trim()) return craft;
  return fallback ?? "";
}

export function activeToPickerRow(gem: ActiveGem): GemPickerRow {
  const craft = formatSkillCraftAdditionalText(gem);
  return {
    id: gem.id,
    name: gem.name,
    color: gemColorToUi(gem.color),
    kind: "skill",
    desc: pickerDesc(craft, gem.tagString ?? gem.gemType),
  };
}

export function supportToPickerRow(gem: SupportGem): GemPickerRow {
  const craft = formatSupportCraftAdditionalText(gem);
  return {
    id: gem.id,
    name: gem.name,
    color: gemColorToUi(gem.color),
    kind: "support",
    desc: pickerDesc(craft, gem.tagString ?? gem.gemType),
  };
}
