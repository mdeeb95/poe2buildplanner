import type { BuildState, SkillSetup } from "@/schemas/build";
import type { GrantedSkill } from "@/schemas/granted-skills";
import { DEFAULT_LEVEL_MAX, LEVEL_MIN } from "@/lib/build/levels";

export type GrantedSkillIndex = ReadonlyMap<string, GrantedSkill>;

/** Build a node-id → granted-skill lookup from the `/granted-skills` payload. */
export function grantedSkillIndex(skills: ReadonlyArray<GrantedSkill>): GrantedSkillIndex {
  return new Map(skills.map((s) => [s.nodeId, s]));
}

function skillsEqual(a: ReadonlyArray<SkillSetup>, b: ReadonlyArray<SkillSetup>): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Keep `build.skills` in sync with the active skills granted by currently
 * allocated tree nodes:
 *  - add a locked row for each allocated granting node that has none,
 *  - drop granted rows whose node is no longer allocated (their supports go with
 *    them — re-allocating starts fresh),
 *  - refresh a kept row's identity (skillId/name/colour) if the index changed,
 *  - adopt a matching manual skill (same skillId) instead of duplicating it,
 *    which is how imported builds (whose granted rows arrive unmarked) re-link.
 *
 * Returns the same `build` reference when nothing changes so callers can guard
 * against history churn / render loops. No-ops while the index is empty (i.e.
 * not yet loaded) to avoid stripping rows during the load window.
 */
export function reconcileGrantedSkills(
  build: BuildState,
  index: GrantedSkillIndex | null,
): BuildState {
  if (!index || index.size === 0) return build;

  const targets: GrantedSkill[] = [];
  for (const id of build.allocated) {
    const g = index.get(id);
    if (g) targets.push(g);
  }

  const usedNodes = new Set<string>();
  const result: SkillSetup[] = [];

  for (const s of build.skills) {
    if (s.grantedBy) {
      const g = build.allocated.includes(s.grantedBy) ? index.get(s.grantedBy) : undefined;
      if (g && !usedNodes.has(g.nodeId)) {
        usedNodes.add(g.nodeId);
        result.push({ ...s, skillId: g.skillId, name: g.name, color: g.color });
      }
      // else: node no longer allocated/granting → drop this row.
      continue;
    }
    // Manual skill — adopt it if it matches a granted target (import re-link).
    const adopt = targets.find((g) => !usedNodes.has(g.nodeId) && g.skillId === s.skillId);
    if (adopt) {
      usedNodes.add(adopt.nodeId);
      result.push({ ...s, grantedBy: adopt.nodeId, name: adopt.name, color: adopt.color });
    } else {
      result.push(s);
    }
  }

  for (const g of targets) {
    if (usedNodes.has(g.nodeId)) continue;
    usedNodes.add(g.nodeId);
    result.push({
      id: `granted-${g.nodeId}`,
      skillId: g.skillId,
      name: g.name,
      color: g.color,
      grantedBy: g.nodeId,
      levelInterval: [LEVEL_MIN, DEFAULT_LEVEL_MAX],
      additionalText: "",
      supports: [],
    });
  }

  if (skillsEqual(build.skills, result)) return build;
  return { ...build, skills: result };
}
