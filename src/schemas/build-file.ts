import { z } from "zod";
import { LevelIntervalSchema } from "@/schemas/build";

/** Passive entry in a `.build` file (game / Filterblade schema). */
export const BuildFilePassiveSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  level_interval: LevelIntervalSchema.optional().default([1, 100]),
  weapon_set: z.number().int().optional().default(0),
  additional_text: z.string().optional().default(""),
});

export const BuildFileSupportSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  level_interval: LevelIntervalSchema.optional().default([1, 100]),
  additional_text: z.string().optional().default(""),
});

export const BuildFileSkillSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  level_interval: LevelIntervalSchema.optional().default([1, 100]),
  additional_text: z.string().optional().default(""),
  support_skills: z.array(BuildFileSupportSchema).optional().default([]),
});

/** Inventory slot entry in a `.build` file (GGG schema: `BuildInventorySlot`). */
export const BuildFileItemSchema = z.object({
  inventory_id: z.string(),
  level_interval: LevelIntervalSchema.optional().default([1, 100]),
  unique_name: z.string().optional().default(""),
  additional_text: z.string().optional().default(""),
});

/** Top-level `.build` JSON object. */
export const BuildFileSchema = z.object({
  name: z.string().optional().default("Untitled build"),
  description: z.string().optional().default(""),
  ascendancy: z.string().optional().default(""),
  passives: z.array(BuildFilePassiveSchema).optional().default([]),
  skills: z.array(BuildFileSkillSchema).optional().default([]),
  // GGG's spec names the gear array `inventory_slots`. Older exports of this
  // tool wrote `items`; accept it as a fallback on import.
  inventory_slots: z.array(BuildFileItemSchema).optional(),
  items: z.array(BuildFileItemSchema).optional(),
});

export type BuildFile = z.infer<typeof BuildFileSchema>;
