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
  cost: z.record(z.string(), z.number()).optional(),
});

const BaseGemFields = {
  id: z.string(),
  name: z.string(),
  baseTypeName: z.string(),
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
};

export const ActiveGemSchema = z.object({
  ...BaseGemFields,
  kind: z.literal("active"),
  skillTypes: z.array(z.string()),
  weaponTypes: z.array(z.string()).nullable(),
  compatibleSupports: z.array(z.string()),
});

export const SupportGemSchema = z.object({
  ...BaseGemFields,
  kind: z.literal("support"),
  requireSkillTypes: z.array(z.string()),
  addSkillTypes: z.array(z.string()),
  excludeSkillTypes: z.array(z.string()),
  compatibleSkills: z.array(z.string()),
});

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
