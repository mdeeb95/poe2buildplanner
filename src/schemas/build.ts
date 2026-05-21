import { z } from "zod";

export const LevelIntervalSchema = z.tuple([z.number().int(), z.number().int()]);

export const SupportSetupSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  name: z.string(),
  color: z.enum(["red", "green", "blue", "white"]),
  levelInterval: LevelIntervalSchema,
});

export const SkillSetupSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  name: z.string(),
  color: z.enum(["red", "green", "blue", "white"]),
  levelInterval: LevelIntervalSchema,
  supports: z.array(SupportSetupSchema),
});

export const GearItemSchema = z.object({
  slot: z.string(),
  mode: z.enum(["unique", "rare"]),
  unique_name: z.string().optional(),
  desc: z.string().optional(),
  levelInterval: LevelIntervalSchema,
});

export const BuildStateSchema = z.object({
  name: z.string(),
  description: z.string(),
  className: z.string(),
  ascendancy: z.string(),
  allocated: z.array(z.string()),
  // Weapon-set-specific passives: node id → weapon set (1 or 2). A node in
  // `allocated` without an entry here is "global" (always active). Maps to the
  // `.build` format's optional per-passive `weapon_set` uint.
  passiveWeaponSet: z.record(z.string(), z.union([z.literal(1), z.literal(2)])),
  nodeLevels: z.record(z.string(), z.number()),
  skills: z.array(SkillSetupSchema),
  items: z.array(GearItemSchema),
});

export type LevelInterval = z.infer<typeof LevelIntervalSchema>;
export type SupportSetup = z.infer<typeof SupportSetupSchema>;
export type SkillSetup = z.infer<typeof SkillSetupSchema>;
export type GearItem = z.infer<typeof GearItemSchema>;
export type BuildState = z.infer<typeof BuildStateSchema>;
