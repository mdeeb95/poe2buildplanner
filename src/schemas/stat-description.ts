import { z } from "zod";

export const StatDescriptionLimitSchema = z.object({
  min: z.union([z.number(), z.string()]).nullable(),
  max: z.union([z.number(), z.string()]).nullable(),
});

/**
 * Per-value transform applied before substitution, parsed from the leading
 * `{ k = "negate", v = 1 }` descriptors PoB attaches to each description line.
 * In that source form `k` is the handler and `v` is the 1-based value the handler
 * targets; we store it as a 0-based `index` aligned with the entry's `stats`
 * array and the `{0}`/`{1}` placeholders in `text`.
 */
export const StatDescriptionTransformSchema = z.object({
  index: z.number().int(),
  op: z.string(),
});

export const StatDescriptionLineSchema = z.object({
  limit: z.array(StatDescriptionLimitSchema).nullable(),
  text: z.string(),
  transforms: z.array(StatDescriptionTransformSchema).optional(),
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

export type StatDescriptionTransform = z.infer<typeof StatDescriptionTransformSchema>;
export type StatDescriptionLimit = z.infer<typeof StatDescriptionLimitSchema>;
export type StatDescriptionLine = z.infer<typeof StatDescriptionLineSchema>;
export type StatDescriptionEntry = z.infer<typeof StatDescriptionEntrySchema>;
export type StatDescriptionsFile = z.infer<typeof StatDescriptionsFileSchema>;
