import { formatSkillCraftAdditionalText } from "./skill-craft-level";
import { formatSupportCraftAdditionalText } from "./support-craft-level";
import type { BuildState } from "@/schemas/build";
import type { ActiveGem, GemsFile, SupportGem } from "@/schemas/gem";

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

/**
 * Resolve each gem's display `name`/`color` from the catalog. Loaded builds
 * (`.build` import, browser-draft restore, saved-build load) carry the raw
 * metadata id as their name and a placeholder color, since `buildFromFile`
 * runs without the gems catalog. Idempotent: gems added via the UI already
 * match the catalog, so this is a no-op for them. Gems missing from the
 * catalog keep their stored values.
 */
export function syncBuildGemNames(build: BuildState, gems: GemsFile): BuildState {
  let changed = false;
  const skills = build.skills.map((skill) => {
    let next = skill;
    const cat = gems.active[skill.skillId];
    if (cat) {
      const color = gemColorToUi(cat.color);
      if (skill.name !== cat.name || skill.color !== color) {
        next = { ...next, name: cat.name, color };
      }
    }
    let supportsChanged = false;
    const supports = next.supports.map((sup) => {
      const sc = gems.support[sup.skillId];
      if (!sc) return sup;
      const color = gemColorToUi(sc.color);
      if (sup.name === sc.name && sup.color === color) return sup;
      supportsChanged = true;
      return { ...sup, name: sc.name, color };
    });
    if (supportsChanged) next = { ...next, supports };
    if (next !== skill) changed = true;
    return next;
  });
  return changed ? { ...build, skills } : build;
}
