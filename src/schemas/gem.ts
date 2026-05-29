import { z } from "zod";

const GemColor = z.enum(["str", "dex", "int", "any"]);
const GemTypeKind = z.enum([
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

export const GemLevelSchema = z.object({
  level: z.number().int(),
  levelRequirement: z.number().int(),
  reqStr: z.number().int().optional(),
  reqDex: z.number().int().optional(),
  reqInt: z.number().int().optional(),
  cost: z.record(z.string(), z.number()).optional(),
});

const BaseGemFields = {
  id: z.string(),
  name: z.string(),
  baseTypeName: z.string(),
  /**
   * Human-readable effect summary from PoB skill data (`description`).
   * Optional + nullable so older/partial gem payloads still validate — a missing
   * description must never fail the whole catalog parse (which would blank the picker).
   */
  description: z.string().nullish(),
  gameId: z.string().nullable(),
  variantId: z.string().nullable(),
  grantedEffectId: z.string().nullable(),
  color: GemColor,
  gemType: GemTypeKind,
  tags: z.record(z.string(), z.boolean()),
  tagString: z.string().nullable(),
  reqStr: z.number().int(),
  reqDex: z.number().int(),
  reqInt: z.number().int(),
  naturalMaxLevel: z.number().int().nullable(),
  levels: z.array(GemLevelSchema),
  gemFamily: z.array(z.string()).nullable(),
  /**
   * In-game cost multiplier as a percentage (e.g. 120 for a support with
   * `manaMultiplier = 20`). Null when the gem has no multiplier. Shown in the
   * stat-block tooltip; see `components/GemTooltip.tsx`.
   */
  costMultiplier: z.number().nullish(),
};

export const ActiveGemSchema = z.object({
  ...BaseGemFields,
  kind: z.literal("active"),
  /** Uncut skill gem tier (1–20) from PoB `Tier`; 0 = untiered/special. */
  uncutTier: z.number().int().min(0).max(20).nullish(),
  skillTypes: z.array(z.string()),
  weaponTypes: z.array(z.string()).nullable(),
  compatibleSupports: z.array(z.string()),
});

export const SupportGemSchema = z.object({
  ...BaseGemFields,
  kind: z.literal("support"),
  /** Uncut support gem tier (1–5) from PoB `Tier`; 0 = untiered/special. */
  uncutTier: z.number().int().min(0).max(5).nullish(),
  requireSkillTypes: z.array(z.string()),
  addSkillTypes: z.array(z.string()),
  excludeSkillTypes: z.array(z.string()),
  compatibleSkills: z.array(z.string()),
});

/**
 * Active skills and support variants use PoB `uncutTier` for engrave requirements
 * and zone-drop defaults — see `lib/build/skill-craft-level.ts` and
 * `lib/build/support-craft-level.ts`.
 */

export const GemsFileSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    fetchedAt: z.string(),
  }),
  active: z.record(z.string(), ActiveGemSchema),
  support: z.record(z.string(), SupportGemSchema),
  byBaseTypeName: z.record(z.string(), z.string()),
});

export type ActiveGem = z.infer<typeof ActiveGemSchema>;
export type SupportGem = z.infer<typeof SupportGemSchema>;
export type GemLevel = z.infer<typeof GemLevelSchema>;
export type GemsFile = z.infer<typeof GemsFileSchema>;
