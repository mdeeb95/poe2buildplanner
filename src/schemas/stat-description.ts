import { z } from "zod";

export const StatDescriptionLimitSchema = z.object({
  min: z.union([z.number(), z.string()]).nullable(),
  max: z.union([z.number(), z.string()]).nullable(),
});

export const StatDescriptionLineSchema = z.object({
  limit: z.array(StatDescriptionLimitSchema).nullable(),
  text: z.string(),
});

export const StatDescriptionEntrySchema = z.object({
  stats: z.array(z.string()),
  lines: z.array(StatDescriptionLineSchema),
});

export const StatDescriptionsFileSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    fetchedAt: z.string(),
  }),
  entries: z.array(StatDescriptionEntrySchema),
  byStat: z.record(z.string(), z.number().int()),
});

export type StatDescriptionLimit = z.infer<typeof StatDescriptionLimitSchema>;
export type StatDescriptionLine = z.infer<typeof StatDescriptionLineSchema>;
export type StatDescriptionEntry = z.infer<typeof StatDescriptionEntrySchema>;
export type StatDescriptionsFile = z.infer<typeof StatDescriptionsFileSchema>;
