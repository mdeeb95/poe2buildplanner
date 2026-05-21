import { z } from "zod";

export const UniqueItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  base: z.string(),
  slot: z.string(),
});

export const UniquesFileSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    fetchedAt: z.string(),
  }),
  uniques: z.record(z.string(), UniqueItemSchema),
  bySlot: z.record(z.string(), z.array(z.string())),
});

export type UniqueItem = z.infer<typeof UniqueItemSchema>;
export type UniquesFile = z.infer<typeof UniquesFileSchema>;
