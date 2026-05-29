import { getGemStatRequirementsAtLevel } from "@/lib/build/gem-stat-requirement.js";
import { parseAssignmentTable, parseReturnTable, readLuaSource } from "../parse/lua.js";
import { STATMAP_SKIP_KEYS } from "../parse/lua-skip-statmap.js";
import {
  GemsFileSchema,
  type ActiveGem,
  type GemsFile,
  type SupportGem,
} from "@/schemas/gem.js";
import type { GemStatValues } from "@/schemas/gem-stat-block.js";
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
  Tier?: number;
}

interface SkillEntry {
  name?: string;
  baseTypeName?: string;
  description?: string;
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

export interface GemSyncResult {
  gems: GemsFile;
  /** Per-gem raw stat values, keyed by the same gem id used in `gems`. */
  statValues: Record<string, GemStatValues>;
}

export async function syncGems(upstream: Upstream): Promise<GemSyncResult> {
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
  const statValues: Record<string, GemStatValues> = {};

  for (const [gameId, raw] of Object.entries(indexData)) {
    const entry = raw as GemIndexEntry;
    const grantedEffectId = entry.grantedEffectId ?? "";
    const skill = grantedEffectId ? allSkills[grantedEffectId] : undefined;

    const stats = extractStatValues(skill);
    if (stats) statValues[gameId] = stats;

    const baseFields = {
      id: gameId,
      name: entry.name ?? skill?.name ?? "",
      baseTypeName: entry.baseTypeName ?? skill?.baseTypeName ?? entry.name ?? "",
      description: skill?.description ?? null,
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
      levels: collectLevels(skill?.levels, {
        reqStr: entry.reqStr ?? 0,
        reqDex: entry.reqDex ?? 0,
        reqInt: entry.reqInt ?? 0,
        isSupport: skill?.support === true,
      }),
      gemFamily: skill?.gemFamily ?? null,
      costMultiplier: costMultiplierFrom(skill),
    };

    if (entry.baseTypeName) byBaseTypeName[entry.baseTypeName] = gameId;

    if (skill?.support === true) {
      support[gameId] = {
        ...baseFields,
        kind: "support",
        uncutTier: typeof entry.Tier === "number" ? entry.Tier : null,
        requireSkillTypes: stripSkillTypePrefix(skill.requireSkillTypes),
        addSkillTypes: stripSkillTypePrefix(skill.addSkillTypes),
        excludeSkillTypes: stripSkillTypePrefix(skill.excludeSkillTypes),
        compatibleSkills: [],
      };
    } else {
      active[gameId] = {
        ...baseFields,
        kind: "active",
        uncutTier: typeof entry.Tier === "number" ? entry.Tier : null,
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

  return { gems: GemsFileSchema.parse(result), statValues };
}

/** Values sorted by their numeric Lua key; passthrough for already-arrayed input. */
function orderedNumericEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.keys(value as Record<string, unknown>)
    .map((k) => ({ k, n: Number(k) }))
    .filter(({ n }) => Number.isInteger(n))
    .sort((a, b) => a.n - b.n)
    .map(({ k }) => (value as Record<string, unknown>)[k]);
}

function firstStatSet(skill: SkillEntry | undefined): Record<string, unknown> | undefined {
  if (!skill?.statSets) return undefined;
  const first = orderedNumericEntries(skill.statSets)[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : undefined;
}

/**
 * Extract a gem's renderable stat values from its primary stat set:
 * `constantStats` are level-independent `[id, value]` pairs; `stats` lists the
 * ordered ids whose per-level values live positionally in `statSet.levels[L]`
 * (alongside `statInterpolation`/`actorLevel`, which we ignore). The `statMap`
 * mod() definitions are already dropped by STATMAP_SKIP_KEYS during parsing.
 */
function extractStatValues(skill: SkillEntry | undefined): GemStatValues | null {
  const statSet = firstStatSet(skill);
  if (!statSet) return null;

  const constant: Array<[string, number]> = [];
  for (const pair of orderedNumericEntries(statSet.constantStats)) {
    const [id, val] = orderedNumericEntries(pair);
    if (typeof id === "string" && typeof val === "number") constant.push([id, val]);
  }

  const statIds = orderedNumericEntries(statSet.stats).filter(
    (s): s is string => typeof s === "string",
  );
  let dynamic: GemStatValues["dynamic"] = null;
  if (statIds.length > 0 && statSet.levels && typeof statSet.levels === "object") {
    const byLevel: Record<string, number[]> = {};
    for (const [lvl, lvlRec] of Object.entries(statSet.levels as Record<string, unknown>)) {
      if (!Number.isInteger(Number(lvl))) continue;
      byLevel[lvl] = orderedNumericEntries(lvlRec).filter(
        (v): v is number => typeof v === "number",
      );
    }
    dynamic = { statIds, byLevel };
  }

  if (constant.length === 0 && !dynamic) return null;
  return { constant, dynamic };
}

/** Support gems carry `manaMultiplier` (e.g. 20 → 120%); most actives have none. */
function costMultiplierFrom(skill: SkillEntry | undefined): number | null {
  const first = orderedNumericEntries(skill?.levels)[0];
  if (first && typeof first === "object") {
    const mm = (first as Record<string, unknown>).manaMultiplier;
    if (typeof mm === "number") return 100 + mm;
  }
  return null;
}

function collectLevels(
  rawLevels: Record<string, LuaRecord> | undefined,
  attrs: { reqStr: number; reqDex: number; reqInt: number; isSupport: boolean },
): Array<{
  level: number;
  levelRequirement: number;
  reqStr: number;
  reqDex: number;
  reqInt: number;
}> {
  if (!rawLevels) return [];
  const out: Array<{
    level: number;
    levelRequirement: number;
    reqStr: number;
    reqDex: number;
    reqInt: number;
  }> = [];
  for (const [k, v] of Object.entries(rawLevels)) {
    const level = Number(k);
    if (!Number.isFinite(level)) continue;
    const rec = v as Record<string, unknown>;
    const lr = typeof rec.levelRequirement === "number" ? rec.levelRequirement : 0;
    const stats = getGemStatRequirementsAtLevel(
      level,
      attrs.reqStr,
      attrs.reqDex,
      attrs.reqInt,
      attrs.isSupport,
    );
    out.push({ level, levelRequirement: lr, ...stats });
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
