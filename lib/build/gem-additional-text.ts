import { formatSkillCraftAdditionalText } from "./skill-craft-level";
import { formatSupportCraftAdditionalText } from "./support-craft-level";
import type { BuildState, SkillSetup, SupportSetup } from "@/schemas/build";
import type { ActiveGem, GemsFile, SupportGem } from "@/schemas/gem";

/** Display/export copy for a support — always derived from catalog when available. */
export function resolveSupportAdditionalText(
  sup: Pick<SupportSetup, "skillId" | "additionalText">,
  catalog?: SupportGem,
): string {
  if (catalog) return formatSupportCraftAdditionalText(catalog);
  return sup.additionalText?.trim() ?? "";
}

/** Display/export copy for a skill — always derived from catalog when available. */
export function resolveSkillAdditionalText(
  skill: Pick<SkillSetup, "skillId" | "additionalText">,
  catalog?: ActiveGem,
): string {
  if (catalog) return formatSkillCraftAdditionalText(catalog);
  return skill.additionalText?.trim() ?? "";
}

/** Refresh stored additionalText from the gem catalog (e.g. after catalog updates). */
export function syncBuildGemAdditionalText(build: BuildState, gems: GemsFile): BuildState {
  let changed = false;
  const skills = build.skills.map((skill) => {
    const additionalText = resolveSkillAdditionalText(skill, gems.active[skill.skillId]);
    let skillChanged = additionalText !== (skill.additionalText ?? "");
    const supports = skill.supports.map((sup) => {
      const supText = resolveSupportAdditionalText(sup, gems.support[sup.skillId]);
      if (supText === (sup.additionalText ?? "")) return sup;
      skillChanged = true;
      return { ...sup, additionalText: supText };
    });
    if (!skillChanged) return skill;
    changed = true;
    return { ...skill, additionalText, supports };
  });
  return changed ? { ...build, skills } : build;
}
