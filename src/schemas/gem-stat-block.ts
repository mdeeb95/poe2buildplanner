import { z } from "zod";
import { StatDescriptionEntrySchema } from "./stat-description";

/**
 * Raw stat values for one gem, used to render the in-game stat-block tooltip.
 * `constant` stats are level-independent; `dynamic` stats scale per gem level
 * (`byLevel[level]` holds positional values aligned with `statIds`). Stat ids
 * resolve to human text via the pruned `descriptions` map on the parent file.
 */
export const GemStatValuesSchema = z.object({
  constant: z.array(z.tuple([z.string(), z.number()])),
  dynamic: z
    .object({
      statIds: z.array(z.string()),
      byLevel: z.record(z.string(), z.array(z.number())),
    })
    .nullable(),
});

export const GemStatBlocksFileSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    fetchedAt: z.string(),
  }),
  gems: z.record(z.string(), GemStatValuesSchema),
  /**
   * Pruned stat-description lookup — only the stat ids referenced by some gem,
   * keyed by stat id (multi-stat entries are shared across each of their ids).
   */
  descriptions: z.record(z.string(), StatDescriptionEntrySchema),
});

export type GemStatValues = z.infer<typeof GemStatValuesSchema>;
export type GemStatBlocksFile = z.infer<typeof GemStatBlocksFileSchema>;
