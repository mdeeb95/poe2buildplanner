import {
  GemStatBlocksFileSchema,
  type GemStatBlocksFile,
  type GemStatValues,
} from "@/schemas/gem-stat-block.js";
import type {
  StatDescriptionEntry,
  StatDescriptionsFile,
} from "@/schemas/stat-description.js";

/**
 * Assemble the lazily-loaded tooltip data file: per-gem raw stat values plus the
 * pruned subset of stat descriptions those values reference. Pruning keeps the
 * file small (the full stat-descriptions catalog is several MB; gems touch only
 * a fraction of it). The renderer (`lib/build/stat-render.ts`) turns this into
 * the blue stat lines shown in `components/GemTooltip.tsx`.
 */
export function buildGemStatBlocks(
  statValues: Record<string, GemStatValues>,
  statDescriptions: StatDescriptionsFile,
  version: { pobCommit: string; fetchedAt: string },
): GemStatBlocksFile {
  const referenced = new Set<string>();
  for (const block of Object.values(statValues)) {
    for (const [id] of block.constant) referenced.add(id);
    if (block.dynamic) for (const id of block.dynamic.statIds) referenced.add(id);
  }

  const descriptions: Record<string, StatDescriptionEntry> = {};
  for (const id of referenced) {
    const idx = statDescriptions.byStat[id];
    if (idx === undefined) continue;
    const entry = statDescriptions.entries[idx];
    if (entry) descriptions[id] = entry;
  }

  const result: GemStatBlocksFile = { version, gems: statValues, descriptions };
  return GemStatBlocksFileSchema.parse(result);
}
