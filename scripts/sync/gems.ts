import { parseAssignmentTable, parseReturnTable, readLuaSource } from "../parse/lua.js";
import { STATMAP_SKIP_KEYS } from "../parse/lua-skip-statmap.js";
import {
  GemsFileSchema,
  type ActiveGem,
  type GemsFile,
  type SupportGem,
} from "@/schemas/gem.js";
import type { Upstream } from "./fetch.js";

const GEMS_INDEX = "src/Data/Gems.lua";
const ACTIVE_SKILL_FILES = [
  "src/Data/Skills/act_str.lua",
  "src/Data/Skills/act_dex.lua",
  "src/Data/Skills/act_int.lua",
  "src/Data/Skills/minion.lua",
  "src/Data/Skills/other.lua",
  "src/Data/Skills/spectre.lua",
];
const SUPPORT_SKILL_FILES = [
  "src/Data/Skills/sup_str.lua",
  "src/Data/Skills/sup_dex.lua",
  "src/Data/Skills/sup_int.lua",
];

type LuaRecord = Record<string, unknown>;

interface GemIndexEntry {
  name?: string;
  baseTypeName?: string;
  gameId?: string;
  variantId?: string;
  grantedEffectId?: string;
  tags?: Record<string, boolean>;
  gemType?: string;
  tagString?: string;
  reqStr?: number;
  reqDex?: number;
  reqInt?: number;
  naturalMaxLevel?: number;
}

interface SkillEntry {
  name?: string;
  baseTypeName?: string;
  color?: number;
  support?: boolean;
  requireSkillTypes?: string[];
  addSkillTypes?: string[];
  excludeSkillTypes?: string[];
  gemFamily?: string[];
  levels?: Record<string, LuaRecord>;
  statSets?: Record<string, LuaRecord>;
  weaponTypes?: Record<string, boolean> | string[];
}

export async function syncGems(upstream: Upstream): Promise<GemsFile> {
  const indexSrc = readLuaSource(await upstream.fetchFile(GEMS_INDEX));
  const { data: indexData } = parseReturnTable(indexSrc);

  const skillBuckets = await Promise.all(
    [...ACTIVE_SKILL_FILES, ...SUPPORT_SKILL_FILES].map(async (path) => {
      const src = readLuaSource(await upstream.fetchFile(path));
      const { data } = parseAssignmentTable(src, {
        expectedBaseNames: ["skills"],
        skipKeys: STATMAP_SKIP_KEYS,
      });
      return data;
    }),
  );
  const allSkills: Record<string, SkillEntry> = {};
  for (const bucket of skillBuckets) {
    for (const [k, v] of Object.entries(bucket)) {
      allSkills[k] = v as SkillEntry;
    }
  }

  const active: Record<string, ActiveGem> = {};
  const support: Record<string, SupportGem> = {};
  const byBaseTypeName: Record<string, string> = {};

  for (const [gameId, raw] of Object.entries(indexData)) {
    const entry = raw as GemIndexEntry;
    const grantedEffectId = entry.grantedEffectId ?? "";
    const skill = grantedEffectId ? allSkills[grantedEffectId] : undefined;

    const baseFields = {
      id: gameId,
      name: entry.name ?? skill?.name ?? "",
      baseTypeName: entry.baseTypeName ?? skill?.baseTypeName ?? entry.name ?? "",
      gameId: entry.gameId ?? null,
      variantId: entry.variantId ?? null,
      grantedEffectId: grantedEffectId || null,
      color: colorFromAttribute(entry.tags, skill?.color),
      gemType: normalizeGemType(entry.gemType, skill),
      tags: entry.tags ?? {},
      tagString: entry.tagString ?? null,
      reqStr: entry.reqStr ?? 0,
      reqDex: entry.reqDex ?? 0,
      reqInt: entry.reqInt ?? 0,
      naturalMaxLevel: entry.naturalMaxLevel ?? null,
      levels: collectLevels(skill?.levels),
      gemFamily: skill?.gemFamily ?? null,
    };

    if (entry.baseTypeName) byBaseTypeName[entry.baseTypeName] = gameId;

    if (skill?.support === true) {
      support[gameId] = {
        ...baseFields,
        kind: "support",
        requireSkillTypes: stripSkillTypePrefix(skill.requireSkillTypes),
        addSkillTypes: stripSkillTypePrefix(skill.addSkillTypes),
        excludeSkillTypes: stripSkillTypePrefix(skill.excludeSkillTypes),
        compatibleSkills: [],
      };
    } else {
      active[gameId] = {
        ...baseFields,
        kind: "active",
        skillTypes: deriveActiveSkillTypes(entry.tags, skill),
        weaponTypes: normalizeWeaponTypes(skill?.weaponTypes),
        compatibleSupports: [],
      };
    }
  }

  computeCompatibility(active, support);

  const result: GemsFile = {
    version: { pobCommit: upstream.sha, fetchedAt: new Date().toISOString() },
    active,
    support,
    byBaseTypeName,
  };

  return GemsFileSchema.parse(result);
}

