import { z } from "zod";

export const BaseItemRequirementsSchema = z.object({
  level: z.number().int().optional(),
  str: z.number().int().optional(),
  dex: z.number().int().optional(),
  int: z.number().int().optional(),
});

export const BaseItemWeaponPropertiesSchema = z.object({
  physicalMin: z.number().optional(),
  physicalMax: z.number().optional(),
  critChanceBase: z.number().optional(),
  attackRateBase: z.number().optional(),
  range: z.number().optional(),
});

export const BaseItemArmourPropertiesSchema = z.object({
  armour: z.number().optional(),
  evasion: z.number().optional(),
  energyShield: z.number().optional(),
  movementPenalty: z.number().optional(),
  ward: z.number().optional(),
});

export const BaseItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.string(),
  type: z.string(),
  subType: z.string().nullable(),
  tags: z.record(z.string(), z.boolean()),
  implicit: z.string().nullable(),
  quality: z.number().nullable(),
  socketLimit: z.number().int().nullable(),
  requirements: BaseItemRequirementsSchema,
  weapon: BaseItemWeaponPropertiesSchema.nullable(),
  armour: BaseItemArmourPropertiesSchema.nullable(),
});

export const BasesFileSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    fetchedAt: z.string(),
  }),
  bases: z.record(z.string(), BaseItemSchema),
  bySlot: z.record(z.string(), z.array(z.string())),
});

export type BaseItem = z.infer<typeof BaseItemSchema>;
export type BasesFile = z.infer<typeof BasesFileSchema>;
