import { DEFAULT_LEVEL_MAX, toLevelInterval } from "./levels";
import { defaultSupportAdditionalText } from "./gem-additional-text";
import {
  defaultSupportLevelInterval,
  supportCraftRequirementLevel,
} from "./support-craft-level";
import type { GemsFile, SupportGem } from "@/schemas/gem";
import type { GemUiColor } from "./gem-ui";
import type { LevelInterval } from "@/schemas/build";

/** PoB gemFamily key for tier variants (e.g. ElementalArmament). */
export function supportFamilyKey(gem: Pick<SupportGem, "gemFamily">): string | null {
  const key = gem.gemFamily?.[0];
  return key?.trim() ? key : null;
}

export function supportUncutTierValue(gem: Pick<SupportGem, "uncutTier">): number {
  if (gem.uncutTier != null && gem.uncutTier > 0) return gem.uncutTier;
  return 1;
}

/** All support variants grouped by gemFamily, sorted by uncutTier ascending. */
export function indexSupportFamilies(
  support: Record<string, SupportGem>,
): Map<string, SupportGem[]> {
  const map = new Map<string, SupportGem[]>();
  for (const gem of Object.values(support)) {
    const key = supportFamilyKey(gem);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(gem);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => supportUncutTierValue(a) - supportUncutTierValue(b));
  }
  return map;
}

/** Next variant in gemFamily sorted by uncutTier (e.g. Rapid Attacks I → II, not uncutTier+1). */
export function nextSupportTierInFamily(
  gems: GemsFile,
  currentSkillId: string,
): SupportGem | undefined {
  const current = gems.support[currentSkillId];
  if (!current) return undefined;
  const family = supportFamilyKey(current);
  if (!family) return undefined;
  const siblings = indexSupportFamilies(gems.support).get(family);
  if (!siblings) return undefined;
  const idx = siblings.findIndex((g) => g.id === currentSkillId);
  if (idx < 0 || idx >= siblings.length - 1) return undefined;
  return siblings[idx + 1];
}

/** Catalog id for the next tier in the same gemFamily, if any. */
export function nextSupportTierId(
  gems: GemsFile,
  currentSkillId: string,
): string | undefined {
  return nextSupportTierInFamily(gems, currentSkillId)?.id;
}

type SupportIntervalRow = { skillId: string; levelInterval: LevelInterval };

/** Recompute min/max for every tier of a family on one skill (fixes out-of-order adds). */
export function normalizeSupportFamilyIntervals<T extends SupportIntervalRow>(
  supports: T[],
  gems: GemsFile,
): T[] {
  const byFamily = new Map<string, T[]>();
  for (const row of supports) {
    const gem = gems.support[row.skillId];
    const key = gem ? supportFamilyKey(gem) : null;
    if (!key) continue;
    const list = byFamily.get(key) ?? [];
    list.push(row);
    byFamily.set(key, list);
  }

  const updates = new Map<string, LevelInterval>();
  for (const rows of byFamily.values()) {
    const sorted = [...rows].sort(
      (a, b) =>
        supportUncutTierValue(gems.support[a.skillId]!) -
        supportUncutTierValue(gems.support[b.skillId]!),
    );
    for (let i = 0; i < sorted.length; i++) {
      const gem = gems.support[sorted[i]!.skillId];
      if (!gem) continue;
      const min = supportCraftRequirementLevel(gem);
      let max = DEFAULT_LEVEL_MAX;
      if (i < sorted.length - 1) {
        const nextGem = gems.support[sorted[i + 1]!.skillId];
        if (nextGem) {
          max = Math.max(min, supportCraftRequirementLevel(nextGem) - 1);
        }
      }
      updates.set(sorted[i]!.skillId, toLevelInterval(min, max));
    }
  }

  if (updates.size === 0) return supports;
  return supports.map((row) => {
    const interval = updates.get(row.skillId);
    return interval ? { ...row, levelInterval: interval } : row;
  });
}

export interface SupportPickerRankContext {
  compatibleIds: Set<string>;
  replacing?: {
    skillId: string;
    familyKey: string | null;
    nextTierId: string | null;
  };
}

/** Lower rank = higher in picker list. */
export function supportPickerRank(
  gemId: string,
  gem: SupportGem,
  ctx: SupportPickerRankContext,
): number {
  const family = supportFamilyKey(gem);

  if (ctx.replacing) {
    const { familyKey, nextTierId } = ctx.replacing;
    if (familyKey && family === familyKey && nextTierId === gemId) return 0;
    if (ctx.compatibleIds.has(gemId)) return 1;
    if (familyKey && family === familyKey) return 2;
    return 3;
  }

  if (ctx.compatibleIds.has(gemId)) return 0;
  return 1;
}

export interface SupportSetupSeed {
  skillId: string;
  name: string;
  color: GemUiColor;
  levelInterval: LevelInterval;
  additionalText: string;
}

/** All variants in the same gemFamily (sorted by uncutTier ascending), including the picked one. */
export function supportTiersInFamily(
  gems: GemsFile,
  currentSkillId: string,
): SupportGem[] {
  const current = gems.support[currentSkillId];
  if (!current) return [];
  const family = supportFamilyKey(current);
  if (!family) return [];
  return indexSupportFamilies(gems.support).get(family) ?? [];
}

/** Support row(s) to add: every family tier not already socketed (lower and higher than picked). */
export function supportSetupsForAdd(
  gemId: string,
  gems: GemsFile,
  row: { name: string; color: GemUiColor },
  existingSupportSkillIds: Iterable<string>,
): SupportSetupSeed[] {
  const existing = new Set(existingSupportSkillIds);
  const gem = gems.support[gemId];
  if (!gem) {
    return [
      {
        skillId: gemId,
        name: row.name,
        color: row.color,
        levelInterval: [1, 100],
        additionalText: "",
      },
    ];
  }

  const seeds: SupportSetupSeed[] = [];
  const append = (id: string, catalog: SupportGem, displayName: string) => {
    if (existing.has(id)) return;
    const nextId = nextSupportTierId(gems, id);
    const nextDrop =
      nextId != null ? supportCraftRequirementLevel(gems.support[nextId]!) : null;
    seeds.push({
      skillId: id,
      name: displayName,
      color: row.color,
      levelInterval: defaultSupportLevelInterval(catalog, nextDrop),
      additionalText: defaultSupportAdditionalText(catalog),
    });
    existing.add(id);
  };

  const family = supportTiersInFamily(gems, gemId);
  if (family.length === 0) {
    append(gemId, gem, row.name);
    return seeds;
  }
  // Seed the whole family in tier order so picking any rank fills in the
  // lower and higher ranks too, displayed lowest-to-highest.
  for (const tier of family) {
    append(tier.id, tier, tier.id === gemId ? row.name : tier.name);
  }

  return seeds;
}