function collectLevels(rawLevels: Record<string, LuaRecord> | undefined): Array<{
  level: number;
  levelRequirement: number;
}> {
  if (!rawLevels) return [];
  const out: Array<{ level: number; levelRequirement: number }> = [];
  for (const [k, v] of Object.entries(rawLevels)) {
    const level = Number(k);
    if (!Number.isFinite(level)) continue;
    const rec = v as Record<string, unknown>;
    const lr = typeof rec.levelRequirement === "number" ? rec.levelRequirement : 0;
    out.push({ level, levelRequirement: lr });
  }
  out.sort((a, b) => a.level - b.level);
  return out;
}

function colorFromAttribute(
  tags: Record<string, boolean> | undefined,
  fallbackCode: number | undefined,
): "str" | "dex" | "int" | "any" {
  if (tags?.strength) return "str";
  if (tags?.dexterity) return "dex";
  if (tags?.intelligence) return "int";
  if (fallbackCode === 1) return "str";
  if (fallbackCode === 2) return "dex";
  if (fallbackCode === 3) return "int";
  return "any";
}

const GEM_TYPE_VALUES = new Set([
  "Spell",
  "Attack",
  "Trigger",
  "Support",
  "Meta",
  "Aura",
  "Curse",
  "Buff",
  "Other",
]);

function normalizeGemType(
  raw: string | undefined,
  skill: SkillEntry | undefined,
): "Spell" | "Attack" | "Trigger" | "Support" | "Meta" | "Aura" | "Curse" | "Buff" | "Other" {
  if (skill?.support) return "Support";
  if (raw && GEM_TYPE_VALUES.has(raw)) {
    return raw as "Spell" | "Attack" | "Trigger" | "Meta" | "Aura" | "Curse" | "Buff" | "Other";
  }
  return "Other";
}

function stripSkillTypePrefix(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    out.push(v.startsWith("SkillType.") ? v.slice("SkillType.".length) : v);
  }
  return out;
}

function deriveActiveSkillTypes(
  tags: Record<string, boolean> | undefined,
  skill: SkillEntry | undefined,
): string[] {
  // For v1 we approximate the "SkillType bag" of an active gem from
  // (a) Gems.lua tag keys, plus (b) baseFlags keys discovered inside statSets.
  // PoB's runtime SkillType resolution uses additional rules we don't port;
  // see scripts/sync/gems.ts for the matching policy used by computeCompatibility.
  const out = new Set<string>();
  for (const tag of Object.keys(tags ?? {})) out.add(tag);
  if (skill?.statSets) {
    for (const set of Object.values(skill.statSets)) {
      const baseFlags = (set as LuaRecord).baseFlags;
      if (baseFlags && typeof baseFlags === "object" && !Array.isArray(baseFlags)) {
        for (const flag of Object.keys(baseFlags)) out.add(flag);
      }
    }
  }
  return [...out];
}

function normalizeWeaponTypes(raw: SkillEntry["weaponTypes"]): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string");
  if (typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }
  return null;
}

// Cross-reference policy (v1, permissive):
//
// For each (active, support) pair, decide compatibility by checking the support's
// requireSkillTypes and excludeSkillTypes against a normalized "skill-type bag"
// computed for the active gem (tags ∪ baseFlags keys, lowercased).
//
// A SkillType is "knownish" if its normalized form (lowercased, "SkillType." stripped)
// matches anything in our universe of observed active skill tags+baseFlags. If a
// support's require type is unknown, we treat that requirement as "passes" rather
// than fail — because PoB's full resolution uses enum-derived mappings (e.g.
// "AppliesCurse" derives from skill stats, not from a tag) that we don't compute.
// This errs on the side of showing potentially-valid supports rather than hiding
// them, which is safe for an authoring tool where the creator has final say.
function computeCompatibility(
  active: Record<string, ActiveGem>,
  support: Record<string, SupportGem>,
) {
  const universe = new Set<string>();
  for (const gem of Object.values(active)) {
    for (const t of gem.skillTypes) universe.add(t.toLowerCase());
  }

  for (const [supId, sup] of Object.entries(support)) {
    const require = sup.requireSkillTypes.map((t) => t.toLowerCase());
    const exclude = sup.excludeSkillTypes.map((t) => t.toLowerCase());
    const requireKnown = require.filter((t) => universe.has(t));
    const excludeKnown = exclude.filter((t) => universe.has(t));

    for (const [actId, act] of Object.entries(active)) {
      const bag = new Set(act.skillTypes.map((t) => t.toLowerCase()));
      const meetsRequire = requireKnown.every((t) => bag.has(t));
      const hitsExclude = excludeKnown.some((t) => bag.has(t));
      if (meetsRequire && !hitsExclude) {
        act.compatibleSupports.push(supId);
        sup.compatibleSkills.push(actId);
      }
    }
  }
}
