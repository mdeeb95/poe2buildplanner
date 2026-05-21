import { formatSkillCraftAdditionalText } from "./skill-craft-level";
import { formatSupportCraftAdditionalText } from "./support-craft-level";
import type { BuildState } from "@/schemas/build";
import type { ActiveGem, GemsFile, SupportGem } from "@/schemas/gem";

/** Starter description when adding a skill gem from the catalog. */
export function defaultSkillAdditionalText(catalog: ActiveGem): string {
  return formatSkillCraftAdditionalText(catalog);
}

/** Starter description when adding a support gem from the catalog. */
export function defaultSupportAdditionalText(catalog: SupportGem): string {
  return formatSupportCraftAdditionalText(catalog);
}

/** Fill empty gem descriptions from the catalog; never overwrite user edits. */
export function syncBuildGemAdditionalText(build: BuildState, gems: GemsFile): BuildState {
  let changed = false;
  const skills = build.skills.map((skill) => {
    const catalogSkill = gems.active[skill.skillId];
    let additionalText = skill.additionalText ?? "";
    let skillChanged = false;
    if (!additionalText.trim() && catalogSkill) {
      additionalText = defaultSkillAdditionalText(catalogSkill);
      skillChanged = true;
    }
    const supports = skill.supports.map((sup) => {
      const catalogSup = gems.support[sup.skillId];
      const stored = sup.additionalText ?? "";
      if (stored.trim() || !catalogSup) return sup;
      skillChanged = true;
      return { ...sup, additionalText: defaultSupportAdditionalText(catalogSup) };
    });
    if (!skillChanged) return skill;
    changed = true;
    return { ...skill, additionalText, supports };
  });
  return changed ? { ...build, skills } : build;
}
